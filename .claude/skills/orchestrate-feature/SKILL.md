---
name: orchestrate-feature
description: Orchestrates full feature implementation from .docs/features/<feature>/. Invoked per feature, iterates epic-by-epic and task-by-task, delegating each task to task-implementor and uat-verifier subagents with atomic commits and resumable state. Use when user wants to implement, build, develop, or continue a feature that has already been broken into epic files via /to-epics.
---

# Orchestrate Feature

End-to-end implementation runner for a feature already decomposed into `epic-N-<slug>.md` files by `/to-epics`.

The orchestrator itself is **skeletal**: it routes, it tracks state, it never writes implementation code. All technical work is delegated to two subagents — `task-implementor` and `uat-verifier`.

## Quick start

```
/orchestrate-feature <feature-folder-name>
```

Example: `/orchestrate-feature pacientesModule` → iterates every epic file under `.docs/features/pacientesModule/`, executes pending tasks in order, maintains `STATE.md`.

If no argument is passed, list available features under `.docs/features/` with `AskUserQuestion` and let the user pick.

## Preconditions

Before delegating anything, verify:

1. `.docs/features/<feature>/PLAN.md` exists. If not, abort: `"<feature>/PLAN.md not found. Available features: <list>"`.
2. At least one `epic-*.md` file exists in the folder. If not, abort: `"No epic files found. Run /to-epics <feature> first."`.
3. The repo working tree is clean (`git status --porcelain` empty). If dirty, `AskUserQuestion`: `[Stash and proceed / Commit and proceed / Abort]`.

## Workflow

### 1. Build the execution plan

1. Read `PLAN.md` only to enumerate epic count and titles (cheap parse).
2. For each `epic-N-<slug>.md` in numeric order, parse the `<task>` blocks (regex: `<task>\s*<name>([^<]+)</name>` plus `<action>...</action>` and `<acceptance_criteria>...</acceptance_criteria>`). Keep the **literal text** of each block — that text is what the implementor receives.
3. Read `.docs/features/<feature>/STATE.md` if it exists. If missing, treat as empty.
4. **Reconcile**:
   - For each task in spec not present in STATE.md → add row as `pending`.
   - For each STATE.md task no longer in spec → keep row, mark `removed-from-spec` (do not touch commit).
   - For each task with status `in-progress` → halt and `AskUserQuestion`:
     - `Retry from scratch (revert partial commit if any, mark pending)`
     - `Mark failed (keep commit, skip rest of task)`
     - `Mark done manually (assume the human finished it)`
5. Build the execution queue: all tasks with status `pending`, in spec order (epic ascending, then task ascending within epic).

### 2. Confirm with the user

Print a one-screen plan:

```
Feature: pacientesModule
Epics: 7
Tasks: 28 total — 14 done, 0 failed, 14 pending

Will execute, in order:
  Epic 1 — Task 1.3  Shared entity hooks (EtapaTratamiento, Nivel)
  Epic 1 — Task 1.4  RLS audit on sensitive clinical data
  Epic 2 — Task 2.1  Patient list page
  ...

Mode: atomic commit per task · UAT inferred from files touched · 1 retry on UAT failure then escalate
```

`AskUserQuestion`: `[Proceed / Cancel]`. Cancel → exit cleanly, change nothing.

### 3. Execute the queue

For each task in queue, in order:

#### 3a. Mark in-progress

Append/update STATE.md row: `status: in-progress, started_at: <ISO timestamp>`. Write the file immediately — it's the crash-recovery anchor.

#### 3b. Delegate to `task-implementor`

```
Task(
  subagent_type: "task-implementor",
  description: "Implement task <N.M>",
  prompt: <see prompt template below>
)
```

**Prompt template for the implementor** (the orchestrator builds this string):

