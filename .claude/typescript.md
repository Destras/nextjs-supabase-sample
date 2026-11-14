## TypeScript

### Supabase

- ALWAYS use the generated Database types from Supabase (`supabase gen types`).
- Import types from `@/types/supabase` — never use `any` for DB responses.
- All server actions must be typed end-to-end.

### Entity interfaces

- All TypeScript interfaces for a shared domain entity must live in `app/controllers/[EntityName]/[EntityName]Types.ts`.
- Never define entity types inline in BE call files or ViewModel hooks.
- Export all entity types from `app/controllers/[EntityName]/index.ts`; consumers import from the index only.

### Export patterns

#### Rule 1 — No inline exports; use a single export block

Declarations must not be exported where they are defined. Define first, then export at the bottom of the file as a named export block.

The only exceptions are files where Next.js requires a `default export`: `page.tsx`, `layout.tsx`, `route.ts`.

✅ Correct — declare then export

```ts
// useLoginViewModel.ts
const useLoginViewModel = (): LoginViewModel => {
  // ...
}

export { useLoginViewModel }
```

❌ Wrong — inline export on the declaration

```ts
export function useLoginViewModel(): LoginViewModel { ... }
export const useLoginViewModel = (): LoginViewModel => { ... }
```

---

#### Rule 2 — Arrow functions; no `function` declarations

All functions must be written as arrow functions assigned to a `const`. Never use the `function` keyword for a declaration.

✅ Correct

```ts
const fetchUser = async (id: string): Promise<User> => {
  // ...
}

export { fetchUser }
```

❌ Wrong

```ts
export async function fetchUser(id: string): Promise<User> { ... }
```

---

#### Rule 3 — Types, interfaces, and enums via `export type { ... }`

TypeScript types, interfaces, and enums must not be inline-exported. Declare them first, then export via `export type { ... }`.

✅ Correct

```ts
interface UserProfileViewModel {
  user: User | null
  isLoading: boolean
  onSignOut: () => Promise<void>
}

export type { UserProfileViewModel }
```

❌ Wrong

```ts
export interface UserProfileViewModel { ... }
export type UserProfileViewModel = { ... }
```

---

#### Rule 4 — Explicit return type on every top-level arrow function

Every arrow function declared at module scope (`const x = (...) => {}`) must declare its return type explicitly. The reader of the file sees the contract without having to chase inference.

Scope:

- ✅ Applies to: module-scope arrow functions assigned to a `const`, including hooks, fetchers, mappers, and any helper that crosses a module boundary.
- ❌ Does **not** apply to: inline callbacks (`.map((x) => x.id)`, `.filter((e) => e.active)`, `useEffect(() => {}, [])`), JSX event handlers (`onChange={(e) => setEmail(e.target.value)}`), and nested-named arrows declared inside another function body (`const load = async () => {…}` inside a hook).

✅ Correct — top-level arrows declare their return type; inline callbacks do not

```ts
const fetchPaciente = async (id: string): Promise<Paciente | null> => {
  // ...
}

const ids = pacientes.map((p) => p.id) // inline — no annotation needed

export { fetchPaciente }
```

❌ Wrong — top-level arrow without an explicit return type

```ts
const fetchPaciente = async (id: string) => {
  // ...
}
```

---

#### Rule 5 — Exposed results are `readonly`; collections use `ReadonlyArray<T>`

Every interface, type, or function return that crosses a module boundary uses `readonly` on its fields, and `ReadonlyArray<T>` for any collection. Domain entity interfaces, hook result envelopes, and fetcher return shapes all qualify. Internal mutable state inside a hook body (`useState`, `useReducer`, local variables) is exempt — only the public surface needs to be immutable.

Use the verbose form `ReadonlyArray<T>`, not the shorthand `readonly T[]`. This keeps the immutability marker visible at the type position.

✅ Correct — domain interface fields and hook envelope are `readonly`; array is `ReadonlyArray<T>`

```ts
interface Paciente {
  readonly id: string
  readonly nombre: string
  readonly nivelActual: number | null
}

interface UseFetchPacientesAsignadosResult {
  readonly data: ReadonlyArray<Paciente>
  readonly isLoading: boolean
  readonly error: string | null
}

export type { Paciente, UseFetchPacientesAsignadosResult }
```

❌ Wrong — mutable fields and mutable array on an exposed type

```ts
interface UseFetchPacientesAsignadosResult {
  data: Paciente[]
  isLoading: boolean
  error: string | null
}
```
