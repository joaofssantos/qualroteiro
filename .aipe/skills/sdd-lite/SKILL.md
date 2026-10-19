---
name: sdd-lite
description: Lightweight spec-first floor for a task — a short spec, evidence, and a task doc, committed in the PR. Always available; use it for any change that is not covered by the full spec-kit flow.
---

# sdd-lite — the spec-first floor

Even a small change keeps a paper trail. Before touching code, write a **short
spec** in the PR/worktree, then work against it, then attach **evidence**.

## 1. Mini-spec (a few lines, not a document)
- **Problem** — what is being changed and why (1–2 sentences).
- **Scope** — the exact files/behaviour in; what is explicitly out.
- **Acceptance** — how we know it's done (observable checks).

## 2. Build against it
Make the change. If it grows beyond "small" (new contract, cross-package impact,
migration), stop and escalate — that task wants the full **spec-kit** flow.

## 3. Evidence (this is the point)
Commit, alongside the change, objective proof it works:
- test output / a new characterization test,
- a screenshot or captured command output for anything user-visible,
- a one-paragraph task doc: what changed, how it was verified, what was left out.

No commits are authored without the PE's go; evidence travels in the PR.
