---
name: fix-bugs
description: Orquesta la corrección secuencial de todos los bugs abiertos de un feature, invocando `/fix-bug` por cada uno en un subagente aislado. Recorre `<featurePath>/BUGS.md`, filtra entries con `Status: [ ] fixed` (excluyendo los que tienen `**Manual verification pending**`), confirma el orden con el usuario, ejecuta cada `/fix-bug <ID> --orchestrated` en un subagente `general-purpose`, y al final imprime un reporte agrupado por outcome (cerrados, no resueltos, verificación manual pendiente, skipped, no atacados). Use when the user says "fixeá todos los bugs de <feature>", "arreglá todos los bugs pendientes", "limpiá BUGS.md", "/fix-bugs <feature>", or any request to clean up an entire feature's `BUGS.md` in one run.
---

# Fix Bugs

Orquestador secuencial sobre `/fix-bug`. No reinventa nada de esa skill — delega cada bug a un subagente aislado, parsea su JSON de salida, agrupa resultados, y al final imprime un reporte. La única state durable es `BUGS.md` mismo.

## When to apply / when NOT to

**Trigger heuristic:** "¿El usuario quiere arreglar **más de un** bug ya logueado en `.docs/features/<feature>/BUGS.md` en un solo run?" Si sí → corré esta skill. Si quiere uno solo → `/fix-bug <ID>`.

- ✅ Aplica a: features con ≥ 1 bug abierto (`Status: [ ] fixed`) en su `BUGS.md`.
- ❌ No aplica a: pedidos puntuales por ID (eso es `/fix-bug <ID>`), features sin `BUGS.md`, o pedidos vagos tipo "arreglá los bugs" sin contexto de feature.

**Who triggers it:** el agente que devuelve control al humano. Hay gates de `AskUserQuestion` y commits; no es seguro como subagente atómico.

## How to invoke

```
/fix-bugs                       # auto-detecta single feature bajo .docs/features/
/fix-bugs <feature-folder>      # explícito; ej. /fix-bugs pacientesModule
```

Sin args y múltiples features → la skill pregunta cuál.

## Quick start

- **Fase 1** — Resolver el feature folder.
- **Fase 2** — Build queue desde `BUGS.md` (filtra cerrados + manual-pending).
- **Fase 3** — Confirmar orden con el usuario.
- **Fase 4** — Loop secuencial: un subagente `general-purpose` por bug invoca `/fix-bug <ID> --orchestrated`.
- **Fase 5** — Reporte final agrupado por bucket.

## Fase 1 — Resolver el feature folder

Cascada:

1. Si vino `<feature-folder>` → target = `.docs/features/<feature-folder>/BUGS.md`. Si el archivo no existe → abort: `"<feature>/BUGS.md no encontrado"`.
2. Si no vino arg:
   - Una sola subcarpeta bajo `.docs/features/` → usarla.
   - Múltiples → `AskUserQuestion` listando candidates.

## Fase 2 — Build queue

