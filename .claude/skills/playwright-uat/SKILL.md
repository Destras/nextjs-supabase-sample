---
name: playwright-uat
description: Runs end-to-end UAT of a feature using the Playwright MCP. Logs in with the correct role from supabase/seed-credentials.md, walks through the flow described by the user, reports what it observed in natural language, and cleans up the data it created via Supabase MCP. Use when user wants to test, verify, validate, or UAT a feature manually, mentions "testear", "verificar que funciona", "UAT", "probar end-to-end", or asks to check a flow in the browser. Also runs as the mandatory post-implementation gate after any UI-testable code change — invoke when finishing work on `.tsx`, on `ViewModel.ts` wired to a view, or on a mapper/hook/fetcher feeding an existing view.
---

# Playwright UAT

> ⚠️ **Local only.** This skill runs against the local stack (`localhost:3000` + the local Supabase started by `npm run supabase:local-start`). The Supabase MCP it uses for cleanup deletes rows: **never point that MCP at a remote project** (staging or production). The seed users and their password exist only in the local database.

Automates the manual UAT of a feature: starts the dev server if needed, logs in with the appropriate role, walks the flow the user requested, reports what it observed in natural language, and cleans up any data it created.

## When to apply / when NOT to

**Trigger heuristic:** "Can you navigate to a URL on `localhost:3000` and see/use what you just changed?" If yes → run the UAT. If no → it does not apply.

- ✅ Applies to: `.tsx` (`page.tsx`, `*View.tsx`, `layout.tsx`, components/), `ViewModel.ts` already wired to a view, mapper/`fetch*`/`use*` whose output reaches an existing view.
- ❌ Does NOT apply to: SQL schema/migrations, generated types, utilities in `lib/` without a UI consumer yet, controllers whose hook is not yet imported by any `page.tsx`.

**Who triggers it:** only the agent that returns control to the human (you in a direct conversation, or the orchestrator of a GSD workflow such as `gsd-quick` / `gsd-execute-phase` when it is about to report the phase as complete). Intermediate subagents executing sub-tasks of a larger plan do **not** trigger UAT.

**How to invoke (mandatory format):** before invoking the skill, build a mini-spec with three required fields:

1. **Role** — which seed user from the table in Step 1 will be used (e.g., `terapeuta1@clienteapp.test`).
2. **Flow** — the exact sequence of URLs / clicks / inputs that exercises what you just implemented.
3. **Observable success criterion** — what must appear on screen to consider it working.

Compress that mini-spec by invoking `/caveman` before handing it to the skill. If you cannot fill the 3 fields with confidence, **stop and ask the user** — do not improvise the flow.

**Multi-flow:** if the change touches more than one distinct UI flow (e.g., a shared mapper feeding both `/pacientes` and `/dashboard`), **one invocation per flow, sequential**. Each invocation with its own mini-spec. Different page/route = different flow.

**Escape hatches — exactly four, exhaustive.** If one applies, declare it explicitly in the final report:

1. **Tooling unavailable.** Playwright MCP, Supabase MCP, or the dev server cannot be started. Report: `UAT skipped: <tool> unavailable`.
2. **Purely visual/static change without touching logic.** Only CSS/spacing/colors, or only literal copy changed in JSX. Report: `UAT skipped: cosmetic-only, no logic touched`. **Does not apply** if you touched any `.ts` or changed logic in a `.tsx` — internal refactors with no expected behavior change still have to pass UAT.
3. **No seed user matches the required role** and creating one is out of scope. Report: `UAT skipped: no seed user for role <X>`.
4. **The user explicitly asked to skip it** in the same message. Report: `UAT skipped: explicit user request`.

Any other reason ("it's trivial", "I already know it works") **is not a valid hatch**.

## Quick start

1. Identify role → pick the seed email
2. Make sure `localhost:3000` responds (start `npm run dev` in background if not)
3. Log in via Playwright MCP
4. Execute the flow (each action followed by a `browser_snapshot`)
5. Clean up created data via Supabase MCP
6. Report conversationally

## Step 1 — Identify role and credentials

Infer the role from the flow the user requested:

- Mentions "listado de pacientes del terapeuta", "crear paciente", "asignar paciente" → **terapeuta**
- Mentions "panel admin", "gestionar usuarios", "ver todos los pacientes" → **admin**
- Mentions "completar evaluación", "ver mis sesiones", "ver mi plan" → **paciente**
- If ambiguous, **ask before continuing**

Seed user table (password is always `local-seed-cgGqBIrprZGocA9r5Jxm`):

