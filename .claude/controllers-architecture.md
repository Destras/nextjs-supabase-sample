# Controllers Architecture

This document defines the two-tier controller system for this project. Every page and every shared entity follows these rules without exception.

---

## Rule 1 — Suite index barrel

Every folder that constitutes a "suite" (a page's `controllers/` subfolder, a shared entity folder, etc.) must expose its public API through a single `index.ts` barrel. External modules import only from that barrel — never from internal files directly.

### ✅ Correct — import from the barrel

```ts
// page.tsx
import { usePacientesViewModel } from './controllers'

// another feature importing a shared entity
import type { Paciente } from '@/app/controllers/Paciente'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
```

### ❌ Wrong — import from internal files directly

```ts
// page.tsx
import { usePacientesViewModel } from './controllers/usePacientesViewModel'

// another feature
import type { Paciente } from '@/app/controllers/Paciente/PacienteTypes'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente/api/useFetchPacientesByTerapeuta'
```

---

## Rule 2 — Page-local controllers

Logic that belongs to a single page lives in that page's `controllers/` subfolder. **Data fetching is not page-local** — every Supabase read goes through a shared entity hook from `app/controllers/[Entity]/` (per Rule 5) which the page-local ViewModel composes. A `controllers/` subfolder under a page therefore contains the ViewModel hook and, optionally, small page-local pure utilities (form validators, derived selectors). It does **not** contain fetchers.

- One concern per file (the ViewModel hook in its own file; any page-local validator or selector in its own file)
- All files are barrel-exported from `controllers/index.ts`
- `page.tsx` and the View component import **only** from `"./controllers"` — never from individual files inside it
- BE calls are forbidden here. If the ViewModel needs to fetch data, it composes a hook from a shared entity. If no existing entity covers the data, the Rule 6 entity gate applies.

### Folder shape

```
app/
  pacientes/
    controllers/
      usePacientesViewModel.ts  ← ViewModel hook (composes entity hooks)
      index.ts                  ← barrel: re-exports the hook + its type
    PacientesView.tsx
    page.tsx
    layout.tsx
```

### ✅ Correct — page and View import from barrel; ViewModel composes entity hooks

```tsx
// app/pacientes/page.tsx
'use client'

import { usePacientesViewModel } from './controllers'
import { PacientesView } from './PacientesView'

export default function PacientesPage() {
  const vm = usePacientesViewModel()
  return <PacientesView {...vm} />
}
```

```tsx
// app/pacientes/PacientesView.tsx
import type { PacientesViewModel } from './controllers'

export function PacientesView(props: PacientesViewModel) {
  return <div>{/* purely presentational */}</div>
}
```

```ts
// app/pacientes/controllers/usePacientesViewModel.ts
import { useCurrentUserId } from '@/app/controllers/Auth'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'

const usePacientesViewModel = (): PacientesViewModel => {
  const { userId: terapeutaId, error: authError } = useCurrentUserId()
  const {
    data,
    isLoading,
    error: fetchError,
  } = useFetchPacientesByTerapeuta(terapeutaId)

  return { pacientes: data, isLoading, error: authError ?? fetchError }
}

export { usePacientesViewModel }
```

```ts
// app/pacientes/controllers/index.ts
export { usePacientesViewModel } from './usePacientesViewModel'
export type { PacientesViewModel } from './usePacientesViewModel'
```

### ❌ Wrong — page bypasses the barrel

```tsx
// app/pacientes/page.tsx
import { usePacientesViewModel } from './controllers/usePacientesViewModel' // ❌
```

### ❌ Wrong — BE call living in a page-local `controllers/` folder

```ts
// app/pacientes/controllers/fetchPacientesByTerapeuta.ts  ← ❌ does not belong here
'use client'
import { createClient } from '@/lib/supabase/client'
// ...Supabase query
```

Move it under `app/controllers/Paciente/api/` instead (Rule 5). If no existing entity owns the data, run the Rule 6 entity gate before writing.

---

## Rule 3 — Shared entity controllers

Logic and data for entities used across more than one feature suite live in `app/controllers/[EntityName]/`. The folder name is PascalCase, matching the entity name.

- One file per concern inside the entity folder (types, each BE call, any shared hooks)
- The sole public contact point is `app/controllers/[EntityName]/index.ts`
- Other features import from that index only — never from files inside the entity folder

### Folder shape

```
app/
  controllers/
    User/
      UserTypes.ts      ← all User interfaces
      fetchUser.ts      ← BE call(s) for User
      index.ts          ← single export point for User
    Product/
      ProductTypes.ts
      fetchProducts.ts
      index.ts
```

### ✅ Correct — consumer imports from entity index

```ts
// app/dashboard/controllers/useDashboardViewModel.ts
import type { User } from '@/app/controllers/User'
import { fetchUser } from '@/app/controllers/User'
```

### ❌ Wrong — consumer drills into entity internals

```ts
import type { User } from '@/app/controllers/User/UserTypes' // ❌
import { fetchUser } from '@/app/controllers/User/fetchUser' // ❌
```

---

## Rule 4 — Entity type files

All TypeScript interfaces for a shared entity live in a single file named `[EntityName]Types.ts` inside the entity folder. That file is re-exported from the entity's `index.ts`.

### ✅ Correct — one types file, exported from index

```ts
// app/controllers/User/UserTypes.ts
export interface User {
  id: string
  email: string
  displayName: string
}

export interface UserProfile extends User {
  avatarUrl: string | null
  createdAt: string
}
```

```ts
// app/controllers/User/index.ts
export type { User, UserProfile } from './UserTypes'
export { fetchUser } from './fetchUser'
```

### ❌ Wrong — types scattered across files or inlined in BE files

```ts
// app/controllers/User/fetchUser.ts
export interface User { ... }          // ❌ types must live in UserTypes.ts

// app/controllers/User/UserProfile.ts // ❌ separate file per type is wrong
export interface UserProfile { ... }
```

---

## Rule 5 — Domain entities own all Supabase interaction; raw DB types never leave the entity

Every data-bearing shared entity must have a domain interface (defined in `[EntityName]Types.ts`) that the rest of the app uses. Raw Supabase query shapes (DB join rows, generated table types used as-is) are **implementation details** that must stay hidden inside the entity's `app/controllers/[EntityName]/` folder.

### The seam

The entity module is the only place where Supabase is called and where raw rows are transformed into domain objects. Nothing outside the entity folder ever sees a raw DB row.

```
Supabase query → raw DB row → map → domain entity → ViewModel → View
                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                 this entire chain lives inside app/controllers/[EntityName]/
```

### Folder layout for entities with Supabase calls

```
app/controllers/Paciente/
  PacienteTypes.ts          ← domain interface (Paciente) — the only type callers use
  api/
    fetchPacientesByTerapeuta.ts   ← Supabase query; applies mapping; returns Paciente[]
    useFetchPacientesByTerapeuta.ts ← hook: accepts params, manages useState/useEffect, returns domain type
  utils/
    mapAsignacionToPaciente.ts   ← raw-row → Paciente transformation; AsignacionRaw defined here
  index.ts                  ← exports ONLY the domain type and the hook
```

### Rules

- Raw DB row types (e.g. `AsignacionRaw`) are defined inside `utils/` or `api/` and **never exported from `index.ts`**.
- The mapping function lives in `utils/` and returns the domain type.
- The fetch function (in `api/`) calls the mapping function and returns the domain type — callers never receive raw rows.
- The public hook (in `hooks/`) wraps the fetch function with React state; it accepts query parameters and returns the domain type.
- ViewModels call the public hook; they never call `supabase` directly for data fetching.
- **ViewModels must never call `supabase.auth.getUser()` themselves.** To resolve the currently logged-in user, always use `useCurrentUserId` from `@/app/controllers/Auth`. It is the single seam for current-user identity; no other code path is permitted.

### ✅ Correct — ViewModel calls the domain hook; raw types are invisible

```ts
// app/pacientes/controllers/usePacientesViewModel.ts
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { useCurrentUserId } from '@/app/controllers/Auth'

const usePacientesViewModel = () => {
  // The only sanctioned way to obtain the logged-in user id.
  const { userId: terapeutaId } = useCurrentUserId()

  const { pacientes, isLoading, error } =
    useFetchPacientesByTerapeuta(terapeutaId)
  return { pacientes, isLoading, error }
}
```

### ❌ Wrong — ViewModel queries Supabase and maps rows itself

```ts
// ❌ raw type leaks into the ViewModel
import type { AsignacionRaw } from './fetchPacientesByTerapeuta'

// ❌ mapping logic lives in the ViewModel
const buildPacienteRow = (row: AsignacionRaw): PacienteRow => { ... }

// ❌ ViewModel calls supabase for data
const { data } = await supabase.from('asignaciones_paciente').select(...)
setPacientes(data.map(buildPacienteRow))
```

---

## Rule 6 — Entity gate: every fetch maps to an existing entity; new entities require explicit user approval

The set of first-class domain entities under `app/controllers/` is **closed by default**. Every piece of data the UI fetches must be served by an existing entity. New entities are not created on the fly — they require explicit user approval via `AskUserQuestion` before any folder, type, or file is written.

This rule fires on two triggers:

1. **Before writing a `use[Page]ViewModel.ts`** — walk the decision tree below for each piece of data the View needs to render.
2. **Before creating any new folder directly under `app/controllers/[NewName]/`** — the gate fires unconditionally, regardless of why the folder is being created.

### The index

There are two artifacts that together describe what entities exist:

- **`.claude/controllers-entities.md`** — the **semantic catalog**. Describes what each entity covers, its public API, and the "When to use" guidance. This is the agent's first read when deciding which entity owns a piece of data.
- **`app/controllers/[Entity]/index.ts`** — the **executable truth** for each entity. Lists what the entity actually exports today.

If the two disagree, the barrel wins and the catalog must be updated in the same commit. If the agent notices a discrepancy while running the gate, it flags it explicitly in the chat and patches the catalog before continuing.

### The decision tree

For every piece of data the View needs to render, walk this tree:

```
Does the data map to one of the existing entities under app/controllers/?
(consult .claude/controllers-entities.md first; confirm against the entity's index.ts)
│
├─ Yes, and the entity already re-exports a hook that serves the use case
│    → import the hook from the entity's index.ts. Done. FREE.
│
├─ Yes, but the hook does not exist yet
│    → add the hook under app/controllers/[Entity]/api/, re-export it from index.ts.
│      Update controllers-entities.md in the same commit. FREE.
│
├─ Yes, but the entity's index.ts is empty (e.g. Contenido today)
│    → re-export the missing types from index.ts + add the hook under api/.
│      Update controllers-entities.md in the same commit. FREE.
│
└─ No, no existing entity covers this data
    │
    ├─ The data is a nested type of an existing entity
    │  (Nivel, Evaluacion, EntregaSemanal, Causa, Bloqueo, Algoritmo, …)
    │    → return the parent aggregate and let the View extract the field.
    │      Nested types NEVER get their own hook. FREE.
    │      If you genuinely need to promote the nested type to a first-class entity
    │      → GATE (see below).
    │
    └─ The data is a brand-new business concept that does not exist in any form
       (Recordatorio, Pago, Notificacion, …)
         → GATE (see below).
```

### The gate (when a new entity is required)

The agent **halts** and asks the user via `AskUserQuestion` before writing any file. The question must include this payload:

1. **Use case** — concrete description of what the screen needs to render and why.
2. **Why each existing entity does not cover it** — list all six current entities (`Auth`, `Contenido`, `Diagnostico`, `Paciente`, `Terapeuta`, `Tratamiento`) and state for each why it is not the right home.
3. **Proposal** — proposed entity name (PascalCase), 3–5 main fields, and the signature of the first hook (e.g. `useFetchRecordatoriosDelPaciente(pacienteId: string): { recordatorios: ReadonlyArray<Recordatorio>, isLoading: boolean, error: string | null }`).

The agent does not write a single file until the user has answered.

### Three concrete situations

| Situation                                                                                                 | Verdict           |
| --------------------------------------------------------------------------------------------------------- | ----------------- |
| Entity folder + `[Entity]Types.ts` exist; `index.ts` is empty. First hook needs to be added.              | **Extend (FREE)** |
| A nested type (`Nivel`, `Evaluacion`, `Causa`, etc.) needs to be promoted to a first-class entity folder. | **Gate**          |
| A brand-new concept (`Recordatorio`, `Pago`, etc.) needs to be fetched.                                   | **Gate**          |

### Catalog sync (same-commit rule)

Adding, removing, or modifying any export of `app/controllers/[Entity]/index.ts` requires updating the corresponding section of `.claude/controllers-entities.md` in the **same commit**. The catalog is part of the public surface of the entity, not an external doc that lags behind.

If the agent finds that the catalog and the barrel are already out of sync when it starts a task, it flags the discrepancy in the chat, treats the barrel as authoritative, and patches the catalog before proceeding.

### ✅ Correct — reuse the existing entity

```ts
import type { Paciente } from '@/app/controllers/Paciente'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
```

### ✅ Correct — nested type returned via parent aggregate

```ts
// The View needs the last evaluation answered. Evaluacion is a nested type of Tratamiento.
// We return the Paciente (whose `ultimaEvaluacion` field is the ISO timestamp), not Evaluacion.
const { pacientes } = useFetchPacientesByTerapeuta(terapeutaId)
// View reads paciente.ultimaEvaluacion directly.
```

### ❌ Wrong — redefining what the entity folder already owns

```ts
// ❌ duplicate domain interface in a page or component
interface Paciente {
  id: string
  nombre: string /* ... */
}

// ❌ ad-hoc Supabase query for an entity that already has a fetch hook
const { data } = await supabase.from('pacientes').select('*')
```

### ❌ Wrong — creating a new entity folder without the gate

```ts
// ❌ Agent decided on its own that "Recordatorio" deserves a folder and wrote files.
// app/controllers/Recordatorio/RecordatorioTypes.ts  ← created without AskUserQuestion
// app/controllers/Recordatorio/api/fetchRecordatorios.ts
// app/controllers/Recordatorio/index.ts
```

### ❌ Wrong — fetching a nested type with its own hook

```ts
// ❌ Evaluacion is nested in Tratamiento. It must not have its own hook.
// app/controllers/Evaluacion/  ← does not exist and must not be created;
//                                 promotion to first-class entity requires the gate.
const { evaluaciones } = useFetchEvaluacionesDelPaciente(pacienteId)
```

---

## Complete reference structure

```
app/
  controllers/                        ← shared entity controllers
    User/
      UserTypes.ts                    ← domain interface (the only type callers use)
      api/
        fetchUser.ts                  ← Supabase query → maps → returns domain type
        useFetchUser.ts               ← hook wrapping fetchUser with React state
      utils/
        mapUserRow.ts                 ← raw DB row → domain type; raw type defined here (private)
      index.ts                        ← exports domain type + hook ONLY
    Paciente/
      PacienteTypes.ts
      api/
        fetchPacientesByTerapeuta.ts
        useFetchPacientesByTerapeuta.ts
      utils/
        mapAsignacionToPaciente.ts
      index.ts

  pacientes/
    controllers/                      ← page-local controllers (no BE calls)
      usePacientesViewModel.ts        ← composes entity hooks from app/controllers/
      index.ts                        ← barrel: ViewModel hook + its type
    PacientesView.tsx
    page.tsx                          ← imports ONLY from "./controllers"
    layout.tsx

  auth/
    login/
      controllers/
        useLoginViewModel.ts
        index.ts
      LoginView.tsx
      page.tsx
      layout.tsx
```

---

## Enforcement checklist

Before adding or reviewing any page or shared entity, verify:

- [ ] Every `controllers/` folder has an `index.ts` that re-exports everything public
- [ ] Every shared entity folder under `app/controllers/` has an `index.ts`
- [ ] `page.tsx` imports the ViewModel hook from `"./controllers"` only — no direct file paths inside `controllers/`
- [ ] View components import the ViewModel type from `"./controllers"` only
- [ ] Cross-feature consumers import shared entities from `"@/app/controllers/[EntityName]"` only
- [ ] All interfaces for a shared entity are in `[EntityName]Types.ts`, not scattered
- [ ] No module outside a folder imports from any file inside that folder except its `index.ts`
- [ ] Raw DB row types are defined inside the entity's `utils/` or `api/` subfolder and **not** re-exported from `index.ts`
- [ ] Supabase queries live in `api/` inside the entity folder — never in a ViewModel
- [ ] No page-local `controllers/` folder contains a fetcher or any BE call — page-local controllers hold only the ViewModel hook and optional pure utilities
- [ ] The entity `index.ts` exports only the domain type and the public hook — nothing raw
- [ ] ViewModels call the entity hook and never query `supabase` directly
- [ ] To get the logged-in user id, ViewModels call `useCurrentUserId` from `@/app/controllers/Auth` — never `supabase.auth.getUser()` inline
- [ ] Before introducing a new domain interface or query, you checked `app/controllers/[EntityName]/` for an existing one
- [ ] Before writing a `use[Page]ViewModel.ts`, you walked the Rule 6 decision tree for every piece of data the View renders, mapping each one to an existing entity
- [ ] No new folder was created directly under `app/controllers/[NewName]/` without an explicit `AskUserQuestion` gate confirmed by the user
- [ ] No hook was added for a nested type (`Nivel`, `Evaluacion`, `EntregaSemanal`, `Causa`, `Bloqueo`, `Algoritmo`) — these are returned via the parent aggregate
- [ ] If any export of `app/controllers/[Entity]/index.ts` was added or modified, the corresponding section of `.claude/controllers-entities.md` was updated in the same commit
