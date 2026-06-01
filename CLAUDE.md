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

---

## Known proposal/prompt divergences

Recorded per the rule above, for later reconciliation of `PROPOSAL.md`:

- **Commit-and-push wording.** Every prompt's final step reads "Commit directly
  to the main branch and push to origin/main. Do not create, switch to, or work
  on a feature branch for this task." `PROPOSAL.md` §30 and `AGENTS.md`
  ("Commit and push policy") express the same intent more briefly ("Push to
  main"; commit message = prompt filename without `.md`). The prompt wording is
  authoritative for execution; the two are consistent in intent.
- **Self-hosting model assets.** Decision 0001 records that the production
  MediaPipe backend should self-host the wasm and `.task` assets in Phase 8. The
  current implementation loads them from a CDN at runtime; self-hosting remains
  an open hardening task. This does not affect the static-site or no-upload
  constraints, since the fetch is the user's browser pulling a public model.
