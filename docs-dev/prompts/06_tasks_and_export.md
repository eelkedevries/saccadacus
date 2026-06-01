Active prompt for Phase 6 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-5 must be done.

Goal
  Add the calibration-free quality check, the follow-the-dots task with dot
  recording, and the single combined CSV export. All still driven by
  MockTrackingBackend.

Relevant sections of PROPOSAL.md
  §10 calibration-free quality check, §11 follow-the-dots task, §13 data model,
  §14 CSV export, §15 interaction flow, §26 testing scope.

Relevant files (create)
  src/tasks/qualityCheck/*, src/tasks/followTheDots/*, src/export/schema.ts,
  src/export/combinedCsv.ts, supporting panels under src/app/panels/, plus tests.

Implementation steps
  1. Quality check (§10): guided prompts (look left/right/up/down, blink, keep
     head still, move head slightly) presented as a functional check, NOT a gaze
     calibration. Use the results to indicate whether the current tracking and
     eye-selection modes are reliable and whether iris or pupil is currently
     better. Plain instructional strings, British spelling, no emojis.
  2. Follow-the-dots (§11): present dots at random screen positions until the
     user presses stop. For each dot store dot x/y, onset timestamp, offset/
     replacement timestamp, and the aligned eye-local and head-pose signals,
     plus selected tracking mode, eye mode, and reliability. Use the same
     performance.now() clock as the tracking data so dots align with the
     time series. Emit DotEvent records (§21).
  3. schema.ts: define the canonical CSV column set and the camelCase ->
     snake_case mapping (AGENTS.md spelling/naming rule). Columns follow §14:
     time-series, event, and dot/task columns, with a row_type column
     distinguishing row classes. Include derived signals only — NO raw landmark
     coordinates (hard rule, §14, §29). Leave gaze_* columns defined but empty
     until Phase 8.
  4. combinedCsv.ts: produce ONE combined CSV containing time-series rows, event
     rows, and dot/task rows, distinguished by row_type (§14). Record actual
     camera settings where relevant (§25). Export is local/browser-side only —
     no server storage, auth, or upload (hard rule, §29).

Constraints
  No raw landmark coordinates in CSV. Single combined CSV. No `any` outside
  backendAdapters. No CV imports. British spelling in user-facing strings;
  snake_case CSV columns per the schema mapping.

Tests
  Vitest unit tests: combined CSV row formatting and round-trip parse (write
  then parse back to equal values) for each row type; quality-check reliability
  decision logic. React Testing Library: follow-the-dots task lifecycle
  (start -> dots recorded -> stop) and export controls/status. If a Playwright
  test for CSV download is added, keep it aligned with §26.
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 6 -> done with commit SHA.
  4. Commit with message: 06_tasks_and_export.
  5. Commit directly to the main branch and push to origin/main. Do not
     create, switch to, or work on a feature branch for this task.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
