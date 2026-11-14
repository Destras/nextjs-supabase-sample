---
name: to-epics
description: Break a PLAN.md inside .docs/features/<feature>/ into per-epic implementation files. Reads the feature folder, parses epics and tasks, runs one /grill-me session per epic to refine technical decisions with the user, and writes epic-N-slug.md alongside the PLAN. Each epic file embeds tasks as <task> blocks with <name>, <action> (low-level technical plan), and <acceptance_criteria>. Use when user wants to convert a PLAN.md into epic files, break down a feature plan into per-epic implementation specs, expand epics from a plan, or invokes /to-epics.
---

# To Epics

Convert a high-level `PLAN.md` into one detailed markdown file per epic, designed to be consumed by a downstream implementation skill.

## Quick start

```
/to-epics <feature-folder-name>
```

Example: `/to-epics pacientesModule` → reads `.docs/features/pacientesModule/PLAN.md`, writes `epic-1-shared-setup.md`, `epic-2-...md`, etc. in the same folder.

If no argument is passed, list features under `.docs/features/` and ask the user to pick one with `AskUserQuestion`.

## Workflow

### 1. Resolve and parse

- Read `.docs/features/<feature>/PLAN.md`. If missing, abort with `"<feature>/PLAN.md not found. Available features: <list>"`.
- Parse natively (no scripts). See **Parsing rules** below.

### 2. Load project conventions

Read these once into context — they feed every `<action>`:

- `CLAUDE.md` (root)
- `.claude/sql-style-guide.md`
- `.claude/supabase-declarative-database-schema.md`
- `.claude/typescript.md`
- `.claude/viewmodel-architecture.md`
- `.claude/controllers-architecture.md`
- `.claude/ui-components.md`
- `.claude/testing.md`

### 3. For each epic, sequentially

1. Compute destination path: `epic-<N>-<slug>.md` (slug = kebab-case of epic name, e.g. `Patient CRUD & History` → `patient-crud-history`).
2. **If the file already exists** → `AskUserQuestion` with options:
   - `Skip` — leave intact, move on
   - `Overwrite` — regenerate from scratch
   - `Merge` — show existing file beside new draft, ask which sections to preserve, build a combined draft, confirm before writing
3. Build a per-epic briefing in context: the epic block + its tasks + acceptance criteria + deliverable descriptions + the project conventions.
4. **Invoke `Skill { grill-me }`** — the same agent shifts mode and interviews the user about unresolved technical decisions for this epic (DB choices, routing/wizard shape, server actions vs entity hooks, RLS shape, email copy ownership, etc.). One grilling session covers all tasks of the epic.
5. **Close the grilling**: when the relevant branches feel resolved, show a structured summary of decisions taken, then `AskUserQuestion` with options `[Write epic file | One more question | Change decision X]`. Loop until the user picks `Write epic file`.
6. Draft the epic file (see **Epic file format**) using grilling decisions as the primary input for each task's `<action>`. Reference grilling decisions inline as `per DEC-XX` when useful (`DEC-` to avoid colliding with the PLAN's `D-N` deliverable IDs).
7. `Write` to the destination path.

### 4. Final summary

Print which files were created, skipped, or overwritten. Suggest the next step (typically: invoke the downstream implementation skill, or `/to-issues` to turn epics into tickets).

## Epic file format

```markdown
# Epic <N> — <Epic Title>

> Feature: <feature> · Generated from PLAN.md

## Plan title

<General plan title — defaults to the epic title>

## CEO objective

<2-4 paragraphs in Spanish, narrated as if explaining to the CEO:

- What is achieved when this epic is done
- What the therapist / admin / end user can now do that they couldn't before
- Relevant technical implementations translated to business impact
  (e.g. "Resend integrado → emails de activación llegan automáticamente",
  "RLS endurecida → datos sensibles de diagnóstico solo visibles al terapeuta asignado")>

## Deliverables cubiertos

- **D-N** — <description from the PLAN's Matriz de cobertura de deliverables>
- **D-M** — <description>

## Tasks

<task>
<name>Task <N.M> — <task name></name>
<action>
<Dense technical prose: tables, paths, function/policy names, hooks to compose,
referenced grilling decisions (per DEC-XX), patterns to follow. Built by combining
the task description, user flow, secondary flows, acceptance criteria, the grilling
decisions, the project conventions, and the concrete stack (Next.js App Router,
Supabase, shadcn, Resend).
DO NOT embed TDD or Playwright UAT instructions — those gates are global
mandates in CLAUDE.md and apply to every task; the implementation skill picks
them up. Exception: if the acceptance criteria explicitly call out an
SQL/integration test, mention it in the prose.>

**Files:**

- `path/to/file1.ts` (create | edit) — <one line on what changes>
- `supabase/schemas/<table>.sql` (edit) — <what is added>

**Project rules to respect:**

- `.claude/<convention>.md` — <why it applies to this task>
  </action>
  <acceptance_criteria>
  <Copied verbatim from PLAN.md — preserve the `[ ]` checkboxes>
  </acceptance_criteria>
  </task>

<!-- repeat <task> block for every task in the epic -->
```

