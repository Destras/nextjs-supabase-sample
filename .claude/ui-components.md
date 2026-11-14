# UI Components Guide

## Visual Design Contract — read first

The product's reference design lives in [`.docs/design/aurora/`](../.docs/design/aurora/). **Every UI implementation** (any `*View.tsx` or composed component under `components/`) must go through the [`/aurora-ui`](.claude/skills/aurora-ui/SKILL.md) skill **before** writing JSX. The skill locates the mockup section, extracts the visual contract, and gives you the mapping to shadcn components + semantic tokens.

This document covers only the **architectural** rule (use shadcn, no custom atoms). The **visual** rule (hierarchy, copy, spacing, contextual color, which token to use for what) lives in the skill and its `references/` files. Both rules are mandatory and complementary.

## Rule: Never create atomic components from scratch

Atomic UI components — such as buttons, inputs, checkboxes, labels, cards, dropdowns, and any other primitive UI element — **must always be imported from shadcn/ui**.

Do NOT:

- Write a custom `<button>` element with Tailwind classes as a reusable component
- Create a custom `<input>` wrapper component
- Build any primitive UI element from scratch

DO:

- Import from `components/ui/` (e.g., `Button`, `Input`, `Label`, `Card`)
- Add missing shadcn components via `npx shadcn@latest add <component>`
- Compose complex components by combining existing shadcn primitives

## Composing components

Complex components (e.g., a search bar with a button, a form field with label and validation) are built by combining shadcn primitives:

```tsx
// Correct: compose shadcn primitives
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function SearchBar() {
  return (
    <div className="flex gap-2">
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      <Input id="search" placeholder="Search..." />
      <Button type="submit">Search</Button>
    </div>
  )
}
```

## Currently installed shadcn components

Located in `components/ui/`:

- `button.tsx`
- `card.tsx`
- `checkbox.tsx`
- `dropdown-menu.tsx`
- `input.tsx`
- `label.tsx`
- `table.tsx`

If a needed component is not installed, run:

```bash
npx shadcn@latest add <component-name>
```

## Rule: Design system tokens are immutable

The project's design system lives in [`app/globals.css`](../app/globals.css) and consists of two layers:

- **Layer 1 — brand palette**: `--brand-primary-{300,500,700,900}`, `--brand-secondary-*`, `--brand-accent-*`. Explicit use (gradients, brand mark).
- **Layer 2 — semantic tokens**: `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--destructive`, `--success`, `--warning`, `--info`, etc. Default use (95% of the time).

These tokens are **immutable during feature development**. No new tokens are added to `globals.css` to accommodate a one-off color from the mockup, and no feature introduces raw hex/Tailwind colors.

### What to do if the mockup shows a color without an exact equivalent

Collapse to the nearest existing semantic token, preferably from Layer 2. Document the collapse explicitly in the `/aurora-ui` report ("Token collapses" section of Step 5).

### Forbidden anti-patterns

- ❌ Adding a new token to `app/globals.css` to match the mockup
- ❌ Hardcoding hex: `bg-[#5c4585]`, `text-[#fff]`
- ❌ Raw Tailwind colors: `bg-emerald-600`, `border-gray-200`, `text-slate-700`
- ❌ New variants in `components/ui/*` that introduce colors outside the design system tokens

See the inventory of available tokens in [`available-tokens.md`](.claude/skills/aurora-ui/references/available-tokens.md). That file is a **closed catalog**: it lists what exists in `globals.css`, it is not a guide for designing new tokens.

## Rule: Atoms always come from `components/ui/`

Before writing markup for any atom (Avatar, Badge, Button, Card, Checkbox, Dialog, Dropdown, Input, Label, Progress, Separator, Sheet, Skeleton, Table, Tabs, Tooltip, etc.):

1. Check whether it exists in `components/ui/*`.
2. If **yes** → import and use as-is; all visual fidelity to the design is achieved by **composing at the call-site** (`className` with design system tokens, existing variants, props).
3. If **no** → invoke `/shadcn` to install it **before** writing the JSX. Do not improvise custom markup.

This rule is enforced operationally by the **Atom audit** of the `/aurora-ui` skill (Step 3.5): every implementation produces an explicit table of "mockup atoms vs `components/ui/*`" before touching JSX.

### Forbidden anti-pattern

- ❌ Editing `components/ui/<atom>.tsx` to add new variants the mockup asks for. Composition lives at the call-site, never inside the atom.

If the mockup asks for a visual variant that does not exist in the shadcn atom (e.g. a "violet chip"), model it at the call-site by combining utilities from existing tokens:

```tsx
<Badge className="bg-brand-secondary-500/15 text-brand-secondary-300 border-brand-secondary-500/30">
  Violeta
</Badge>
```
