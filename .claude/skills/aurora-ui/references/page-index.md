# Page Index — Repo ⇄ Mockup mapping

Map between the repo's pages (existing or planned) and the sections of the Aurora mockup.

> If a page **does not appear here**, activate escape hatch #1 of the skill (`Aurora UI skipped: no mockup equivalent`) and pick the structurally closest section.

## Mockup files

- `.docs/design/aurora/Web App.html` — entrypoint; orchestrates sidebar + topbar + content switcher.
- `.docs/design/aurora/webapp/ui.jsx` — shared mockup components: `AuroraMark`, `Avatar`, `ScorePill`, `Chip`, `Stat`, `Card`. **These are visual reference** — in the repo they are replaced by shadcn primitives + Tailwind tokens, not ported literally.
- `.docs/design/aurora/webapp/styles.css` — every CSS class in the mockup. Source-of-truth for the design's spacing, color, and typography.
- `.docs/design/aurora/brand-assets/tokens.css` — Layer 1 + Layer 2 tokens. **Operative in the repo:** `app/globals.css` (already aligned).
- `.docs/design/aurora/brand-assets/README.md` — token usage rules (2 layers, gradients, shadows, voice).

## Page index

| mockup_section        | Mock file      | JSX function in the mockup   | Repo page (current or planned)            | Notes                                                                                      |
| --------------------- | -------------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `login`               | `pages-1.jsx`  | `LoginPage`                  | `app/auth/login/page.tsx`                 | Split layout: form left + decorative side right. The repo currently uses a simple version. |
| `dashboard-admin`     | `pages-1.jsx`  | `Dashboard` (role=admin)     | `app/page.tsx` (when role=admin)          | KPIs `Stat`, alerts list, top pacientes table.                                             |
| `dashboard-terapeuta` | `pages-1.jsx`  | `Dashboard` (role=terapeuta) | `app/page.tsx` (when role=terapeuta)      | Personal stats + list of "próximas evaluaciones".                                          |
| `pacientes-list`      | `pages-1.jsx`  | `PacientesList`              | `app/pacientes/page.tsx`                  | Table with avatar, score-pill, status chip, filters above.                                 |
| `alta-paciente`       | `pages-2.jsx`  | `AltaPaciente`               | `app/pacientes/alta/page.tsx` (planned)   | Multi-step wizard. Visible stepper, per-step validation.                                   |
| `paciente-detail`     | `pages-2.jsx`  | `PacienteDetail`             | `app/pacientes/[id]/page.tsx` (planned)   | Tabs + timeline + clinical record. The densest page.                                       |
| `plantillas`          | `pages-3.jsx`  | `Plantillas`                 | `app/plantillas/page.tsx` (planned)       | Resource library (videos, mantras, frases). Also reused for `frases`.                      |
| `frases`              | `pages-3.jsx`  | `Plantillas`                 | `app/frases/page.tsx` (planned)           | Same component as `plantillas` with a type filter. Read-only for terapeuta.                |
| `alertas`             | `Web App.html` | (inline in `App`)            | `app/alertas/page.tsx` (planned)          | List of `alert-row` ordered by urgency. `Web App.html:283-332` has the structure.          |
| `admin-equipo`        | `pages-3.jsx`  | `Admin`                      | `app/equipo/page.tsx` (planned)           | Admin role only. Manage terapeutas + roles.                                                |
| `sidebar-layout`      | `Web App.html` | (inline in `App`)            | `components/navigation/SidebarLayout.tsx` | The global shell. Sidebar changes go through here. Mockup: `Web App.html:174-231`.         |
| `topbar`              | `Web App.html` | (inline in `App`)            | `components/navigation/SidebarLayout.tsx` | Crumbs + searchbar + theme toggle + bell. Mockup: `Web App.html:234-256`.                  |

## Pages without a direct mockup equivalent

- `/auth/sign-up` — the mockup only has login. Reuse the visual pattern of `login` (form left + side right) and adapt it.
- `/auth/forgot-password`, `/auth/update-password`, `/auth/error`, `/auth/sign-up-success`, `/auth/confirm` — trivial, escape hatch #2 (`Aurora UI skipped: trivial view`).

## How to add entries

When a new page is planned that isn't here:

1. If the mockup has an equivalent section → add a row to the index with a unique `mockup_section`.
2. If the mockup does NOT have an equivalent → do not add a row; the skill activates hatch #1 and reuses the structurally closest section.

Do not add "future" rows without a section — the index is for real mapping, not aspirations.
