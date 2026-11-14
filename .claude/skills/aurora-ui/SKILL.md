---
name: aurora-ui
description: Ensures visual fidelity to the Aurora design when implementing or modifying UI. Before writing JSX in any `*View.tsx` (or composed component under `components/`), open the mockup in `.docs/design/aurora/`, identify the section, extract the visual contract, and map it to shadcn components + semantic tokens from the existing design system. Applies two hard gates taken from `.claude/ui-components.md`: (1) **token freeze** — tokens live in `app/globals.css` and are immutable; if the mockup shows a color without an equivalent, collapse to the nearest token (never add tokens, never hardcode colors); (2) **atom audit** — before touching JSX, enumerate every atom of the mockup against `components/ui/*` and install any missing ones via `/shadcn`. Use when about to write or modify JSX in a `*View.tsx`, build a new page section, refactor visual hierarchy, or when CLAUDE.md "Aurora UI fidelity" rule fires.
---

# Aurora UI

Converts the client-approved design (HTML mockup in `.docs/design/aurora/`) into repo JSX using shadcn + semantic tokens. It is the visual gate that runs before `/playwright-uat`, just as `/tdd` is the gate that runs before touching `.ts` logic.

## When to apply / when NOT to

**Trigger heuristic:** "Are you about to write or modify JSX that the user will eventually see rendered?" If yes → run the skill. If no → it does not apply.

- ✅ Applies to: any `*View.tsx`, any `page.tsx` that is not a one-liner wiring, composed components under `components/` (except shadcn `components/ui/*`), visual refactors (changing layout, hierarchy, copy, spacing).
- ❌ Does NOT apply to: pure `.ts` (hooks, mappers, fetchers — those go through `/tdd`), `page.tsx` with a one-line body (`<View {...vm} />`), shadcn atoms that are added with `/shadcn`.

**Who triggers it:** the agent about to write JSX. Implementer subagents (e.g. `task-implementor` from `/orchestrate-feature`) also invoke it **before** editing a `*View.tsx`.

**How to invoke (mandatory format):** before the skill, build a mini-spec with three fields:

1. **page_path** — absolute path of the `*View.tsx` (or `page.tsx`/component) to edit.
2. **mockup_section** — name of the mockup section that applies. If you don't know, consult [`references/page-index.md`](references/page-index.md).
3. **change_summary** — what you are going to change/add (one line).

If you cannot fill the 3 fields with confidence, **stop and ask the user** — do not improvise.

**Escape hatches — exactly three, exhaustive.** If one applies, declare it in the final report:

1. **No equivalent in the mockup.** The feature does not appear in `.docs/design/aurora/webapp/pages-{1,2,3}.jsx` nor in `Web App.html`. Report: `Aurora UI skipped: no mockup equivalent`. Still map atoms to shadcn + semantic tokens from the repo (Layer 2 of `app/globals.css`). Document what you invented.
2. **Trivial view.** Auth flows (`/auth/error`, `/auth/sign-up-success`), screens with a single element (one button and a title). Report: `Aurora UI skipped: trivial view`. **Does not apply** if the view has more than 2 visually composed elements.
3. **The user explicitly asked for it.** Report: `Aurora UI skipped: explicit user request`.

Any other reason ("it's obvious", "I already know how it goes") **is not a valid hatch**.

## Quick start

- **Step 1** — Resolve `mockup_section` → mockup file + exact JSX function
- **Step 2** — Read the mockup JSX and enumerate the visual contract
- **Step 3** — Map the mockup's CSS classes → shadcn components + Tailwind classes using existing tokens (no inventing tokens)
- **Step 3.5** — Atom audit: enumerate every atom from the mockup against `components/ui/*`; install missing ones via `/shadcn` **before** continuing
- **Step 4** — Implement the JSX in `page_path`
- **Step 5** — Report atom audit + token collapses + conscious deltas vs the mockup

## Step 1 — Locate mockup section

Open [`references/page-index.md`](references/page-index.md) and match `mockup_section` to a row. That row gives you:

- mockup file (`pages-1.jsx`, `pages-2.jsx`, `pages-3.jsx`)
- JSX function name (`Dashboard`, `PacienteDetail`, etc.)
- equivalent repo page (`app/pacientes/page.tsx`, etc.) if it exists

