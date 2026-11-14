# Available Tokens — Closed catalog of the design system

> **Closed catalog.** This file lists the tokens that **already exist** in [`app/globals.css`](../../../../app/globals.css). It is not a design guide nor a tip-sheet: it is the immutable inventory the mockup's colors are mapped against.
>
> **Collapse policy** (see [`.claude/ui-components.md`](../../../ui-components.md) — "Design system tokens are immutable"): if the mockup shows a color without an exact equivalent in this inventory, **collapse to the nearest Layer 2 semantic token** and document the collapse in the `aurora-ui` skill report (Step 5, "Token collapses" section). Never add new tokens to `globals.css`, never hardcode hex/raw Tailwind colors.

Map of "which token to grab for which thing". All tokens live in [`app/globals.css`](../../../../app/globals.css) and switch automatically with `data-theme="dark"`.

## The 2 layers

- **Layer 1** — brand palette by purpose: `--brand-primary-{300,500,700,900}`, `--brand-secondary-{300,500,700,900}`, `--brand-accent-{300,500,700}`. **Use only for explicit decoration** (gradients, brand mark, accent dividers). Never on ordinary UI components.
- **Layer 2** — semantic tokens (what you use 95% of the time): `--background`, `--foreground`, `--card`, `--primary`, `--border`, etc. They switch with theme. **This is what you touch almost always.**

## Operative table

### Surfaces

| When you want...              | Token (Tailwind class)  | Notes                                                 |
| ----------------------------- | ----------------------- | ----------------------------------------------------- |
| Page background               | `bg-background`         | Default of `<body>`.                                  |
| Card/panel background         | `bg-card`               | Optional border `border-border`.                      |
| Popover/dropdown background   | `bg-popover`            | shadcn already applies it internally.                 |
| Main text                     | `text-foreground`       | Default. No need to declare every time.               |
| Secondary text / hint / meta  | `text-muted-foreground` | Eyebrows, descriptions, timestamps, placeholder text. |
| "Muted" background (input bg) | `bg-muted`              | Inputs, code, kbd, skeletons.                         |
| Border for ordinary UI        | `border-border`         | Separators, cards, table rows.                        |
| Input border                  | `border-input`          | shadcn already applies it.                            |
| Focus ring                    | `ring-ring`             | shadcn already applies it on interactive components.  |

### Actions / states

| When you want...                  | Token                                        | Notes                                                                             |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Primary action (main CTA)         | `bg-primary text-primary-foreground`         | shadcn `<Button>` default. Light mode: teal. Dark: gold (switches automatically). |
| Secondary action                  | `bg-secondary text-secondary-foreground`     | shadcn `<Button variant="secondary">`.                                            |
| Tertiary / outline action         | (no bg)                                      | shadcn `<Button variant="outline">`, `<Button variant="ghost">`.                  |
| Destructive action                | `bg-destructive text-destructive-foreground` | "Eliminar", "Cancelar tratamiento". shadcn `<Button variant="destructive">`.      |
| Highlighted background for alerts | `bg-destructive-bg text-destructive`         | Banner / highlighted row. Keep legible.                                           |
| Success state background          | `bg-success-bg text-success`                 | "Plan guardado", green check.                                                     |
| Warning state background          | `bg-warning-bg text-warning`                 | Medium score, pending evaluation.                                                 |
| Info state background             | `bg-info-bg text-info`                       | Informational notes, expanded hints.                                              |

### Score / progress (project rule)

For `score-pill`, paciente score traffic lights, and similar:

| Range           | Background          | Text               |
| --------------- | ------------------- | ------------------ |
| ≥ 70 ("alto")   | `bg-success-bg`     | `text-success`     |
| 40–69 ("medio") | `bg-warning-bg`     | `text-warning`     |
| < 40 ("bajo")   | `bg-destructive-bg` | `text-destructive` |

And for trend (`↑` / `↓` / `→`):

| Trend  | Color                   |
| ------ | ----------------------- |
| `up`   | `text-success`          |
| `down` | `text-destructive`      |
| `flat` | `text-muted-foreground` |

