---
name: fix-bug
description: Resuelve end-to-end un bug individual ya logueado en `<featurePath>/BUGS.md`. Lee el entry del bug, su `PLAN.md` y el epic relevante para entender los criterios de aceptación; propone un plan de fix; dispatchea la skill correcta (`/tdd`, `/aurora-ui`, `/supabase-rls-policy`, `/supabase-db-manager`, `/supabase-migration`, `/fetch-entity`, `/new-page`, `/shadcn`) según una tabla de routing determinista; verifica con `/playwright-uat` con tope de 2 iteraciones; cierra el bug delegando en `/write-bugs --verify <ID>`; y commitea de forma atómica. Use when the user says "fixeá BUG-PM-001", "arreglá <BUG-ID>", "resolvé este bug", "/fix-bug <ID>", or any request that names a bug ID from a `BUGS.md` and asks to make it go away.
---

# Fix Bug

Toma un bug ID concreto, lo lleva de `[ ] fixed` a `[x] fixed` en un solo turno: investiga → planifica → ejecuta → verifica → cierra → commitea. Es el eslabón que ata `/write-bugs` (escribió el bug) con `/playwright-uat` (lo descubrió) y `/write-bugs --verify` (lo cierra). No reinventa nada de esas skills — orquesta.

## When to apply / when NOT to

**Trigger heuristic:** "¿Hay un bug ID ya logueado en `.docs/features/<feature>/BUGS.md` que el usuario quiere arreglar ahora?" Si sí → corré la skill. Si no → no aplica.

- ✅ Aplica a: bugs con entry existente en algún `.docs/features/*/BUGS.md` cuyo `Status:` está `[ ] fixed`.
- ❌ No aplica a: bugs nuevos sin entry (eso es `/write-bugs`), bugs ya cerrados (eso es `/write-bugs --verify <ID>` si querés re-verificar), o pedidos vagos tipo "arreglá esto" sin un ID concreto.

**Who triggers it:** el agente que devuelve control al humano (la skill incluye gates de UAT y commit; no es seguro correrla como subagente atómico).

## How to invoke (mandatory format)

```
/fix-bug <BUG-ID>                       # arg obligatorio
/fix-bug <BUG-ID> --feature <folder>    # opcional, override de auto-detección
/fix-bug <BUG-ID> --orchestrated        # invocado por /fix-bugs; cambia Escape #2 + emite JSON estructurado
```

Si no llega `<BUG-ID>` → **stop and ask**. No hay modo interactivo de selección de bug; el ID es siempre explícito y citable.

**Modo `--orchestrated`** (solo para uso desde `/fix-bugs`):