| Required role       | Email                             | Notes                                                          |
| ------------------- | --------------------------------- | -------------------------------------------------------------- |
| pure admin          | `admin@clienteapp.test`           | Therapist profile (MT-0000), 0 pacientes; shows in /terapeutas |
| admin+terapeuta     | `admin.terapeuta@clienteapp.test` | Has every paciente assigned                                    |
| default terapeuta   | `terapeuta1@clienteapp.test`      | Pacientes: Sofía Rodríguez, Martín López                       |
| alternate terapeuta | `terapeuta2@clienteapp.test`      | Pacientes: Valentina Torres, Sebastián Díaz                    |
| default paciente    | `paciente1@clienteapp.test`       | Sofía Rodríguez, assigned to Laura Martínez                    |

Full details in [`supabase/seed-credentials.md`](../../../supabase/seed-credentials.md). Re-read only if the flow needs specific clinical data (causa, algoritmo, nivel) that isn't in the table above.

## Step 2 — Make sure the dev server is running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

- If it responds `200`, `302`, or `307` → server is up, continue
- If it fails or returns nothing → launch `npm run dev` with `run_in_background: true` and poll with `curl` until it responds

**Do not kill the server when done.** The user may keep using it.

## Step 3 — Login via Playwright MCP

```
browser_navigate → http://localhost:3000/auth/login
browser_fill_form → { email: <from Step 1>, password: "local-seed-cgGqBIrprZGocA9r5Jxm" }
                    labels: "Correo profesional", "Contraseña"
                    fallback selectors: #email, #password
browser_click → button with text "Entrar al panel →"
browser_wait_for → wait for redirect (defaults to "/")
```

If it redirects to `/auth/error` or the post-click snapshot shows a credentials error, **stop and report** — do not continue the flow.

## Step 4 — Execute the described flow

Rules:

- Each action (`browser_click`, `browser_type`, `browser_fill_form`, `browser_navigate`) is followed by a `browser_snapshot` to observe the resulting state
- If the flow says "create X", note the unique identifiers (name, email, etc.) you used — you'll need them for cleanup
- If an intermediate check fails (expected button doesn't appear, created data isn't visible, an error shows on screen), **stop and report** what you observed to the user instead of continuing
- If the user said "if it's implemented", treat the absence of an element as a valid UAT finding, not as an error

## Step 5 — Cleanup via Supabase MCP

For each entity created during Step 4:

1. Authenticate against the Supabase MCP if needed (`mcp__supabase__authenticate`)
2. Delete the created rows using the unique ID/identifier you noted
3. Respect the reverse order of creation (children before parents) so you don't violate FKs

If cleanup fails on a row, **it is not blocking** — note it in the final report and suggest the user run `supabase db reset` if they want to return to the seed state.

## Step 6 — Report

In natural language (not formal PASS/FAIL), describe:

- Which role you logged in as and which pages you navigated to
- Which flow steps executed successfully and what you saw on screen
- Any divergence between expected and observed (mentioning what you saw in the snapshots)
- What data was left created or was cleaned up

If the entire flow went as the user expected, say so in one line. If there was a problem, describe it with enough detail for the user to know where to look.

## Final checklist

- [ ] I identified the correct role and it exists in the table
- [ ] Dev server responded on `http://localhost:3000` before starting
- [ ] Login completed without redirect to `/auth/error`
- [ ] Every flow step was followed by `browser_snapshot`
- [ ] If I created entities, I noted their identifiers for cleanup
- [ ] Cleanup executed or reported as pending with a reason
- [ ] Final report describes what was observed and any divergence

## After the UAT

**Hard gate.** If the Step 6 report shows divergence between the success criterion and what was observed in the browser, **do not report the task as complete**. Treat the divergence as a failed test:

1. **Persist the divergence by invoking `/write-bugs`** before any fix attempt. The BUGS.md entry is the durable record of what failed; without it, fix-and-retry loops lose track of what was actually broken.
2. Fix the implementation.
3. Re-run the UAT (back to Step 1 — or to Step 3 if the dev server and login are still valid).
4. Once the flow matches the criterion, invoke `/write-bugs --verify <ID>` for each logged bug to flip its fixed checkbox.
5. Iterate until the flow matches the criterion, or until you identify a blocker outside your scope.
6. If there is an out-of-scope blocker, **stop and ask the user** with the UAT report and BUGS.md entries attached.

There are no "silent passes". A UAT with unresolved divergence cannot be closed as a completed task.

**Order vs `/gsd-verify-work`.** This UAT is mechanical ("does the browser work?"). `/gsd-verify-work` is conversational ("is this what you wanted?"). They are complementary, not interchangeable. If a GSD workflow is active, the order is:

1. `/playwright-uat` (mechanical) → passes the hard gate.
2. `/gsd-verify-work` (conversational) → confirms the acceptance criterion with the human.
3. Only then report done.