### Typography (loaded via next/font, accessible as CSS variables)

| When you want...                    | Token / class                                    | Real font                |
| ----------------------------------- | ------------------------------------------------ | ------------------------ |
| Body / UI                           | no class (default)                               | Geist Sans               |
| Clinical heading (h1–h4)            | no class (default — `--font-display`)            | IBM Plex Sans            |
| Mono (ID, date, code, kbd)          | `font-mono`                                      | Geist Mono               |
| Eyebrow (caps, mono, wide tracking) | `className="eyebrow"` (utility from globals.css) | Geist Mono + uppercase   |
| Small eyebrow                       | `className="eyebrow-sm"`                         | same, smaller size       |
| Editorial italics (`<em>` in hero)  | `italic font-light`                              | (no Fraunces in web app) |

Note: the mockup uses Fraunces for editorial italics in dark mode. The web app **does not load Fraunces** intentionally (decision in the brand-assets README: "Fraunces and Instrument Serif are not needed in the web app"). If you use `<em>` for emphasis like "lo que _no puede esperar_" from the mockup, use `italic font-light text-muted-foreground` with the default clinical font.

### Brand decoration (Layer 1 — explicit use)

| When you want...                    | Token / utility          | Notes                                                 |
| ----------------------------------- | ------------------------ | ----------------------------------------------------- |
| Brand gradient background           | `bg-gradient-brand`      | Signature: primary → secondary → accent. Hero, brand. |
| Soft / dark hero gradient           | `bg-gradient-brand-soft` | Dark hero: primary-900 → secondary-900 → bg.          |
| Avatar gradient                     | `bg-gradient-avatar`     | Initials over brand background.                       |
| Primary glow (focus, secondary CTA) | `shadow-glow-primary`    | Teal ring.                                            |
| Accent glow (main CTA, milestones)  | `shadow-glow-accent`     | Gold ring. Reserved for milestones — don't abuse.     |
| Linear accent (accent divider)      | `bg-brand-accent-500`    | Gold accent lines. Few, sparse.                       |

**Accent (gold) scarcity rule:** from the brand README — "The accent is scarce. Reserved for actions and milestones. If everything is accent, nothing is accent." If you find yourself using `bg-accent` or `bg-brand-accent-500` more than once per screen, stop and consolidate.

## Anti-patterns (do not do)

```tsx
// ❌ hardcoded Tailwind colors
<div className="bg-white border-gray-200">
<p className="text-gray-700">
<div className="bg-slate-50">

// ✅ semantic tokens
<div className="bg-card border-border">
<p className="text-muted-foreground">
<div className="bg-muted">

// ❌ Layer 1 for ordinary UI
<Button className="bg-brand-primary-500">

// ✅ Layer 2 (switches with theme automatically)
<Button> {/* shadcn default already uses bg-primary */}

// ❌ mixing Layer 1 and Layer 2 without reason
<div className="bg-card text-brand-primary-700">

// ✅ pick a lane
<div className="bg-card text-foreground"> {/* Layer 2 */}
<div className="bg-gradient-brand text-primary-foreground"> {/* explicit brand */}
```

## Light vs dark — what changes on its own

When you set `data-theme="dark"` on `<html>`:

- `--primary` shifts from teal (Layer 1 primary-500) to gold (Layer 1 accent-500). **Your main CTA changes color without touching anything**.
- `--background`, `--foreground`, `--card`, `--muted` invert contrast.
- The utilities `bg-gradient-*`, `shadow-glow-*` reference Layer 1 — they don't change — but the visual balance does adjust.

If your component needs to behave differently between light/dark beyond the tokens (rare), use Tailwind's `dark:` variant. But first ask yourself whether you can express it with a semantic token that already self-adjusts.

## Quick reference link

For the canonical rule on when to use Layer 1 vs Layer 2 see [`.docs/design/aurora/brand-assets/README.md`](../../../../.docs/design/aurora/brand-assets/README.md) section 3 ("Reglas de uso").
