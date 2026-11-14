---
name: devspec-to-plan
description: Genera un PLAN.md accionable a partir del DevSpec.md de un feature. Use when the user wants to bajar un DevSpec a un plan de implementación, dividir el trabajo en épicas y tasks, armar el PLAN.md de un feature, o invoca /devspec-to-plan.
---

# devspec-to-plan

Transforma el **DevSpec** (cómo se construye el feature) en un **PLAN** accionable: el trabajo dividido en tasks simples, cortas y accionables, agrupadas en una sección transversal bloqueante (Epic 0) y en épicas independientes que se pueden trabajar en paralelo.

La skill **no implementa nada**: produce `.docs/features/[featureName]/PLAN.md`, el documento que después consume `/to-epics` para generar los archivos por épica. No commitea.

## Invocación

```
/devspec-to-plan [featureName]
```

`[featureName]` es el nombre de una carpeta dentro de `.docs/features/` (ej: `terapeutasModule`).

## Qué produce

Un `PLAN.md` de **alto nivel** con esta forma (detalle completo en `references/plan-template.md`):

- **Epic 0 — Fundación Transversal** — el trabajo bloqueante: sin esto ningún otro epic puede empezar.
- **Epics 1..N** — slices **independientes entre sí y paralelizables**, cada uno con sus tasks.
- Cada **task** sigue un bloque fijo de 7 campos.
- Una **Matriz de cobertura de deliverables** que garantiza que cada deliverable del DevSpec tiene al menos una task.

## Fase 0 — Resolver y validar (abort gates, en orden)

Evaluá los gates en orden. **El primero que falle aborta la skill** con el mensaje indicado.

1. **Sin `[featureName]` en los argumentos** → abortar:
   > "Falta el feature. Invocá `/devspec-to-plan [featureName]` indicando una carpeta de `.docs/features/`."
2. **`.docs/features/[featureName]/` no existe** → abortar, listando las carpetas que sí existen bajo `.docs/features/`.
3. **`.docs/features/[featureName]/DevSpec.md` no existe** → abortar:
   > "No encuentro `.docs/features/[featureName]/DevSpec.md`. Generá la DevSpec con `/product-to-dev-spec [featureName]` y volvé a correr la skill."
4. **`PLAN.md` ya existe en la carpeta** → `AskUserQuestion` con opciones `[Sobrescribir | Abortar]`. No hacés merge automático: si ya corrió `/to-epics` y hay archivos `epic-N-*.md`, sobrescribir el PLAN puede desincronizarlos — avisalo en la pregunta. Si el usuario elige `Abortar`, terminá sin escribir.

Tras los gates: leé el header del DevSpec. Si `Estado` ≠ `Approved`, **advertí** ("La DevSpec está en estado `<X>`, no `Approved` — el PLAN puede quedar desactualizado") y continuá.

## Fase 1 — Leer insumos

- `.docs/features/[featureName]/DevSpec.md` — la fuente de verdad. Leé las 19 secciones; las que más alimentan el PLAN son §1, §3, §4, §5, §6, §8, §9, §12, §13 y §15.
- `references/plan-template.md` (bundleada en esta skill) — el formato **obligatorio** de salida. Leela entera antes de escribir.
- Grounding liviano para que las descripciones de las tasks usen los nombres reales del repo: `CLAUDE.md`, `.claude/controllers-architecture.md`, `.claude/viewmodel-architecture.md`.

## Fase 2 — Derivar el desglose

### 2.1 — Extraer deliverables

De la tabla del DevSpec §3.1, listá los deliverables `D-1..D-N`. Esa lista es la **columna vertebral de la trazabilidad**: cada `D-N` debe quedar cubierto por al menos una task.

### 2.2 — Epic 0: Fundación Transversal

Epic 0 es **la única capa horizontal** del plan: el andamiaje compartido. Una pieza de trabajo entra en Epic 0 solo si pasa el **test de transversalidad**:

> ¿La necesitan **dos o más** epics de feature, o es una precondición sin la cual **ningún** epic puede empezar?

Si la respuesta es sí → Epic 0. Si solo **un** slice la usa → va dentro de ese slice (Fase 2.3), no en Epic 0. Mantener Epic 0 chico es lo que hace que los Epics 1..N sean slices verticales de verdad.

Candidatos típicos de Epic 0 (siempre pasando el test):

- Cambios de schema que **varias** páginas leen (columnas nuevas, catálogos, triggers).
- El **esqueleto** de una entidad de dominio compartida (`app/controllers/[Entidad]/`: types + barrel). Los métodos `api/` específicos de un slice se agregan en el slice, no acá.
- Setup de integraciones externas reusables (helper de Resend, secrets).
- Componentes UI compartidos por ≥2 epics: atoms de shadcn faltantes y moléculas de feature reusadas.
- Políticas RLS y role-gating de infraestructura.
- Decisiones técnicas abiertas (§16) que bloquean el diseño de **varios** slices — ver "tasks de decisión" en 2.5.

