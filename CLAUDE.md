# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
This is web application for the cliente client. Here lives all the logic for the web app
We also have a knowledge vault for all the bussiness/meeting/general context about the product in a separate product vault (not included in this sample copy)

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint with Next.js + TypeScript config
npm run test         # Run Jest test suite (app/**/*.test.ts only)
```

## Core rules

### Test-Driven Development (mandatory for `.ts` files)

When creating or modifying any `.ts` file under `app/` (utilities, mappers, fetch functions, custom hooks, ViewModels, etc.), you MUST work using Test-Driven Development by invoking the `/tdd` skill before writing implementation code.

- ✅ Applies to: every `.ts` file (functions, hooks, mappers, BE calls, ViewModels)
- ❌ Does NOT apply to: `.tsx` files (components, pages, views, layouts)

This rule is non-negotiable. Do not write implementation logic in a `.ts` file before the corresponding failing test exists. If the user asks for a change to a `.ts` file without mentioning tests, you still invoke `/tdd` first.

All tests must follow the rules in `@.claude/testing.md`.

### Aurora UI fidelity (mandatory for `*View.tsx` and composed components)

Antes de escribir o modificar JSX en cualquier `*View.tsx` (o componente compuesto bajo `components/` que no sea un atomo de shadcn), invocá `/aurora-ui` **antes** de escribir código. El skill te obliga a abrir el mock en [`.docs/design/aurora/`](.docs/design/aurora/), identificar la sección relevante, y mapearla a componentes shadcn + tokens semánticos de `app/globals.css`. Es un gate no-negociable, salvo los escape hatches taxativos documentados en [`.claude/skills/aurora-ui/SKILL.md`](.claude/skills/aurora-ui/SKILL.md).

- ✅ Aplica a: `*View.tsx`, componentes compuestos bajo `components/`, refactors visuales (layout, jerarquía, copy, spacing).
- ❌ No aplica a: `.ts` puros (van por `/tdd`), `page.tsx` que es un one-liner de wiring, atomos shadcn que se agregan via `/shadcn`.

Esta regla complementa el UAT manual del desarrollador: `/aurora-ui` es el gate **pre-implementación de fidelidad visual**; la verificación en browser es responsabilidad del desarrollador.

### Entity gate (mandatory for any data fetch)

The set of first-class domain entities under `app/controllers/` is **closed by default**. Before writing any `use[Page]ViewModel.ts` or creating a folder under `app/controllers/`, follow Rule 6 of [`.claude/controllers-architecture.md`](.claude/controllers-architecture.md):

1. For every piece of data the View renders, identify the entity that owns it by reading [`.claude/controllers-entities.md`](.claude/controllers-entities.md) and confirming against the entity's `index.ts`.
2. If the hook exists → import it. If the hook does not exist but the entity does → add it under `[Entity]/api/` and update `.claude/controllers-entities.md` in the same commit. Both paths are **free** (no gate).
3. If no existing entity covers the data → **halt** and ask via `AskUserQuestion` with the payload defined in Rule 6 (use case + per-entity rejection + proposed name/fields/hook). Do not write a single file until the user has approved.

Nested types (`Nivel`, `Evaluacion`, `EntregaSemanal`, `Causa`, `Bloqueo`, `Algoritmo`) **never** get their own hook — return the parent aggregate. Promoting a nested type to a first-class entity requires the same `AskUserQuestion` gate.

- ✅ Aplica a: cualquier `use[Page]ViewModel.ts`, cualquier creación de carpeta directamente bajo `app/controllers/[NewName]/`.
- ❌ No aplica a: agregar un hook a una entidad existente (es extensión libre — actualizá el catálogo en el mismo commit).

## Finishing work

After completing any coding task, run the following steps in order before reporting the task as done. Each step is a gate — if it fails, fix it and re-run, do not skip ahead.

1. Format: `npx prettier --write .`
2. Lint: `npm run lint`. Fix any errors before continuing.
   2.5. Aurora UI fidelity (`/aurora-ui`): si tocaste un `*View.tsx` o componente compuesto, confirmá que invocaste `/aurora-ui` durante la implementación. Si no lo invocaste, declarar el escape hatch que aplica (ver skill) o volver atrás y rehacer el JSX con el mock como referencia. No-negociable salvo escape hatches.
3. (Optional, GSD workflows only) `/gsd-verify-work` for conversational acceptance with the user.
4. Report the task as complete.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Architecture

Next.js App Router app with Supabase authentication. No database queries, API routes, or state management library — auth only at this stage.

Every page must have a `controllers/` subfolder containing a `use[PageName]ViewModel.ts` hook and a barrel `index.ts`. See ViewModel Architecture and Controllers Architecture guides.

### Supabase Clients

Two clients exist for different rendering contexts — use the correct one:

- `lib/supabase/client.ts` — browser (client components, `"use client"`)
- `lib/supabase/server.ts` — server (server components, route handlers, server actions)

### Middleware / Session

`proxy.ts` at the root is the Next.js middleware entry point. It calls `updateSession()` from `lib/supabase/proxy.ts`, which:

- Calls `getClaims()` on every request to refresh the session cookie
- Redirects unauthenticated users to `/auth/login`
- Skips auth check for `/login` and `/auth/*` routes

### Auth Routes

All authentication flows live under `app/auth/`:

- `/auth/login`, `/auth/forgot-password`, `/auth/update-password`, `/auth/error`
- `/auth/confirm` is a GET route handler for email confirmation links from Supabase

### UI Components

UI uses shadcn/ui (New York style, RSC-compatible). Add new shadcn components via `npx shadcn@latest add <component>`. The `cn()` helper in `lib/utils.ts` merges Tailwind classes (clsx + tailwind-merge). Theming is CSS-variable-based with dark mode support via class strategy.

### Supabase

On this repository we use Supabase for out BE.
For any database changes, we MUST generate change the declarative-database-schema. And from that, the migrations. See guideline for that

## Skills setup (once per developer)

Run this from the repo root to activate the project skills locally:

```bash
ln -s "$(pwd)/.claude/skills/supabase-migration" ~/.agents/skills/supabase-migration
ln -s ~/.agents/skills/supabase-migration ~/.claude/skills/supabase-migration
ln -s "$(pwd)/.claude/skills/new-page" ~/.agents/skills/new-page
ln -s ~/.agents/skills/new-page ~/.claude/skills/new-page
ln -s "$(pwd)/.claude/skills/supabase-db-manager" ~/.agents/skills/supabase-db-manager
ln -s ~/.agents/skills/supabase-db-manager ~/.claude/skills/supabase-db-manager
ln -s "$(pwd)/.claude/skills/fetch-entity" ~/.agents/skills/fetch-entity
ln -s ~/.agents/skills/fetch-entity ~/.claude/skills/fetch-entity
ln -s "$(pwd)/.claude/skills/shadcn" ~/.agents/skills/shadcn
ln -s ~/.agents/skills/shadcn ~/.claude/skills/shadcn
ln -s "$(pwd)/.claude/skills/supabase-rls-policy" ~/.agents/skills/supabase-rls-policy
ln -s ~/.agents/skills/supabase-rls-policy ~/.claude/skills/supabase-rls-policy
ln -s "$(pwd)/.claude/skills/aurora-ui" ~/.agents/skills/aurora-ui
ln -s ~/.agents/skills/aurora-ui ~/.claude/skills/aurora-ui
ln -s "$(pwd)/.claude/skills/write-bugs" ~/.agents/skills/write-bugs
ln -s ~/.agents/skills/write-bugs ~/.claude/skills/write-bugs
ln -s "$(pwd)/.claude/skills/fix-bug" ~/.agents/skills/fix-bug
ln -s ~/.agents/skills/fix-bug ~/.claude/skills/fix-bug
ln -s "$(pwd)/.claude/skills/product-to-dev-spec" ~/.agents/skills/product-to-dev-spec
ln -s ~/.agents/skills/product-to-dev-spec ~/.claude/skills/product-to-dev-spec
ln -s "$(pwd)/.claude/skills/devspec-to-plan" ~/.agents/skills/devspec-to-plan
ln -s ~/.agents/skills/devspec-to-plan ~/.claude/skills/devspec-to-plan
```

## Guides

- SQL Style Guide: .claude/sql-style-guide.md
- Supabase delcarative schema guidelines .claude/supabase-declarative-database-schema.md
- typescript guidelines .claude/typescript.md
- ViewModel Architecture (mandatory): .claude/viewmodel-architecture.md
- UI Components guide: .claude/ui-components.md
- Controllers Architecture (mandatory): .claude/controllers-architecture.md
- Domain Entities (reference): .claude/controllers-entities.md
- Testing guide (mandatory): .claude/testing.md
- Nextjs guide .agents/AGENTS.md

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature>/`.

### Triage labels

Five canonical roles use their default names (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root.
