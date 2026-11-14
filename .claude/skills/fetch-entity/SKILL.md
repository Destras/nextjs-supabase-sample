---
name: fetch-entity
description: Extends an existing shared domain entity under `app/controllers/[Entity]/` with a new fetch hook. Reads `supabase/schemas/*.sql` to understand the source tables and design the query, generates a new mapper + fetcher + hook following Rule 5 of controllers-architecture, and extends the domain interface in place when the use case requires fields that are not on it yet. Generates every `.ts` file via the TDD red→green cycle (mandatory per CLAUDE.md). Does not create new entities — if the target entity does not exist under `app/controllers/`, halts and redirects to the Rule 6 gate. Use when the user wants to fetch data for the UI and the owning entity already exists under `app/controllers/`.
---

# Fetch Entity

Extend an existing first-class domain entity under `app/controllers/[Entity]/` with the artifacts needed to serve a new fetch case: a typed raw mapper, a typed Supabase fetcher, and a typed `useFetch` hook. The domain interface is **fixed** by what `[Entity]Types.ts` already declares — when a required field is missing, the skill extends that file in place (Rule 6 of `.claude/controllers-architecture.md`). The raw DB row type is private to the new mapper and never leaves the module.

This skill **never creates new entities**. The set of first-class entities under `app/controllers/` is closed by default per Rule 6. If the target entity does not exist, the skill halts in Step 1 and redirects to the Rule 6 gate.

Use the existing [`app/controllers/Paciente/`](../../../app/controllers/Paciente/) module as the canonical reference for the shape the skill produces.

## Step 1 — Verify entity target

The skill operates only on entities that already exist under `app/controllers/`. Before doing anything else:

1. Read the target entity name from the invocation context (PascalCase singular: `Paciente`, `Terapeuta`, `Tratamiento`, `Diagnostico`, `Contenido`, `Auth`).
2. Confirm `app/controllers/[Entity]/` exists.

If the folder does not exist, **halt** and respond:

> The entity `[Name]` does not exist under `app/controllers/`. Creating new entities is reserved for the Rule 6 gate of `.claude/controllers-architecture.md` and requires explicit user approval via `AskUserQuestion`. This skill only extends existing entities — re-invoke it once the gate has run and the entity folder exists.

Do not write a single file in this case. Do not propose a name. Do not ask the user to confirm creation. Just halt.

## Step 2 — Gather use case inputs

Ask the user for (or extract from context):

1. **Use case description** — free-form natural language. Examples: "necesito el detalle de un paciente por id, con su diagnóstico actual"; "lista de terapeutas activos para el dropdown del admin"; "el tratamiento activo del paciente logueado".
2. **Cardinality** — must be explicit. `single` (returns `[Entity] | null`) or `list` (returns `ReadonlyArray<[Entity]>`). When ambiguous from the description, ask directly: "¿esperás un solo `[Entity]` o una lista?".
3. **Fields the View will consume** (optional) — if the user mentions fields not in the current interface, capture them; this drives Step 5. If omitted, the skill assumes the current interface fields cover the use case.

**Do not** ask the user for: query root, raw shape name, select string, or filters. The skill derives those in Step 4.

## Step 3 — Inspect the entity folder

List what already exists under `app/controllers/[Entity]/`:

- Open `[Entity]Types.ts` and capture the current fields of the domain interface, plus any enums (e.g. `PACIENTE_STATE`).
- List files under `utils/` — these are the existing mappers, each tied to one raw query root.
- List files under `api/` — these are the existing fetchers and hooks.
- Read `index.ts` — what is already part of the public surface.

**Duplication check.** If the use case description matches an existing fetcher/hook by intent (same query root + same cardinality + same conditionals), halt and report:

> The use case "[paraphrased description]" is already served by `useFetch[…]` in `app/controllers/[Entity]/api/`. Import and use that hook instead of adding a new one. If the existing hook is close but not enough, describe the gap and re-invoke.

Heuristic for the match: name similarity + cardinality match + conditional overlap (e.g. "por id" + `single` + filter on `id` ≈ an existing `useFetch[Entity]PorId`). Lean conservative — when in doubt, do not report duplication; continue.

## Step 4 — Inspect the database