- En Fase 6 Escape #2 (bug no UI-testable): **no** preguntar al humano por repro manual; **no** invocar `/write-bugs --verify`. Commitear el fix, anotar `**Manual verification pending** — committed in <sha>; run \`/write-bugs --verify <BUG-ID>\` after manual repro.`bajo`**Found:**` del entry, y devolver control con el JSON de retorno.
- En **toda** salida (Fase 7 happy path, Escape #1, Escape #2, user_aborted, user_change_approach, lint_fail), la **última línea** de la respuesta debe ser un JSON con esta forma exacta:
  ```json
  {
    "bug_id": "<ID>",
    "result": "closed|escape1|escape2|user_aborted|user_change_approach|lint_fail",
    "commit_sha": "<sha>|null",
    "files_modified": ["..."],
    "manual_repro": "<solo si escape2, sino null>",
    "notes": "<una línea>"
  }
  ```
- Sin el flag, el comportamiento humano-facing no cambia: pausa, pregunta, no emite JSON.

**Escape hatches — exactamente dos, exhaustivos.** Si uno aplica, declaralo en el reporte final:

1. **Bug no reproducible tras 2 iteraciones.** El loop de Fase 6 expiró sin pasar; la skill agrega `**Re-observed on <YYYY-MM-DD>**` al entry, **no comitea**, y entrega control al humano con causa raíz aparente y próximos pasos. Reporte: `fix-bug aborted: bug persists after 2 fix iterations`.
2. **Bug no UI-testable.** El entry no tiene un flow ejecutable por `/playwright-uat` (ej. un bug de migración SQL ya aplicada, un bug en un script offline). La skill ejecuta el fix, salta `/playwright-uat`, pide al humano que ejecute la repro manual del entry, y solo entonces invoca `/write-bugs --verify <ID>`. Reporte: `fix-bug: UAT skipped — manual verification required`.

Cualquier otra razón (“no sé qué tocar”, “es muy chico para skill”, “lo arreglo a mano y listo”) **no es un escape hatch válido**.

## Quick start

- **Fase 1** — Resolver el `<BUG-ID>` a su `BUGS.md` y validar que esté abierto.
- **Fase 2** — Cargar contexto: entry del bug + `PLAN.md` + epic relevante.
- **Fase 3** — Investigar el código que el bug acusa.
- **Fase 4** — Imprimir plan + gate de confirmación con `AskUserQuestion`.
- **Fase 5** — Ejecutar el fix, invocando skills en el orden del plan.
- **Fase 6** — Verificar con `/playwright-uat` (loop ≤ 2 iteraciones).
- **Fase 7** — Cerrar con `/write-bugs --verify <BUG-ID>` + commit atómico.

## Fase 1 — Resolver el bug ID a archivo

1. Si vino `--feature <folder>`:
   - Target = `.docs/features/<folder>/BUGS.md`. Si el archivo no existe → **stop, abort**.
2. Si no vino `--feature`:

   ```bash
   grep -l "## <BUG-ID> —" .docs/features/*/BUGS.md
   ```

   - 0 matches → abort: `"ID '<BUG-ID>' no encontrado en ningún BUGS.md"`.
   - 1 match → ese es el target.
   - > 1 match → abort: `"ID '<BUG-ID>' aparece en N features; re-invocá con --feature <folder>"`.

3. Extraer el `<feature>` del path del target (`.docs/features/<feature>/BUGS.md` → `<feature>`).
4. Validar estado: si el entry ya tiene `Status: [x] fixed` → abort: `"<BUG-ID> ya está cerrado; usá /write-bugs --verify <ID> si querés re-verificar"`.

## Fase 2 — Construir contexto

Lecturas en paralelo (un solo mensaje, varios `Read`/`Bash`):

1. **Entry del bug** — extraer el bloque entre `## <BUG-ID> —` y el próximo `## ` (o el final del archivo):
   ```bash
   awk '/^## <BUG-ID> —/,/^## /' .docs/features/<feature>/BUGS.md
   ```
2. **`PLAN.md`** completo del feature.
3. **Epic relevante** — si el entry menciona `"Epic N.M"` o `"epic-N-"` en cualquier sección, leer ese `.docs/features/<feature>/epic-N-*.md`. Si no se puede inferir, listar todos los `epic-*.md` y leer los que mencionen el área técnica del bug.

Producir un resumen **interno** (no se imprime todavía) con:

- Síntoma (1 línea) + comportamiento esperado (1 línea).
- Criterios de aceptación literales del entry (la lista `- [ ]`).
- Repro steps con el seed user exacto.
- Qué prometía entregar la feature/epic donde nació el bug — para no romper otros criterios al fixear este.

## Fase 3 — Investigar el código

Lanzar **un** subagente `Explore` con foco en los archivos/símbolos que la sección **Technical description** del entry menciona. Si esa sección es vaga, usar la **Hypothesis** como punto de partida. Si las dos son vagas, usar los **Reproduction steps** para inferir el flow y mapear `app/` y `supabase/`.

Pedirle al Explore que devuelva, en ≤ 300 palabras:

- Causa raíz hipotética (1 frase falsifiable).
- Archivos exactos a tocar con `path:line` y qué cambia en cada uno.
- Cualquier archivo adyacente que pueda romperse y que valga la pena revisar.

Si el Explore reporta evidencia que **contradice** la `Hypothesis` del entry, registrarlo: el plan de Fase 4 va a corregir la causa raíz, no la hipótesis original.

## Fase 4 — Plan + gate de confirmación

Imprimir al usuario un bloque exactamente con este shape:

```
## Plan de fix — <BUG-ID>

**Causa raíz:** <1 línea, falsifiable>

**Archivos a tocar:**
  - <path>:<line> — <qué cambia>
  - <path>:<line> — <qué cambia>

**Skills a invocar (en orden):**
  1. /<skill> — para <propósito>
  2. /<skill> — para <propósito>

**Criterios de aceptación (del entry):**
  - [ ] <criterio 1>
  - [ ] <criterio 2>
```

Inmediatamente después invocar `AskUserQuestion` con la pregunta `"¿Proceder con este plan?"` y opciones `Proceder` / `Cambiar approach` / `Abortar`. **No tocar ningún archivo de código antes de que el usuario elija `Proceder`.** Si elige `Cambiar approach`, volver a Fase 3 con la nota del usuario. Si elige `Abortar`, salir sin tocar nada.

## Fase 5 — Ejecutar el fix (multi-skill secuencial)

Tabla de routing determinista — la skill elige cuál(es) invocar según la naturaleza del fix:

| Naturaleza del cambio                                               | Skill a invocar         |
| ------------------------------------------------------------------- | ----------------------- |
| Lógica pura en `.ts` (hooks, mappers, fetchers, ViewModels, utils)  | `/tdd`                  |
| JSX en `*View.tsx` o componente compuesto bajo `components/`        | `/aurora-ui`            |
| Política RLS / permisos / acceso row-level en Supabase              | `/supabase-rls-policy`  |
| Cambio de schema (tabla nueva, columna nueva, drop)                 | `/supabase-db-manager`  |
| Migración SQL declarativa pura (sin policies, sin schema discovery) | `/supabase-migration`   |
| Nueva entidad de dominio compartida (`app/controllers/[Entity]/`)   | `/fetch-entity`         |
| Nueva página/ruta                                                   | `/new-page`             |
| Atomo de UI faltante (Badge, Tabs, Tooltip, etc.)                   | `/shadcn`               |
| Mix de varios                                                       | secuencia en este orden |

Reglas:

1. Por cada skill listada en el plan, **anunciar primero** (`"Invocando /<skill> para <propósito>"`) y después llamarla. No paralelizar — el orden importa (ej. el schema cambia antes que la policy, la policy antes que el hook que la consume).
2. Si la tabla no cubre el caso (typo, copy fix, comment-only) → permitido edit directo, respetando `.claude/typescript.md` (Rules 1–5), `.claude/viewmodel-architecture.md`, y `.claude/controllers-architecture.md`. Declarar en el reporte final: `"Edit directo sin skill — razón: <typo|copy|comment>"`.
3. **Nunca editar un `.ts` sin pasar por `/tdd`** — regla dura del repo (`CLAUDE.md`, "Test-Driven Development").
4. **Nunca editar JSX en `*View.tsx` sin pasar por `/aurora-ui`** — regla dura del repo (`CLAUDE.md`, "Aurora UI fidelity").

## Fase 6 — Verificación via `/playwright-uat` (loop ≤ 2 iteraciones)

Construir la mini-spec exigida por `/playwright-uat` directamente desde el entry del bug:

- **Role** — el seed user de los Reproduction steps (ver tabla en `.claude/skills/playwright-uat/SKILL.md`).
- **Flow** — los Reproduction steps literales.
- **Success criterion** — "el síntoma del entry NO ocurre **y** se observa el comportamiento esperado del entry".

Loop, máximo **2 iteraciones**:

1. Invocar `/playwright-uat` con la mini-spec. Comprimirla con `/caveman` si pasa de ~10 líneas.
2. Si `/playwright-uat` confirma el success criterion → ir a Fase 7.
3. Si reporta el mismo síntoma:
   - Si esta era la iteración 1: re-correr Fase 3 (Explore) con la nueva evidencia del UAT (snapshot, console errors, network failures), re-planificar **sin** pedir confirmación (el gate de Fase 4 ya se gastó), y re-ejecutar Fase 5 con el plan actualizado. Volver al paso 1.
   - Si esta era la iteración 2: activar **escape hatch #1**:
     - Editar `BUGS.md` agregando bajo el `**Found:**` del entry: `**Re-observed on <YYYY-MM-DD>** during /fix-bug — <causa raíz aparente>`.
     - **No** invocar `/write-bugs --verify`.
     - **No** commitear.
     - Reportar al humano: causa raíz aparente, qué se intentó en cada iteración, archivos que quedaron modificados, próximo paso sugerido.
     - Salir.

## Fase 7 — Cierre durable + commit atómico

1. Invocar `/write-bugs --verify <BUG-ID>`. Esta skill re-corre la repro y, si pasa:
   - Flippea `Status: [ ] fixed` → `Status: [x] fixed`.
   - Tickea cada `- [ ]` en "Acceptance criteria".
   - Agrega `**Verified fixed on <YYYY-MM-DD>** by re-running <flow>.`
2. Si `/write-bugs --verify` reporta que sigue reproduciéndose (no debería tras Fase 6, pero defensivo) → tratar como falla de Fase 6 iteración 2: activar escape hatch #1.
3. Correr los gates de "Finishing work" de `CLAUDE.md` en orden:
   ```bash
   npx prettier --write .
   npm run lint
   ```
   Si lint falla → fixear y re-correr. **No commitear con lint en rojo.**
4. Commit **único** con código + `BUGS.md` actualizado:

   ```bash
   git add -A   # o paths específicos si hay archivos no relacionados sueltos
   git commit -m "$(cat <<'EOF'
   fix(<feature>/<BUG-ID>): <síntoma resuelto, una línea>

   <2-3 líneas: causa raíz + qué se cambió>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

5. Reportar al usuario: `<BUG-ID>` cerrado, commit `<sha>`, archivos tocados, skills invocadas en orden.

## Final checklist

- [ ] `<BUG-ID>` provisto explícitamente; sin arg → la skill abortó pidiéndolo.
- [ ] Fase 1: feature folder resuelto (vía `--feature` o grep único); entry estaba abierto.
- [ ] Fase 2: entry del bug + `PLAN.md` + epic relevante fueron leídos antes de planificar.
- [ ] Fase 3: causa raíz se basa en evidencia del Explore, no solo en la hipótesis original del entry.
- [ ] Fase 4: plan impreso + `AskUserQuestion` antes de tocar código.
- [ ] Fase 5: cada skill invocada fue anunciada en orden; ningún `.ts` se editó sin `/tdd`; ningún `*View.tsx` se editó sin `/aurora-ui`.
- [ ] Fase 6: `/playwright-uat` corrió ≤ 2 veces; si la 2ª falló, escape hatch #1 declarado, **sin commit**.
- [ ] Fase 7 (camino feliz): `/write-bugs --verify <BUG-ID>` flippeó el estado; `prettier` y `lint` pasaron; commit único `fix(<feature>/<BUG-ID>): …` con co-author trailer.
