---
name: new-page
description: Scaffolds a new Next.js App Router page following the project's ViewModel architecture. Creates page.tsx, [PageName]View.tsx, and controllers/ with the ViewModel hook, its placeholder test, and the barrel re-export. Use when user wants to add a new page, create a new route, or scaffold a new feature page.
---

# New Page

Scaffold a fully wired ViewModel-architecture page for this Next.js project.

The scaffold is an **empty page** — no data fetching, no auth composition, no loading/error states. It establishes the architectural shape (Page → View → ViewModel → barrel + test) and nothing else. Fetching, auth, and state are added later as the feature grows.

The scaffold is **strict**: every file complies with `.claude/typescript.md` rules 1–5, `.claude/viewmodel-architecture.md`, `.claude/controllers-architecture.md`, and the TDD mandate in `CLAUDE.md`.

## Naming conventions

Given input **"User Profile"** (or **"UserProfile"** or **"user-profile"**):

| Derived form   | Rule                             | Result                    |
| -------------- | -------------------------------- | ------------------------- |
| Route segment  | lowercase, kebab-case            | `user-profile`            |
| PascalCase     | capitalize each word, no spaces  | `UserProfile`             |
| ViewModel hook | `use` + PascalCase + `ViewModel` | `useUserProfileViewModel` |
| View component | PascalCase + `View`              | `UserProfileView`         |
| Interface type | PascalCase + `ViewModel`         | `UserProfileViewModel`    |
| Page component | PascalCase + `Page`              | `UserProfilePage`         |

Single-word input **"Terapeutas"** → route `terapeutas`, PascalCase `Terapeutas`.

## Folder shape

All files go under `app/[route]/` where `[route]` is the kebab-case route segment. No `layout.tsx` — the root `app/layout.tsx` already wraps every page with `ThemeProvider` + `SidebarLayout`. Add a page-level layout only when a real nested-route or nested-nav need appears.

```
app/[route]/
  page.tsx                              ← wires ViewModel to View, one-line body
  [PageName]View.tsx                    ← pure JSX, takes ViewModel as props
  controllers/
    use[PageName]ViewModel.ts           ← all logic lives here (empty for now)
    use[PageName]ViewModel.test.ts      ← TDD placeholder (it.todo)
    index.ts                            ← barrel — the only public entry point
```

## Files to create

### `app/[route]/controllers/use[PageName]ViewModel.ts`

```ts
'use client'

interface [PageName]ViewModel {}

const use[PageName]ViewModel = (): [PageName]ViewModel => {
  return {}
}

export type { [PageName]ViewModel }
export { use[PageName]ViewModel }
```

Notes:

- Interface is declared without `export`; it leaves the module only through the bottom `export type { ... }` block (TS Rule 1 + Rule 3).
- Hook is an arrow function with an explicit return type (TS Rule 2 + Rule 4).
- Interface is empty today. When fields are added, they must be `readonly`, and any collection must be typed as `ReadonlyArray<T>` (TS Rule 5).

### `app/[route]/controllers/use[PageName]ViewModel.test.ts`

```ts
describe('use[PageName]ViewModel', () => {
  it.todo('add tests when the ViewModel introduces state, effects, or handlers')
})
```

Notes:

- The file exists from day one because `CLAUDE.md` mandates TDD for every `.ts` under `app/`. An empty ViewModel has no branches to cover, so the placeholder records the obligation without inventing fake assertions.
- The moment any logic is added to the hook, invoke `/tdd` and replace the `it.todo` with real test cases following `.claude/testing.md` (one `expect` per test, whole-object `toEqual`, single `beforeEach`, `renderHook`, branch coverage, factory-mock pattern).

### `app/[route]/controllers/index.ts`

```ts
export { use[PageName]ViewModel } from './use[PageName]ViewModel'
export type { [PageName]ViewModel } from './use[PageName]ViewModel'
```

Notes:

- This barrel is the only public entry point to the controllers folder (Controllers Rule 1). `page.tsx` and the View import from `'./controllers'` — never from internal files.

### `app/[route]/[PageName]View.tsx`

```tsx
import type { [PageName]ViewModel } from './controllers'

const [PageName]View = (_props: [PageName]ViewModel): JSX.Element => {
  return <div>[PageName]</div>
}

export { [PageName]View }
```

Notes:

- Pure JSX — no `useState`, `useEffect`, `useRouter`, no handlers, no Supabase. The View only renders.
- Declares the `[PageName]ViewModel` contract on its props even though the interface is empty today. When the ViewModel grows, TypeScript points at the View as the consumer.
- `_props` (leading underscore) silences `noUnusedParameters` until real fields are destructured.
- Arrow function + bottom export + explicit return type (TS Rules 1, 2, 4).

### `app/[route]/page.tsx`

```tsx
'use client'

import { use[PageName]ViewModel } from './controllers'
import { [PageName]View } from './[PageName]View'

export default function [PageName]Page() {
  const vm = use[PageName]ViewModel()
  return <[PageName]View {...vm} />
}
```

Notes:

- `page.tsx` is one of the documented Next.js exceptions in `.claude/typescript.md` — `export default function` is required by the App Router, so Rules 1 and 2 do not apply here.
- Body is one line: call the ViewModel, spread onto the View. No logic in the page itself.

## After scaffolding

1. Run `npx prettier --write app/[route]` to normalize formatting.
2. The scaffolded page is reachable at `http://localhost:3000/[route]` and should render `[PageName]`.
3. Before adding any logic to `use[PageName]ViewModel.ts`, invoke `/tdd` — the placeholder test must be replaced with real failing tests _before_ implementation.
4. When the page needs to fetch a domain entity, invoke `/fetch-entity` instead of writing Supabase calls inside the ViewModel (Controllers Rule 5).
5. When the page needs the current user id, compose `useCurrentUserId` from `@/app/controllers/Auth` — never call `supabase.auth.getUser()` inside the ViewModel.

## Checklist

After creating all files, verify:

- [ ] No `layout.tsx` was created (the root layout already wraps the page)
- [ ] `controllers/use[PageName]ViewModel.ts` declares its interface without `export`, exports both symbols in a single block at the bottom, uses an arrow function, and declares the return type
- [ ] `controllers/use[PageName]ViewModel.test.ts` exists with a single `it.todo` entry
- [ ] `controllers/index.ts` re-exports the hook and the type — and nothing else
- [ ] `[PageName]View.tsx` is pure JSX, imports the type from `'./controllers'`, accepts `[PageName]ViewModel` as props (even if empty), declares its return type, and exports at the bottom
- [ ] `page.tsx` has `'use client'`, default-exports a one-line `[PageName]Page` that calls the ViewModel and spreads onto the View
- [ ] `page.tsx` and `[PageName]View.tsx` import from `'./controllers'` (the barrel), never from `'./controllers/use[PageName]ViewModel'` directly
- [ ] `npm run lint` and `npx tsc --noEmit` both pass on the new files