The source of truth for the schema is the declarative SQL in `supabase/schemas/*.sql` (per `.claude/supabase-declarative-database-schema.md`). The skill reads it to derive the query, not asks the user for it.

1. Read every file under `supabase/schemas/` and build a mental model of: tables relevant to the entity, their columns, FKs, and the `comment on table` lines (which carry semantic meaning).
2. Decide:
   - **Query root** — the value for `supabase.from('...')`. May be the entity's own table (`pacientes`) or a join root (`asignaciones_paciente`).
   - **Select string** — the exact `.select('...')` expression with joins. Mirror the declared FKs.
   - **Filters / conditionals** — derived from the use case description ("por id" → `.eq('id', id).single()`; "del terapeuta actual" → `.eq('terapeuta_id', terapeutaId)`; "activos" → whatever the schema uses for the active state, often `.is('fecha_hasta', null)` or `.eq('estado', 'ACTIVO')`).
3. Derive naming for the new artifacts. The entity name is **fixed** — these are new sibling files inside the existing folder.

| Derived form     | Rule                                   | Example                           |
| ---------------- | -------------------------------------- | --------------------------------- |
| Raw type         | `[RawShape]Raw`                        | `PacienteRowRaw`, `AsignacionRaw` |
| Mapper file      | `map[RawShape]To[Entity].ts`           | `mapPacienteRowToPaciente.ts`     |
| Mapper function  | `map[RawShape]To[Entity]`              | `mapPacienteRowToPaciente`        |
| Fetcher file     | `fetch[Entity][Conditionals].ts`       | `fetchPacientePorId.ts`           |
| Hook file        | `useFetch[Entity][Conditionals].ts`    | `useFetchPacientePorId.ts`        |
| Hook function    | `useFetch[Entity][Conditionals]`       | `useFetchPacientePorId`           |
| Hook result type | `UseFetch[Entity][Conditionals]Result` | `UseFetchPacientePorIdResult`     |

`[RawShape]` is the PascalCase singular of the query root (or a more descriptive name when joins make it not obvious — e.g. `PacienteConTratamientoActivo`). `[Conditionals]` is a short PascalCase phrase reflecting the filters ("PorId", "Asignados", "ConTratamientoActivo", "Activos").

**Optional verification.** If the Supabase MCP is connected, call `mcp__supabase__list_tables` to confirm the query root and joined tables exist in the remote schema. If you detect drift between the declarative schema and the remote, flag it and proceed with the declarative version as authoritative — fixing drift is out of scope for this skill.

## Step 5 — Confirm the plan with the user

Before generating any file, present a short plan and wait for explicit confirmation. The plan must include:

- The target entity folder.
- The query root + the full select string (formatted readably).
- Filters + cardinality.
- The list of files that will be generated, with their final names (per Step 4 naming table).
- Whether `[Entity]Types.ts` will be extended in place (Step 6) and which fields will be added, if any.

Wait for the user to say "ok" (or equivalent). If they push back, adjust and re-confirm. Do not skip this step — DB introspection can pick the wrong join or root, and one pause here saves three rotten files later.

## Step 6 — Resolve interface extension (Eje 1c)

Compare the fields the use case requires against the current shape of `[Entity]Types.ts`:

- **(a)** Field is already on the interface and the existing mapper populates it → nothing to do here.
- **(b)** Field is on the interface but is returned as `null` / default by existing mappers → that's expected; the new mapper (Step 7) will populate it from the richer query.
- **(c)** Field is **not** on the interface → extend `[Entity]Types.ts` in place. Add the new `readonly` field; if it's optional, type it as `T | null`. Re-export remains unchanged (the type is already re-exported from `index.ts`). Update the catalog in Step 8 to reflect the new field.

Rule 6 explicitly authorizes extending the domain type in place — no `AskUserQuestion` needed for (c). If the field requires a new enum (e.g. a new `state` value), define the enum value in `[Entity]Types.ts` next to the existing enum.

**Constraint:** never fork the interface. Never add a parallel type like `PacienteConTratamiento extends Paciente`. The interface stays single per entity.

## Step 7 — Generate files via TDD (one cycle per file)