1. Leer `BUGS.md` completo.
2. Parsear cada entry (header: `^## (BUG-[A-Z]+-\d+) — (.+)$`; cuerpo entre headers).
3. Filtrar:
   - **Excluir** si tiene `Status: [x] fixed` o (variante legacy) `- [x] Fixed`.
   - **Excluir** si el cuerpo contiene `**Manual verification pending**` (Escape #2 ya aplicado en un run anterior; espera que el humano corra `/write-bugs --verify <ID>`).
   - **Incluir** el resto.
4. Si el queue queda vacío → mensaje `"No hay bugs abiertos en <feature>/BUGS.md. Nada que hacer."` y exit clean.

## Fase 3 — Confirmar orden con el usuario

1. Imprimir el queue en orden literal de aparición en `BUGS.md`:
   ```
   Bugs abiertos en <feature> (<n>):
     1. BUG-PM-001 — Catálogos clínicos invisibles para usuarios autenticados (RLS sin policies)
     2. BUG-PM-002 — mapEtapaRow crashea cuando los joins devuelven null
     ...
   ```
2. `AskUserQuestion` con opciones `[Proceder con este orden / Yo dicto el orden / Cancelar]`.
3. Si `Yo dicto el orden` → segunda `AskUserQuestion` (single option `Other` → free text): `"Pegá los BUG-IDs en el orden deseado, separados por coma o espacio. Bugs no listados serán omitidos del run."`. Validar contra el queue original; IDs inválidos → re-preguntar 1 vez; si vuelve a fallar → fallback a orden literal. Bugs no listados → marcados como `out_of_scope` en el reporte.
4. Si `Cancelar` → exit clean sin tocar nada.

## Fase 4 — Loop secuencial

Por cada bug del queue, en orden:

1. Imprimir progreso: `"[3/12] Atacando BUG-PM-003..."`.
2. Spawn subagente `general-purpose` (en serie, NO en paralelo):

   ```
   Agent(
     subagent_type: "general-purpose",
     description: "Fix BUG-PM-NNN",
     prompt: """
       Invocá el skill /fix-bug con args "BUG-PM-NNN --orchestrated".

       Cuando termine (sea closed, escape1, escape2, user_aborted, user_change_approach o lint_fail),
       en la ÚLTIMA línea de tu respuesta devolvé un JSON con esta forma exacta:

       {"bug_id":"BUG-PM-NNN","result":"closed|escape1|escape2|user_aborted|user_change_approach|lint_fail","commit_sha":"<sha>|null","files_modified":[...],"manual_repro":"<repro steps if escape2 else null>","notes":"<una línea>"}

       No agregues nada después del JSON.
     """,
     run_in_background: false
   )
   ```

3. Parsear la última línea como JSON. Si no parsea → tratar como `{"result":"parse_error"}`.
4. Routing por `result`:

| `result`               | Acción del orquestador                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `closed`               | Push a bucket `cerrados`. Continuar.                                                             |
| `escape1`              | Push a bucket `no_resueltos`. Continuar.                                                         |
| `escape2`              | Push a bucket `manual_pending` (incluye `manual_repro` + `commit_sha`). Continuar.               |
| `user_aborted`         | Push a bucket `skipped_by_user`. Continuar.                                                      |
| `user_change_approach` | **Stop run.** Push el bug actual a bucket `interrupted`. Razón de stop = `user_change_approach`. |
| `lint_fail`            | **Stop run.** Push el bug actual a bucket `interrupted`. Razón de stop = `lint_fail`.            |
| `parse_error`          | Tratar como `escape1` (conservador). Continuar.                                                  |

5. Bugs no atacados al hacer stop → push a bucket `not_attempted`.

## Fase 5 — Reporte final

Estructura fija; omitir buckets vacíos:

```
## Reporte — /fix-bugs <feature>

**Run terminó por:** completed | user_change_approach | lint_fail

### ✅ Cerrados (<n>)
  - BUG-PM-001  commit a1b2c3d  — Catálogos clínicos RLS
  - BUG-PM-002  commit e4f5g6h  — mapEtapaRow null-safety
  ...

### ⚠️  Verificación manual pendiente (<n>)
Los siguientes bugs fueron arreglados y committeados pero requieren repro manual:

#### BUG-PM-010 (commit i7j8k9l)
1. Login como terapeuta1@clienteapp.test
2. ...
N. Cuando confirmes que pasa, corré: /write-bugs --verify BUG-PM-010

### ❌ No resueltos tras 2 iteraciones (<n>)
  - BUG-PM-005  — <una línea de notes>
  Re-observación quedó anotada en BUGS.md. Inspeccioná los archivos modificados (sin commit) y reintentá con /fix-bug <ID>.

### ⏭  Saltados por usuario (<n>)
  - BUG-PM-007  — Abortado en Fase 4 (plan no convenció)

### 🚧 No atacados (<n>)
  - BUG-PM-008
  - BUG-PM-009
  Razón: run se detuvo en BUG-PM-006.

### 🔕 Out-of-scope por orden custom (<n>)
  - BUG-PM-012  — El usuario no lo incluyó al dictar el orden
```

No re-correr `prettier` ni `lint` al final — `/fix-bug` ya los corre en su Fase 7 por cada bug exitoso. Si alguno falló, ya rebotó como `lint_fail` y el run paró.

## Final checklist

- [ ] Feature folder resuelto (arg explícito, single folder, o `AskUserQuestion`).
- [ ] `BUGS.md` parseado; entries `Status: [x] fixed` y entries con `**Manual verification pending**` excluidos del queue.
- [ ] Orden propuesto + `AskUserQuestion` ANTES de empezar el loop.
- [ ] Loop secuencial; cada bug en un subagente `general-purpose` aislado con `/fix-bug <ID> --orchestrated`.
- [ ] Última línea del subagente parseada como JSON; `parse_error` cae a `escape1`.
- [ ] Routing por `result` matchea la tabla; sólo `user_change_approach` y `lint_fail` paran el run.
- [ ] Reporte final agrupa por bucket; reproducciones manuales se imprimen textualmente; commits SHAs visibles.
- [ ] Cero archivos `STATE-*.md` creados — `BUGS.md` es la única state.