```
You are implementing one atomic task from a feature spec.

Feature: <feature-name>
Epic file: .docs/features/<feature>/epic-<N>-<slug>.md
Task: <N.M>

Task spec (verbatim from the epic file):

<task>
<name>Task <N.M> — <name></name>
<action>
<full action text>
</action>
<acceptance_criteria>
<full acceptance criteria>
</acceptance_criteria>
</task>

Recent deviations from earlier tasks in this feature (only those that may affect you):
<filtered notes from STATE.md — only tasks referenced in this <action>, or all tasks of the same epic, max 10 lines>

Mandatory rules:
1. If your task touches ANY .ts file, invoke /tdd skill BEFORE writing implementation code.
2. If your task creates a new page/route → invoke /new-page skill first.
3. If your task creates a shared entity controller → invoke /fetch-entity skill first.
4. If your task modifies supabase/schemas/*.sql → invoke /supabase-migration skill.
5. If your task installs a shadcn component → invoke /shadcn skill.
6. Otherwise, edit files directly.
7. Before committing, run in order: `npx prettier --write .`, `npm run lint`. Husky will run typecheck + jest on commit.
8. Commit with message:

   feat(<feature>/task-<N.M>): <task name>

   <one-line summary of what changed>

   Closes task <N.M> of .docs/features/<feature>/epic-<N>-<slug>.md

9. Return a final JSON object on the LAST line of your response:

   {"status":"done|failed","commit_sha":"<sha>|null","deviations":"<text>","files_modified":["..."],"failure_reason":"<text-if-failed>"}

Project rules are loaded automatically from CLAUDE.md. Do not invent files outside the **Files:** section of the action without noting it as a deviation.
```

The orchestrator parses the last line of the implementor's response as JSON. If parsing fails, treat as `failed` with reason `"implementor did not return structured output"`.

#### 3c. Decide if UAT runs

Inspect `files_modified` from the implementor's return:

- **Run UAT** if any of: `.tsx` file, `app/**/*ViewModel.ts`, `app/**/controllers/**/*.ts` that is consumed by an existing View (grep `import.*from.*controllers` in `.tsx` files), or `proxy.ts`/`lib/supabase/*`.
- **Skip UAT** if only: `supabase/**`, `**/*.test.ts`, files under `lib/email/`, Edge Functions, config files (`tsconfig.json`, `eslint.config.mjs`, `.prettierrc`).
- **Ambiguous** (a `.ts` controller with no View consumer yet): mark UAT as `deferred` in STATE.md notes. Do not run the verifier.

If skipped or deferred: jump to step 3e with `passed: true`.

#### 3d. Delegate to `uat-verifier`

```
Task(
  subagent_type: "uat-verifier",
  description: "UAT task <N.M>",
  prompt: <see prompt template below>
)
```

**Prompt template for the verifier**:

```
You are verifying that an already-implemented task meets its acceptance criteria via /playwright-uat.

Feature: <feature-name>
Task: <N.M>
Commit just landed: <commit_sha>
Files modified: <list>

Task acceptance criteria (verbatim):

<acceptance_criteria>
<criteria>
</acceptance_criteria>

Your job:
1. Invoke the /playwright-uat skill with the acceptance criteria as the mini-spec.
2. Capture the skill's report.
3. Return a final JSON object on the LAST line:

   {"passed":true|false,"report":"<text>","failures":["criterion: reason", ...]}
```

If the verifier returns `passed: false`, run **one retry** of the implementor with this addendum prepended to the implementor prompt:

```
PREVIOUS ATTEMPT FAILED UAT.
Failures reported by the verifier:
<failures list>
Full UAT report:
<report>

Apply minimal fixes that address each failure. Do not re-do work that already passed.
```

After the retry, run the verifier again. If it still fails:

`AskUserQuestion`:

- `Retry once more with manual hint` (asks user for a free-text hint, re-runs implementor + verifier)
- `Skip and mark failed in STATE.md` (continues to next task, marks downstream `blocked` if they reference this one)
- `Abort feature` (stops the orchestrator; STATE.md keeps current state)

#### 3e. Update STATE.md

Write the final row for this task:

| Column       | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| `task`       | `<N.M> — <name>`                                                       |
| `status`     | `done` / `failed` / `skipped` / `blocked`                              |
| `closed_at`  | ISO timestamp                                                          |
| `commit_sha` | from implementor return (null if no commit)                            |
| `notes`      | from `deviations` field; empty string if the implementor reported none |

#### 3f. Check downstream impact (only if `failed` or `skipped`)