**Contra-ejemplo:** una RPC o Edge Function que **un solo** slice consume (ej: la RPC de "listar terapeutas" que solo usa la página de lista) **no** va en Epic 0 — va en el epic de ese slice, junto con su UI. Eso mantiene el slice vertical.

### 2.3 — Epics 1..N: slices independientes y paralelizables

**Esta es la decisión más importante y la más fácil de errar.** Los epics se cortan como **slices verticales** por feature, página o subsistema de negocio — **NO como capas horizontales**. Un slice vertical toca DB + backend + datos + UI de **su** feature; cada uno se puede tomar en paralelo apenas Epic 0 cierra.

- ✅ Correcto: `Epic 1 — Lista de terapeutas`, `Epic 2 — Invitación de terapeutas`, `Epic 3 — Detalle y drill-down`. Cada uno trae su propia RPC / Edge Function específica + su UI.
- ❌ Incorrecto: `Epic 1 — Base de datos`, `Epic 2 — Edge Functions`, `Epic 3 — UI`. Eso es una cadena de capas, no épicas independientes. (Epic 0 es la **única** capa horizontal permitida — ver 2.2.)

**Dependencias entre epics:**

- Todo Epic 1..N **depende de Epic 0** — es lo esperado; se declara en `**Depende de:**`.
- Entre sí, los Epics 1..N **no deberían** depender uno de otro. Si un slice necesita el output de otro slice, primero intentá mover la pieza compartida a Epic 0 (test de transversalidad, 2.2).
- Si la pieza es UI específica de feature reusada por otro slice (ej: la página de detalle reusa un modal de la página de lista) y genuinamente no puede moverse, está permitido: declará la dependencia en el `**Depende de:**` del epic y en los `**Bloqueadores:**` de la task, y avisalo en el checkpoint de Fase 3. La independencia perfecta es el objetivo, no un dogma — un plan honesto **declara** la dependencia real en vez de esconderla.

### 2.4 — Partir cada epic en tasks

Cada task es **simple, corta y accionable**. Rúbrica de granularidad:

- Una unidad cohesiva de trabajo, con un solo foco.
- Testeable / verificable de forma independiente.
- Del tamaño de aproximadamente un PR o una corrida de `task-implementor`.
- Si una task abarca dos focos **independientes**, son dos tasks. Pero piezas fuertemente acopladas que se entregan juntas (ej: un modal y su cableado en la página que lo abre) cuentan como **una sola** task — no las partas solo porque la descripción usa un "y".

Si el DevSpec trae un §15 "Plan de implementación / Breakdown de tickets", usalo como **insumo y cross-check** del desglose — pero **re-cortá** sus tickets en slices verticales: el breakdown de §15 suele venir por capas (un ticket de DB, otro de RPC, otro de UI). No lo copies tal cual.

### 2.5 — Derivar los 7 campos de cada task

Cada task se arma con estos campos, todos derivados del DevSpec:

| Campo de task                  | Fuente en el DevSpec                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `**Descripción:**`             | §3.2 detalle del deliverable; §4.2 Pages; §5.2 Components     |
| `**Flujo de usuario:**`        | §4.2 Pages (Eventos / Estados UI); §9.2 diagramas de flujo    |
| `**Flujos secundarios:**`      | §4.2 Estados UI (vacío, error); §6.4 manejo de errores        |
| `**Criterios de aceptación:**` | Given/When/Then del deliverable (§3.2) → checkboxes `- [ ]`   |
| `**Bloqueadores:**`            | análisis de dependencias (§8 datos, §9 arquitectura, §12)     |
| `**Referencia DevSpec:**`      | sección(es) `§X.Y` + deliverable `D-N`                        |
| `**Prioridad:**`               | columna Priority de la tabla §3.1 → `Alta` / `Media` / `Baja` |

Notas:

- **Flujo de usuario** es obligatorio para tasks con UI. Para tasks de infraestructura/backend sin flujo de usuario, poné `N/A — task de infraestructura`.
- **Flujos secundarios** es opcional: omitilo o poné `Ninguno` si no hay edge cases relevantes.
- **Tasks de decisión** (de §16, decisiones abiertas): no toda fila de §16 genera una task. Si la decisión ya tiene un default adoptado y no bloquea el diseño, **no** es una task — va como criterio de aceptación de la task afectada o como supuesto en §5. Si sí bloquea, es una task de decisión, ubicada por el test de transversalidad (2.2): bloquea varios slices → Epic 0; bloquea uno solo → ese slice. Una task de decisión no tiene UI ni Given/When/Then: poné `**Flujo de usuario:** N/A — task de decisión`, `**Flujos secundarios:** Ninguno`, y en `**Criterios de aceptación:**` checkboxes del tipo `- [ ] La decisión sobre <X> está tomada, documentada y comunicada al equipo`.
- **No** embebas routing de skills de implementación (`/tdd`, `/aurora-ui`, `/playwright-uat`) en las tasks. Esos son gates globales de `CLAUDE.md` que el pipeline downstream aplica solo.

