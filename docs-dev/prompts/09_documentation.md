Active prompt for Phase 9 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-8 must be done.

Goal
  Write the public, product-facing documentation and in-app help text, document
  the CSV columns, and reconcile the prompt files and agent guides against the
  workflow conventions.

Relevant sections of PROPOSAL.md
  §17 repository and documentation expectations, §27 Phase 9, §30 workflow and
  prompt conventions.

Relevant files (create/extend)
  README.md (public, product-facing), in-app help text under src/app/,
  CSV-column documentation (e.g. docs-dev/references/ or a user-facing help
  section), and review of docs-dev/prompts/ and AGENTS.md/CLAUDE.md.

Implementation steps
  1. README.md (§17): present saccadacus as an eye-movement tracking app with
     optional gaze mapping. Explain what it does, how to run it, how to use the
     live tracking view, how to switch iris/pupil modes, how to switch
     eye-selection modes, how to interpret reliability indicators, how to run
     the quality check, how to run follow-the-dots, how to export CSV, and what
     the exported rows represent. Product- and demo-focused. Keep internal
     agent/prompt material OUT of the README — it lives in docs-dev/ (§17, §30).
  2. In-app help text: concise, plain, British spelling, no marketing copy or
     emojis (§28). Explain the live view, switches, reliability, quality check,
     follow-the-dots, and export.
  3. CSV column documentation: document every exported column and each row_type,
     matching src/export/schema.ts and §14, including the gaze_* columns from
     Phase 8.
  4. Review docs-dev/prompts/ and AGENTS.md/CLAUDE.md against §30: each prompt
     self-contained with goal, files, steps, tests, commit/push, and the
     three-part final-overview requirement. Note and fix any drift; where
     PROPOSAL.md and a prompt disagree, the prompt wins for its task and the
     discrepancy is recorded (CLAUDE.md note).

Constraints
  No marketing copy or emojis in user-facing strings. British spelling. Do not
  move internal material into the README. No new dependencies.

Tests
  Documentation phase; little code. Verify any documented commands actually run.
  If link-checking or markdown lint exists, run it; otherwise state that no
  automated test applies. Run `npm run typecheck`, `npm run lint`, `npm run test`
  to confirm nothing regressed.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 9 -> done with commit SHA.
  4. Commit with message: 09_documentation.
  5. Commit directly to the main branch and push to origin/main. Do not
     create, switch to, or work on a feature branch for this task.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