Every `.ts` file generated here falls under the mandatory TDD rule of CLAUDE.md. Run a strict red→green cycle per file, in this order: mapper → fetcher → hook. Every test must follow `.claude/testing.md` — one `expect` per test, whole-object comparison, single `beforeEach` per `describe`, `renderHook` for hooks, factory mocks via direct cast (`(X as jest.Mock).mockReturnValue(...)`).

For each file:

1. Write `[file].test.ts` first with the cases the impl must satisfy (every logical branch, per Testing Rule 6).
2. Run `npm run test -- [file].test.ts`. **Confirm red.** If green by accident (e.g. asserting something the impl already satisfies trivially), the test is wrong — rewrite.
3. Write `[file].ts`.
4. Run `npm run test -- [file].test.ts`. **Confirm green.**
5. If green is not reached in two iterations, **halt** and report. Do not paper over a failing test by weakening the assertion.

If Jest itself fails to run (env broken, missing deps), halt and report. The skill assumes a working test environment; it does not try to repair it.

### `app/controllers/[Entity]/utils/map[RawShape]To[Entity].ts`

Private raw type + mapper. The raw type lives here and is **not** re-exported from `index.ts`. Mapper has an explicit `: [Entity]` return type. Raw type fields are `readonly`.

```ts
import type { Paciente } from '../PacienteTypes'

interface PacienteRowRaw {
  readonly id: string
  readonly nombre: string
  readonly fecha_alta: string
  readonly etapas_tratamiento: ReadonlyArray<{
    readonly id: number
    readonly fecha_finalizacion: string | null
  }>
}

const mapPacienteRowToPaciente = (raw: PacienteRowRaw): Paciente => {
  const activeEtapa = raw.etapas_tratamiento.find(
    (e) => e.fecha_finalizacion === null,
  )
  return {
    id: raw.id,
    nombre: raw.nombre,
    activeEtapaId: activeEtapa?.id ?? null,
    tratamientos: [],
    nivelActual: null,
    ultimaEvaluacion: null,
    fechaInicioTratamiento: raw.fecha_alta,
    state: 'ACTIVE',
  }
}

export type { PacienteRowRaw }
export { mapPacienteRowToPaciente }
```

### `app/controllers/[Entity]/api/fetch[Entity][Conditionals].ts`

Supabase query. Arrow function with explicit return type. Calls the mapper. Returns `Promise<{ data: ReadonlyArray<[Entity]> | null; error: Error | null }>` for lists, or `Promise<{ data: [Entity] | null; error: Error | null }>` for singles.

```ts
'use client'

import { createClient } from '@/lib/supabase/client'
import type { PacienteRowRaw } from '../utils/mapPacienteRowToPaciente'
import { mapPacienteRowToPaciente } from '../utils/mapPacienteRowToPaciente'
import type { Paciente } from '../PacienteTypes'

const fetchPacientePorId = async (
  pacienteId: string,
): Promise<{ data: Paciente | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pacientes')
    .select(
      `id, nombre, fecha_alta, etapas_tratamiento ( id, fecha_finalizacion )`,
    )
    .eq('id', pacienteId)
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return {
    data: mapPacienteRowToPaciente(data as unknown as PacienteRowRaw),
    error: null,
  }
}

export { fetchPacientePorId }
```

### `app/controllers/[Entity]/api/useFetch[Entity][Conditionals].ts`

