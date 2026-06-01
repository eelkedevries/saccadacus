# Status

Current state of implementation. Update the relevant row as the final step of
each prompt, before committing.

States: `not started`, `in progress`, `done`, `blocked`.

| Phase | Prompt                                       | State       | Commit |
|-------|----------------------------------------------|-------------|--------|
| 1     | 01_scaffold.md                               | done        | 3882b11 |
| 2     | 02_interfaces_and_mock.md                    | done        | ec66cd7 |
| 3     | 03_camera_and_frame_loop.md                  | done        | c3a7851 |
| 4     | 04_signals_and_rendering.md                  | done        | 8875dde |
| 5     | 05_events.md                                 | done        | ab9a863 |
| 6     | 06_tasks_and_export.md                       | done        | 195a585 |
| 7     | 07_backend_spike.md                          | done        | 41e3c04 |
| 8     | 08_production_backend_and_gaze_mapping.md    | done        | TBD    |
| 9     | 09_documentation.md                          | not started | —      |

The `Commit` column holds the short SHA of the commit that marked the phase
done. For a phase still in progress, leave it as `—`. For a blocked phase, add
a one-line note in the row below the table explaining what is blocking it and
which human decision is required.

Phase 7 note: this phase is a throwaway spike plus a decision record
(`docs-dev/decisions/0001-first-production-backend.md`). The MediaPipe adapter
is code-split and dev-gated behind `?spike=mediapipe`; it is not wired into the
default boot path. On-device benchmark numbers
(`docs-dev/references/phase7-benchmark.md`) are pending and need a human to run
them on the target devices before Phase 8 is confirmed.