Scan the remaining queue: any task whose `<action>` contains a literal reference to `task <N.M>` or the file paths the failed task should have produced → mark `blocked` preemptively in STATE.md. Do not execute them.

### 4. Final summary

After the queue is exhausted (or aborted), print:

```
Feature: pacientesModule
Result: <DONE | PARTIAL | ABORTED>

  done:    23
  failed:   2
  blocked:  3
  skipped:  0

Failed tasks:
  - 4.3 — Treatment plan auto-calendar  (commit a1b2c3d, UAT failed: see STATE.md notes)
  - 5.2 — Activation email template     (commit not created, see STATE.md notes)

Blocked downstream:
  - 4.4, 4.5  (depend on 4.3)
  - 5.3       (depends on 5.2)

Next step:
  1. Resolve the failed tasks manually.
  2. Re-run /orchestrate-feature pacientesModule to retry blocked ones.
```

If everything is `done`: suggest the next step (e.g. `/gsd-ship` or open a PR).

## State file format

`.docs/features/<feature>/STATE.md`:

```markdown
# <feature> — Execution State

> Maintained by /orchestrate-feature. Do not edit by hand unless you know what you are doing.

| Task                               | Status      | Closed at         | Commit  | Notes                                                             |
| ---------------------------------- | ----------- | ----------------- | ------- | ----------------------------------------------------------------- |
| 1.1 — Resend integration (sandbox) | done        | 2026-05-15T18:22Z | a1b2c3d | UAT skipped (no UI)                                               |
| 1.2 — Missing UI primitives        | done        | 2026-05-15T19:40Z | e5f6a7b |                                                                   |
| 1.3 — Shared entity hooks          | done        | 2026-05-16T11:00Z | f3c2a1b | Renamed EtapaTratamiento → Etapa to match existing supabase types |
| 1.4 — RLS audit                    | in-progress | —                 | —       | started 2026-05-16T14:00Z                                         |
```

Status values:

- `pending` — not started
- `in-progress` — implementor running; crash-recovery anchor
- `done` — implementor + verifier both passed
- `failed` — exhausted retries; user chose Skip
- `blocked` — a dependency failed; not attempted
- `skipped` — user chose to skip without trying (rare)
- `removed-from-spec` — was in STATE.md, no longer in the epic file

## Tools the orchestrator uses

Only what is needed for routing and state I/O:

- `Read` — PLAN.md, epic files, STATE.md
- `Glob` — enumerate `epic-*.md`
- `Grep` — parse `<task>` blocks, search for cross-task references
- `Write` / `Edit` — maintain STATE.md
- `Bash` — `git status`, `git log`, `git cat-file` for SHA validation
- `Task` — delegate to `task-implementor` and `uat-verifier`
- `AskUserQuestion` — confirm initial plan, escalate failures, resolve `in-progress` on cold start

The orchestrator **never** invokes implementation skills directly (`/tdd`, `/new-page`, etc.) — those are the implementor's responsibility.

## Edge cases

1. **No `<task>` blocks in an epic file** — warn, skip the epic, continue.
2. **STATE.md exists but is malformed** — abort with: `"STATE.md is malformed. Fix manually or delete to start fresh."`
3. **A subagent returns no JSON on the last line** — treat as `failed` with reason `"no structured output returned"`.
4. **Husky pre-commit hook blocks the implementor's commit** — the implementor returns `failed` with the hook output as `failure_reason`. The orchestrator does not retry automatically (the failure is real); it escalates.
5. **The user adds a new task to an epic file mid-run** — only seen on the next invocation. Within a single run, the queue is built once at step 1.
6. **Multiple tasks reference the same files** — no special handling; sequential execution serializes naturally.
7. **A task's `<action>` references a sibling task by `task <N.M>` text but that task is `pending`** — only happens if the spec is out of order. Honor spec order anyway; let the implementor fail if a dependency is missing, then the orchestrator escalates.

## What this skill is NOT

- It is not a planning tool. The plan is `PLAN.md` + epic files, produced by `/to-epics`.
- It is not a code reviewer. Use `/gsd-code-review` or `/ultrareview` after the feature is done.
- It is not a PR creator. Use `/gsd-ship` or `gh pr create` after.
- It does not modify the spec. The `<action>` blocks are immutable contracts.
