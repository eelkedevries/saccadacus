# CLAUDE.md

Claude Code reads this file at session start. All operating rules live in
`AGENTS.md`; this file points there and lists Claude-specific items only.

---

## Read first

1. `AGENTS.md` — hard rules, commands, definition of done, final-overview format.
2. `docs-dev/STATUS.md` — current phase.
3. The active prompt file in `docs-dev/prompts/`. If the user's message does not
   name one, take the lowest-numbered prompt whose commit is not yet in `git log`.
4. `docs-dev/PROPOSAL.md` — consult the sections referenced by the active prompt.

---

## Claude-specific notes

- Treat the hard-rules block in `AGENTS.md` as inviolable. If a user request
  appears to conflict with one, surface the conflict in the response rather
  than silently complying.
- The three-part final overview defined in `AGENTS.md` is required at the end
  of every prompt execution, including those that succeed without issues.
- Do not push to `main` unless the active prompt explicitly instructs it
  (per `AGENTS.md`, "Commit and push policy").
- When a section of `PROPOSAL.md` and a prompt file disagree, the prompt file
  wins for that task. Note the discrepancy in section 3 of the final overview
  so the proposal can be reconciled.