If there is no match → activate escape hatch #1.

## Step 2 — Extract design contract

Read the corresponding `.jsx`, **only the relevant function**. From the snippet, enumerate:

1. **Component tree** — which elements exist and how they nest (`<aside>` → `<nav>` → `<ul>`, etc.)
2. **CSS classes used** — list literally. Classes starting with `page-head`, `card`, `stat`, `grid-*`, `stack*`, `alert-row`, `chip`, `eyebrow`, `kicker`, `btn-*`, `score-pill`, `tabs`, `timeline`, `steps`, `table` are in the Step 3 mapping doc.
3. **Layout** — which grid it uses (`grid-2`, `grid-3`, `grid-2-1`, etc.), which `stack` (vertical gap) nests inside.
4. **Literal copy** — eyebrows, headings, sub-headings, button labels, empty states. **Preserve the exact text** from the mockup unless the domain dictates otherwise (e.g., the mockup says "Sofía" but here you use `paciente.nombre`).
5. **Tones/states** — semantic colors: `alert-row.high` (destructive), `chip.gold` (accent), `stat.featured` (primary), `score-pill` by range (success/warning/destructive).
6. **lucide-equivalent icons** — the mockup uses custom `Ic.*` icons; map: `Ic.bell` → `Bell`, `Ic.users` → `Users`, `Ic.home` → `Home`, `Ic.search` → `Search`, `Ic.layers` → `Layers`, `Ic.template` → `LayoutTemplate`, `Ic.message` → `MessageSquare`, `Ic.add` → `Plus`, `Ic.spark` → `Sparkles`, `Ic.settings` → `Settings`.

## Step 3 — Map mockup CSS → shadcn + tokens

Open [`references/class-mapping.md`](references/class-mapping.md) and translate each class from Step 2. For classes without a direct entry in the mapping, consult the inventory in [`references/available-tokens.md`](references/available-tokens.md) — it is a **closed catalog** of the tokens that already exist in `app/globals.css`.

> **Hard project rule** ([`.claude/ui-components.md`](../../ui-components.md) — "Design system tokens are immutable"): tokens are immutable. If a mockup class does not appear in `class-mapping.md` **and** there is no direct equivalent semantic token in `available-tokens.md`, **collapse to the nearest Layer 2 token** and document the collapse in the report (Step 5, "Token collapses" section). Never add tokens, never hardcode hex, never use raw Tailwind colors.

Rules:

- **Never hardcode Tailwind colors** (`bg-white`, `text-gray-700`, `bg-slate-50`, `border-zinc-200`, `bg-emerald-600`, `bg-[#5c4585]`). Always use semantic tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.
- **Never add tokens to `app/globals.css`** as part of the implementation flow. If the design system doesn't cover a case, the decision belongs to the client — not the agent.
- **Never create custom atoms and never edit `components/ui/*`** to add variants. Variants the mockup asks for are modeled at the call-site by composing utilities from existing tokens (see the "violet chip" example in `.claude/ui-components.md`).
- **Layer 1 (`bg-brand-primary-500`, etc.) only for explicit decoration** — gradients, brand marks, accent dividers. For everything else use Layer 2 semantic.
- **Fonts via variables already wired in `app/layout.tsx`** — do not import new fonts. The default heading is already IBM Plex Sans via `--font-display`.

## Step 3.5 — Atom audit (mandatory gate before Step 4)

Before writing any JSX, list **every atom** identified in Step 2 and verify it against `components/ui/*`. This enforces the "Atoms always come from `components/ui/`" rule in [`.claude/ui-components.md`](../../ui-components.md).

Quick check of the current state:

```bash
ls components/ui/
```

Mandatory audit output (markdown table, reused verbatim in the Step 5 report):

| Mockup atom | Installed in `components/ui/`? | Action                |
| ----------- | ------------------------------ | --------------------- |
| Avatar      | ❌                             | `/shadcn` add avatar  |
| Badge       | ❌                             | `/shadcn` add badge   |
| Button      | ✅                             | use as-is             |
| Card        | ✅                             | use as-is             |
| Tabs        | ❌                             | `/shadcn` add tabs    |
| Tooltip     | ❌                             | `/shadcn` add tooltip |

Hard rules:

- If **any** atom is missing → invoke `/shadcn` **now**, before advancing to Step 4. Do not improvise custom markup.
- **Never edit `components/ui/*`** to add variants the mockup asks for. Variants (e.g. `chip.violet`, `stat.featured`) are modeled at the call-site with Tailwind classes over existing tokens.
- The audit is exhaustive: every atom from the mockup appears in the table, even if already installed.

## Step 4 — Implement

Edit `page_path` applying the Step 3 mapping with all the atoms from Step 3.5 already available. Hard rules:

1. If the view has logic, **the ViewModel must already exist beforehand** (see `/new-page` and `.claude/viewmodel-architecture.md`). The view is pure JSX that consumes props.
2. Composition with shadcn primitives: `<Card>`, `<Button>`, `<Input>`, `<Label>`, `<Table>`, etc.
3. Layout with Tailwind utilities, not with mockup classes: mockup `grid-2` → `grid grid-cols-1 md:grid-cols-2 gap-6`; `stack` → `flex flex-col gap-4`; `row-between` → `flex items-center justify-between`.
4. For gradients and glows use the `@utility` definitions already in `app/globals.css`: `bg-gradient-brand`, `bg-gradient-avatar`, `shadow-glow-primary`, `shadow-glow-accent`.
5. If you got this far with a missing atom (incomplete Step 3.5), **stop**: the audit is a prerequisite, non-negotiable.
6. If a JSX section needs a color without a direct token → apply the **collapse policy** from Step 3 (nearest Layer 2 token) and record the collapse for the report (Step 5, "Token collapses"). Never improvise a hex or a raw Tailwind class.

## Step 5 — Report delta

At the close, return a block of the form:

```
Aurora UI mapping:
- Mockup section: <name> (pages-X.jsx · function <FnName>)
- View edited: <page_path>

Atom audit:
- Avatar  → ✅ already installed
- Badge   → ❌ not installed → installed via /shadcn in this run
- Card    → ✅ already installed
- Tabs    → ❌ not installed → installed via /shadcn in this run
- Tooltip → ❌ not installed → installed via /shadcn in this run

Token collapses (mock color → existing token, conscious lossy mapping):
- "violet chip" from the mockup → bg-brand-secondary-500/15 text-brand-secondary-300
- (none) if there were no collapses

Conscious deltas vs mockup (NO color-related — layout / copy / structure):
· <delta 1 — why it diverged>
· <delta 2 — why it diverged>

Escape hatch applied: <none | hatch #N — reason>
```

If there are no collapses and no deltas, say so in one line per section: `(none)` and `Match with mockup — no conscious deltas.`

## Final checklist

- [ ] `mockup_section` resolved to exact file + function (or escape hatch declared)
- [ ] Listed mockup CSS classes before mapping
- [ ] Every class mapped to shadcn + a semantic token **from the closed catalog** (no hardcoded Tailwind colors, no new tokens added)
- [ ] **Atom audit table complete before Step 4** (Step 3.5 gate)
- [ ] Every uninstalled atom was added via `/shadcn` before writing JSX
- [ ] lucide-react icons, no custom inline SVG (except the logo)
- [ ] Did not edit `components/ui/*` to add variants
- [ ] **Token collapses** (if any) are documented in the report (Step 5)
- [ ] Reported the conscious delta at the end

## Order vs other skills

- **Before:** `/new-page` (if the page does not exist), `/tdd` (if you are going to touch `.ts` logic in the ViewModel).
- **During:** `/shadcn` (invoked from Step 3.5 if the atom audit detects missing atoms).
- **After:** `/playwright-uat` (post-implementation behavior gate).

It does not replace any other skill — it composes them. If you skip it and edit JSX by eye, you are violating the "Aurora UI fidelity" rule in CLAUDE.md.

## Fallback: feature without a mockup section

If you activate hatch #1, you still do the following:

1. Pick the mockup section that **most closely resembles the structure** (e.g., for a new CRUD list, use `PacientesList` as the pattern base).
2. Reuse classes from [`references/class-mapping.md`](references/class-mapping.md) — they are valid even outside their original page.
3. Explicitly list in the report what you invented and why (e.g., "added an `enviado_en` column not in the mockup because RF-XXX requires it").

The idea: even a feature without a mockup → JSX consistent with the system, not JSX by eye.