## Parsing rules

`PLAN.md` is generated by `/devspec-to-plan` and is written in Spanish. Read it natively and extract:

- **Epics** → lines matching `### Epic <N> — <Name>`. The epic block runs until the next `### Epic`, `## ` heading, or `---` separator. `Epic 0 — Fundación Transversal` is the blocking foundation; parse and emit it like any other epic (`epic-0-<slug>.md`).
- Inside each epic, extract the epic-level fields: `**Objetivo:**` (seeds the CEO objective — rewritten in business tone, not copied), `**Depende de:**`, `**Paralelizable con:**`, `**Bloquea:**`, `**Cubre deliverables:**`.
- **Tasks** → lines matching `#### Task <N.M> — <Name>` inside an epic block.
- For each task, extract these labeled fields:
  - `**Descripción:**` → short prose, what the task does
  - `**Flujo de usuario:**` → the happy-path user flow (or `N/A — task de infraestructura`)
  - `**Flujos secundarios:**` → edge-case flows (or `Ninguno`)
  - `**Criterios de aceptación:**` → the list of `- [ ] ...` bullets immediately below
  - `**Bloqueadores:**` → free-form (e.g. `Task 0.1` or `Ninguno`)
  - `**Referencia DevSpec:**` → DevSpec section refs (`§X.Y`) + deliverable IDs (`D-N`)
  - `**Prioridad:**` → `Alta` / `Media` / `Baja`
- **Matriz de cobertura de deliverables** → the `## 2. Matriz de cobertura de deliverables` table. Cross-reference each `D-N` to enrich the description shown in the epic's `## Deliverables cubiertos` section.

`**Descripción:**`, `**Flujo de usuario:**` and `**Flujos secundarios:**` are primary raw material for the `<action>` block — see the Action drafting guide.

If a heading does not match exactly, fall back to the closest sensible match and continue; do not abort.

> **Nota — formato legacy.** `pacientesModule/PLAN.md` usa el formato viejo en inglés (`**REQs covered:**`, `**Acceptance criteria:**`, sección `Requirements Matrix`). Este parser apunta al formato nuevo que produce `/devspec-to-plan`. `pacientesModule` ya tiene sus `epic-N-*.md` generados, así que no se re-corre `/to-epics` sobre él.

## Action drafting guide

The `<action>` is the heart of each task. Build it by stacking four inputs:

1. **Acceptance criteria** — what "done" looks like
2. **Grilling decisions** — what was undecided in the PLAN and got resolved during the per-epic grilling
3. **Project conventions** — the architectural rules that constrain the implementation (controllers barrel, ViewModel separation, declarative schema, shadcn primitives)
4. **Stack reality** — actual paths, table names, helper modules in this repo

### End-to-end example — Task 1.3 (Shared entity hooks for treatment stages and levels)

PLAN.md (L88-97) says: "exports a typed `EtapaTratamiento` entity, a barrel, and a `useFetchEtapasByPaciente(pacienteId)` hook... follow the existing pattern used by `useFetchPacientesByTerapeuta`."

The resulting `<action>` looks like:

```
<action>
Crear dos shared-entity controllers nuevos siguiendo el patrón de
`app/controllers/Paciente/` (per `.claude/controllers-architecture.md` Rule 5):
una entidad por tabla — `EtapaTratamiento` para `etapas_tratamiento`, `Nivel`
para `niveles`.

Para `EtapaTratamiento/`: declarar la interfaz dominio `EtapaTratamiento` en
`EtapaTratamientoTypes.ts` (campos del row de DB mapeados a camelCase: `id`,
`pacienteId`, `numero`, `estado`, `fechaInicio`, `fechaCierre`). El raw row
type queda privado en `utils/mapEtapaRow.ts` y NO se re-exporta desde el
barrel. La query Supabase vive en `api/fetchEtapasByPaciente.ts` y aplica el
mapper antes de devolver `EtapaTratamiento[]`. El hook público
`useFetchEtapasByPaciente(pacienteId)` vive en `api/useFetchEtapasByPaciente.ts`
con la misma forma que `useFetchPacientesByTerapeuta` — `{ etapas, isLoading,
error }`, useState + useEffect + `createClient()` del cliente browser. El
`index.ts` exporta solo `EtapaTratamiento` (type) y el hook.

Para `Nivel/`: misma estructura, mapeando `niveles` a la entidad `Nivel`. El
hook recibe `etapaId`.

Antes de declarar los types a mano, regenerar `types/supabase.ts` con
`supabase gen types typescript --linked > types/supabase.ts` y usar las filas
generadas como base del mapper (per `.claude/typescript.md` — no `any` para
DB responses).

**Files:**
- `app/controllers/EtapaTratamiento/EtapaTratamientoTypes.ts` (create) — interfaz dominio
- `app/controllers/EtapaTratamiento/utils/mapEtapaRow.ts` (create) — raw row → dominio
- `app/controllers/EtapaTratamiento/api/fetchEtapasByPaciente.ts` (create) — query Supabase
- `app/controllers/EtapaTratamiento/api/useFetchEtapasByPaciente.ts` (create) — hook
- `app/controllers/EtapaTratamiento/index.ts` (create) — barrel
- `app/controllers/Nivel/NivelTypes.ts` (create)
- `app/controllers/Nivel/utils/mapNivelRow.ts` (create)
- `app/controllers/Nivel/api/fetchNivelesByEtapa.ts` (create)
- `app/controllers/Nivel/api/useFetchNivelesByEtapa.ts` (create)
- `app/controllers/Nivel/index.ts` (create)
- `types/supabase.ts` (regenerate)

**Project rules to respect:**
- `.claude/controllers-architecture.md` — Rules 1, 3, 4, 5 (barrel, entity folder shape, types file, raw-row stays private)
- `.claude/typescript.md` — Rules 1-3 (no inline exports, arrow fns only, `export type { ... }`)
</action>
```

Notice what the action does NOT include: no "Tests first:" section, no "Playwright UAT plan:" section. TDD and UAT are global gates (CLAUDE.md) — the implementation skill applies them; embedding them per-task is redundant.

## Project conventions cheat-sheet

One-line reminders for the `<action>` to reference correctly:

- `.claude/sql-style-guide.md` — lowercase SQL keywords, `public.` prefix, snake_case + plural tables
- `.claude/supabase-declarative-database-schema.md` — schema lives in `supabase/schemas/`, migrations are generated via `supabase db diff`
- `.claude/typescript.md` — single export block at file bottom, arrow functions only, `export type { ... }` for types
- `.claude/viewmodel-architecture.md` — all logic in `use[Page]ViewModel.ts`; Views are pure JSX
- `.claude/controllers-architecture.md` — barrel-only imports, raw DB rows never leave the entity folder, ViewModels never call `supabase` directly
- `.claude/ui-components.md` — atomic UI components ALWAYS come from shadcn; never build buttons/inputs from scratch
- `.claude/testing.md` — Jest only on `.ts` files; one `expect` per test; `renderHook` for custom hooks

**Do not embed TDD or Playwright UAT instructions inside individual `<action>` blocks.** Those are project-wide gates in `CLAUDE.md` that the downstream implementation skill enforces uniformly.

## Re-runs (skip / overwrite / merge)

When an `epic-<N>-<slug>.md` already exists, ask the user with `AskUserQuestion`:

- **Skip** — leave the file untouched, move to the next epic. Use this when manual edits should be preserved as-is.
- **Overwrite** — regenerate from scratch. Re-runs the per-epic grilling. Manual edits are lost.
- **Merge** — read the existing file, present it side-by-side with the new draft, and ask the user which sections to preserve from the existing file (CEO objective? specific task actions?). Produce a combined draft and confirm with `AskUserQuestion` before writing.

The skill is idempotent if every existing file is set to Skip.

## Edge cases

1. **Epic without an explicit `**Objetivo:**`** → use the first sentence of the epic block as the seed.
2. **Task without `**Criterios de aceptación:**`** → write `<acceptance_criteria>None defined in PLAN.md — to be defined</acceptance_criteria>` and warn the user at the end.
3. **`D-N` not found in the Matriz de cobertura de deliverables** → emit a warning; render just the ID without description.
4. **Cross-epic task dependency** → with vertical-slice epics, tasks in Epics 1..N should depend only on Epic 0 tasks (legitimate and expected). If a `**Bloqueadores:**` field references a task from another Epic 1..N, annotate it in the `<action>` prose (e.g. _"Requires Task 0.1 from `epic-0-fundacion-transversal.md`"_) **and** flag it to the user — it may signal the PLAN's epics are not cleanly independent.
5. **No PLAN.md in the feature folder** → abort with the available-features list.
