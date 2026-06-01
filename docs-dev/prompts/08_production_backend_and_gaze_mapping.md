Active prompt for Phase 8 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, the Phase 7 decision record, and the PROPOSAL.md sections
below. Phases 1-7 must be done and the production backend chosen.

Goal
  Implement the chosen production backend behind TrackingBackend and wire it into
  the default boot path, fit gaze mapping on follow-the-dots data per eye and per
  signal type, add mapped-signal switching with a reliability indicator, and add
  the mapped columns to the CSV export.

Relevant sections of PROPOSAL.md
  §11 follow-the-dots, §12 gaze mapping, §13 data model, §14 CSV export,
  §20 backend abstraction, §27 Phase 8.

Relevant files (create/extend)
  src/tracking/backendAdapters/<chosen backend>.ts, src/tasks/gazeMapping/*,
  and extensions to src/export/schema.ts and src/export/combinedCsv.ts, plus
  tests.

Implementation steps
  1. Implement the production backend chosen in Phase 7, inside
     src/tracking/backendAdapters/ (the only place CV imports and `any` are
     allowed). Echo pageTimestampMs unchanged (§24). Lazy-load/code-split per
     §26.
  2. Wire the real backend into the default boot path (this is the first phase
     where that is permitted; MockTrackingBackend remains available for tests
     and as a fallback). Preserve the explicit loading state from permission
     grant to backend-ready (§25).
  3. gazeMapping/: fit gaze-mapping models from dot-task data relating eye-local
     signals and head pose to screen positions. Fit separately for iris-based,
     pupil-based, left-eye, right-eye, and binocular/combined signals (§12).
     Report fit quality/reliability per mapping.
  4. After mapping is available, use the gaze-mapped signal by default while
     still showing and exporting the original eye-local signal (§12). Allow the
     user to switch between available mapped signals where reliable, with a
     reliability/fit-quality indicator.
  5. Extend the CSV: populate gaze_x_mapped, gaze_y_mapped, gaze_mapping_id, and
     gaze_mapping_reliability (§14). When gaze mapping is available, retain both
     the eye-local event features and the gaze-mapped features (§8).

Constraints
  CV imports and `any` only inside src/tracking/backendAdapters/. Still no raw
  landmark coordinates in CSV. Single combined CSV. No server storage, auth, or
  upload (hard rule). British spelling in user-facing strings.

Tests
  Vitest unit tests: gaze-mapping fit on synthetic dot data (known mapping
  recovered within tolerance) for each eye/signal variant; CSV round-trip
  including the populated gaze_* columns. React Testing Library: mapped-signal
  switch and reliability indicator. Extend Playwright per §26 where practical
  (dot rows aligned with the time axis; CSV contains expected row types).
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 8 -> done with commit SHA.
  4. Commit with message: 08_production_backend_and_gaze_mapping.
  5. Commit directly to the main branch and push to origin/main. Do not
     create, switch to, or work on a feature branch for this task.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