Hook with explicit `UseFetch…Result` return type. All envelope fields `readonly`. Arrays as `ReadonlyArray<T>`. Inner `load = async () => {}` is exempt from the explicit-return-type rule (it's nested inside the hook body, not module-scope).

```ts
'use client'

import { useEffect, useState } from 'react'
import type { Paciente } from '../PacienteTypes'
import { fetchPacientePorId } from './fetchPacientePorId'

interface UseFetchPacientePorIdResult {
  readonly data: Paciente | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchPacientePorId = (
  pacienteId: string | null,
): UseFetchPacientePorIdResult => {
  const [data, setData] = useState<Paciente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const { data, error: fetchError } = await fetchPacientePorId(pacienteId)

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setData(data)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [pacienteId])

  return { data, isLoading, error }
}

export type { UseFetchPacientePorIdResult }
export { useFetchPacientePorId }
```

For a list hook, replace `Paciente | null` with `ReadonlyArray<Paciente>` and the initial state with `useState<ReadonlyArray<Paciente>>([])`.

## Step 8 — Update barrel + catalog (no commit)

Two final edits, kept atomic in working tree (the skill does **not** commit — the agent invoking the skill, or the developer, owns the commit). Both must land in the same commit when the developer commits, per the same-commit rule of Rule 6.

### `app/controllers/[Entity]/index.ts`

Add the new hook (and its result type, if useful to consumers) to the existing exports. Never re-export the raw type, the mapper, or the bare fetcher.

```ts
export type { Paciente } from './PacienteTypes'
export type { PACIENTE_STATE } from './PacienteTypes'
export type { UseFetchPacientesByTerapeutaResult } from './api/useFetchPacientesByTerapeuta'
export { useFetchPacientesByTerapeuta } from './api/useFetchPacientesByTerapeuta'
export type { UseFetchPacientePorIdResult } from './api/useFetchPacientePorId'
export { useFetchPacientePorId } from './api/useFetchPacientePorId'
```

### `.claude/controllers-entities.md`

Update the section for `[Entity]` to reflect:

- The new hook in the **Public API** bullet list (signature + one-line description).
- Any new fields added to the interface in Step 6c (extend the field table; mark new fields with their semantic meaning).
- The **Status** line if the entity transitioned (e.g. from "types only" to "types + read hook").

If the doc and the barrel were already out of sync **before** this run (drift accumulated from a prior change that skipped this step), flag it explicitly in the final report — "the catalog was already stale on entries X, Y; I've patched them along with the new entry" — and patch the prior drift in the same edit. The barrel is authoritative; the doc gets reshaped to match.

Final report to the user must include:

1. Files created (full paths).
2. Files modified (`[Entity]Types.ts` if Step 6c fired; `index.ts`; `.claude/controllers-entities.md`).
3. TDD status: every test green.
4. Reminder: "todo en working tree, commit pendiente — el catálogo y los archivos deben ir en un solo commit per Rule 6."

## Checklist

Before reporting done, verify every item:

- [ ] Step 1 ran first — `app/controllers/[Entity]/` was confirmed to exist; skill did not create the folder.
- [ ] Step 5 confirmation happened — user explicitly approved the plan before any file was written.
- [ ] Domain interface (`[Entity]Types.ts`) was extended in place when fields were missing; no parallel interface was created.
- [ ] Every field of the domain interface is `readonly` (including any newly added ones).
- [ ] Raw row type lives inside `utils/map[…].ts` and is **not** exported from `index.ts`.
- [ ] Mapper is an arrow function with explicit `: [Entity]` return type.
- [ ] Fetcher is an arrow function with explicit return type `Promise<{ data: ReadonlyArray<[Entity]> | null; error: Error | null }>` (or `Promise<{ data: [Entity] | null; error: Error | null }>` for single).
- [ ] Hook is an arrow function with explicit return type `UseFetch[Entity][Conditionals]Result`.
- [ ] Hook result interface has exactly three fields, all `readonly`: `data`, `isLoading: boolean`, `error: string | null`.
- [ ] `data` field is named `data` (not `pacientes`, not `entities`, not the plural entity name).
- [ ] List arrays use `ReadonlyArray<[Entity]>`, **never** `readonly [Entity][]` or `[Entity][]`.
- [ ] Hook prefix is `useFetch`, not `useGet`.
- [ ] All files use single named-export blocks at the bottom (no inline exports).
- [ ] All files use `export type { ... }` for types/interfaces.
- [ ] `index.ts` exports only the domain type, enums, the hook result type, and the hook.
- [ ] `'use client'` directive present at the top of every file under `api/`.
- [ ] For every new `.ts` file, the corresponding `.test.ts` was written first, ran red, then ran green. No file was written without its test having driven it.
- [ ] All tests comply with `.claude/testing.md`: one `expect` per test, whole-object `toEqual`, single `beforeEach` per `describe`, `renderHook` for hooks, direct-cast factory mocks.
- [ ] `.claude/controllers-entities.md` was updated to reflect the new hook and any newly added interface fields, in the same working-tree state as the code changes.
- [ ] The skill did not commit. Final report mentions the same-commit requirement of Rule 6.