### 2.6 — Matriz de cobertura y orden de ejecución

- **Matriz de cobertura**: tabla `Deliverable | Task(s) | Epic`. Cada `D-N` aparece con al menos una task.
- **Orden de ejecución**: diagrama de texto que muestra Epic 0 primero, luego los Epics 1..N (todos dependientes de Epic 0) y, dentro de cada uno, las dependencias task-a-task de los `**Bloqueadores:**`.

## Fase 3 — Checkpoint de estructura

Antes de escribir el archivo, presentá el desglose propuesto con `AskUserQuestion`:

- La lista de epics (Epic 0 + Epics 1..N) con el contenido de Epic 0 y el conteo de tasks por epic.
- Si hay splits genuinamente ambiguos (dónde cortar un epic, si dos tasks son una sola, qué entra en Epic 0), agregá preguntas batcheadas — **máximo 4**, cada una con una recomendación.

No re-grilles lo técnico: el grilling profundo por épica lo hace `/to-epics` después. Este checkpoint es solo para confirmar el límite de las épicas.

## Fase 4 — Escribir el PLAN.md

Escribí `.docs/features/[featureName]/PLAN.md` siguiendo `references/plan-template.md` al pie:

- Las 5 secciones, en orden: `1. Resumen`, `2. Matriz de cobertura de deliverables`, `3. Epics y tasks`, `4. Orden de ejecución`, `5. Riesgos y supuestos`.
- Headings exactos: `### Epic N — <Nombre>` y `#### Task N.M — <Nombre>` (los parsea `/to-epics`).
- Cada epic con sus campos: `**Objetivo:**` y `**Cubre deliverables:**` en todos; Epic 0 además lleva `**Bloquea:**`; los Epics 1..N además llevan `**Depende de:**` y `**Paralelizable con:**`.
- Cada task con los 7 campos en el orden del template.
- Todo el documento **en español**.
- El header: `> Generado desde DevSpec.md · <fecha de hoy>`.

## Fase 5 — Verificar (gate) y reportar

Auto-chequeá el PLAN antes de devolver el control:

- [ ] Las 5 secciones presentes y en orden.
- [ ] Existe `### Epic 0` y está marcado como bloqueante (`**Bloquea:**`).
- [ ] Todo `### Epic 1..N` declara `**Depende de:** Epic 0`; cualquier dependencia entre Epics 1..N está declarada explícitamente y minimizada.
- [ ] Cada `D-N` del DevSpec §3 aparece en la Matriz de cobertura con ≥1 task.
- [ ] Cada task tiene los 7 campos y los `**Criterios de aceptación:**` son checkboxes `- [ ]`.
- [ ] Headings con la sintaxis exacta `### Epic N —` / `#### Task N.M —`.

Reportá al usuario, en lenguaje natural: la ruta del archivo, cantidad de epics y tasks, deliverables cubiertos, las decisiones del checkpoint, cualquier ítem del checklist sin cerrar. Recordá que **la skill no commitea** y que el paso siguiente es `/to-epics [featureName]`.

## Reglas

- **No commitear.** La skill solo escribe `PLAN.md`.
- **Feature = argumento obligatorio.** Sin `[featureName]` se aborta.
- **Generación inline**, sin subagentes.
- **Output en español.**
- **Epics 1..N = slices verticales independientes**, nunca capas horizontales. Epic 0 es la única capa horizontal permitida.
- **Todo Epic 1..N depende de Epic 0.** Las dependencias entre Epics 1..N se evitan; si son inevitables, se declaran explícitamente.
- **No embeber routing de skills** (`/tdd`, `/aurora-ui`, etc.) en las tasks.

## Errores comunes

| Error                                         | Corrección                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Cortar épicas por capa (DB / backend / UI)    | Cortar por slice vertical de feature; cada Epic 1..N toca todas las capas de su slice.               |
| Meter en Epic 0 backend que usa un solo slice | Epic 0 = solo lo que pasa el test de transversalidad (≥2 epics o precondición de todos).             |
| Dependencia oculta entre Epics 1..N           | Si un slice reusa output de otro, moverlo a Epic 0; si no se puede, declararlo en `**Depende de:**`. |
| Tasks como filas de tabla                     | Cada task es un bloque `#### Task N.M —` con los 7 campos.                                           |
| Omitir `**Flujo de usuario:**`                | Obligatorio en tasks con UI; `N/A — task de infraestructura` solo si no hay flujo.                   |
| Meter `/tdd` o `/aurora-ui` en las tasks      | Son gates globales; el pipeline los aplica solo. No van en el PLAN.                                  |
| Escribir el PLAN en inglés                    | El PLAN va en español, como el DevSpec.                                                              |
| Un deliverable sin task                       | Todo `D-N` debe estar en la Matriz de cobertura con ≥1 task.                                         |
