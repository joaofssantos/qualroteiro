---
name: spec-kit
description: Full spec-driven development (GitHub Spec Kit method) for non-trivial tasks — specify → plan → tasks → implement, scoped to your package, committed in the PR.
---

# spec-kit — full spec-driven development

For a **non-trivial** task (a new contract, a new package/service, a migration,
anything the router sends here), work **spec-first**, **scoped to your package**,
following the Spec Kit method:

1. **Specify** — the *what* and *why*, focused on your package's slice.
2. **Plan** — tech approach and architecture.
3. **Tasks** — the actionable breakdown.
4. **Implement** — build against the plan, TDD.

Commit the spec/plan/tasks **into your PR**. Installing this kit materialized the
real Spec Kit into the repo — the `/speckit.*` slash commands (`.claude/commands/`)
plus its templates and scripts (`.specify/`) — so drive it with
`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
Do not run this heavy flow on a trivial edit — that is what **sdd-lite** is for.
