---
name: write-bugs
description: Persists bug findings to `<featurePath>/BUGS.md` after `/playwright-uat` (or any other source) identifies divergences from expected behavior. Each entry follows a fixed template (ID, name, status, severity, symptom, expected, repro, technical description, hypothesis, evidence, acceptance criteria) and is feature-scoped (`PAC-001`, `TRE-001`, …). Use when the user says "log this bug", "anotá los bugs", "escribí los findings", "documentá lo que falló", or when `/playwright-uat` reports divergences and the agent needs to persist them before fix-and-retry. Also exposes a `--verify <ID>` mode that re-runs a logged bug's reproduction and flips its fixed checkbox only when acceptance criteria pass. **Mandatory gate** when `/playwright-uat` finds divergences — persist before iterating on the fix.
---

# Write Bugs

Captures and persists UAT findings in a feature's `BUGS.md`. Generic across features; protocol is fixed.

## When to invoke

- ✅ `/playwright-uat` reported one or more divergences from the success criterion — **mandatory** before any fix attempt (see [playwright-uat SKILL.md](../playwright-uat/SKILL.md) "After the UAT").
- ✅ User asks to log/persist/document a bug or finding (es/en).
- ✅ Re-verifying a previously-logged bug after a fix → use `--verify <ID>` mode.
- ❌ Re-runs that surface no new divergences and no fixes to verify.

## Invocation surface

| Form                                 | Effect                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/write-bugs`                        | Log new bug(s) from current conversation context into the auto-detected feature's `BUGS.md`.                                                                     |
| `/write-bugs --verify <ID>`          | Re-run that bug's repro; if all acceptance criteria pass, flip `Status: [x] fixed` and append a `Verified fixed on <date>` note. One ID at a time — no batching. |
| `/write-bugs --feature <folderName>` | Override feature auto-detection. Composes with the default and `--verify` forms.                                                                                 |

## Step 1 — Resolve the feature folder

Cascade (stop at first match):

1. `--feature <X>` arg present → use `.docs/features/<X>/`. If the folder is missing, **stop and ask**.
2. Exactly one folder under `.docs/features/` → use it.
3. Multiple folders → pick the one whose `STATE.md` was modified most recently in the last 7 days.
4. Still ambiguous → `AskUserQuestion` listing all candidates.

Derive the ID prefix from the folder name: take the first three letters of the first camelCase segment, uppercased. `pacientesModule` → `PAC`. `treatmentEngine` → `TRE`. If the folder name is one word ≤ 3 chars or otherwise unclear, ask the user for the prefix before continuing.

## Step 2 — Read existing BUGS.md (if any)

Find the highest existing `<PREFIX>-NNN` and use `NNN + 1` zero-padded to 3 digits. If `BUGS.md` does not exist yet, create it with an H1 (`# Bugs — <featureName>`) and start at `<PREFIX>-001`.

## Step 3 — Default mode: log new bugs

For each finding the caller has in context:

1. **Severity** (two-tier rule, no default):
   - Blocks the UAT success criterion or any acceptance criterion → `blocker` or `major`.
   - Adjacent observation noticed during the flow (cosmetic, console warning, off-spec copy) → `minor` or `cosmetic`.
   - If you would not block shipping on it, it cannot be `major` or higher.
2. **Dedupe check.** Scan existing entries with `Status: [ ]`. If any has a similar _symptom_ + _repro_ to the new one, **stop and ask** with `AskUserQuestion`:

   > "This looks like `<PREFIX>-NNN` (<name>). Update that entry, or log as new?"

   On the "update" branch: append `Re-observed on <YYYY-MM-DD> during <flow>` under the existing entry's `**Found:**` line.

3. **Show the rendered entries in the conversation** before writing — the user reviews them there.
4. **Append** the new entries to BUGS.md using the template below.

## Step 4 — Verify mode (`--verify <ID>`)

1. Read the entry from BUGS.md. If not found, stop.
2. Re-run the reproduction:
   - UI-testable → build a `/playwright-uat` mini-spec from the entry's "Reproduction steps" + "Acceptance criteria" and invoke it.
   - Not UI-testable → walk the steps in the conversation.
3. Outcome:
   - **All acceptance criteria pass and the bug no longer reproduces** → flip `Status: [ ] fixed` to `Status: [x] fixed`, tick each `- [ ]` under Acceptance criteria, and append `**Verified fixed on <YYYY-MM-DD>** by re-running <flow>.` under the Status line.
   - **Still reproduces or any criterion fails** → leave the checkbox unticked and append `**Re-verified on <YYYY-MM-DD>** — still reproduces (or: criterion <X> still failing).`

Do not assume verification — actually re-run.

## Entry template

```markdown
## <PREFIX>-NNN — <Short name describing the bug at a glance>

**Status:** [ ] fixed
**Severity:** blocker | major | minor | cosmetic
**Found:** <YYYY-MM-DD> (during /playwright-uat run of "<flow name>")

### Symptom (what the user/tester observed)

One or two sentences in plain language. What was on the screen, what did or didn't happen.

### Expected behavior

What should have happened instead, and _why_ this counts as a bug (link to the acceptance criterion or design contract it violates, if applicable).

### Reproduction steps

1. Login as `<seed-email>`
2. Navigate to `<URL>`
3. ...
4. Observe: <the wrong thing>

### Technical description (low-level)

What is happening under the hood. File paths, function names, network calls, console errors, mismatched types — anything the implementer would grep for.

### Hypothesis

The most likely root cause, stated as a falsifiable claim. e.g. "The fetch in `fetchPlanByPacienteId.ts:42` filters by `terapeuta_id` instead of `paciente_id`, so therapists see an empty plan."

### Evidence needed to confirm/refute the hypothesis

- <Concrete check 1 — e.g. log the actual query in the network tab>
- <Concrete check 2 — e.g. compare against `supabase/schemas/plan.sql`>

### Acceptance criteria for "fixed"

- [ ] <Observable condition 1>
- [ ] <Observable condition 2>
- [ ] (optional) A regression test exists in `app/.../<file>.test.ts`
```

## Final checklist

- [ ] Feature folder resolved (explicit arg, single folder, recency, or asked)
- [ ] ID prefix derived from folder name (or asked when unclear)
- [ ] Every new entry has an explicit severity — no defaults
- [ ] Dedupe check ran against open entries; ambiguous matches were surfaced to the user
- [ ] Rendered entries were shown in the conversation before being written
- [ ] For `--verify`, the reproduction was actually re-run (UAT or manual walk) — never assumed
