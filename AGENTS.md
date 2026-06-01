# AGENTS.md

Shared operating rules for coding agents working on `saccadacus`. `CLAUDE.md` points
to this file. The full product and architecture specification is in
`docs-dev/PROPOSAL.md`.

---

## Read first, in order

1. This file (`AGENTS.md`).
2. `docs-dev/STATUS.md` — current phase and completion state.
3. The active prompt in `docs-dev/prompts/` — the lowest-numbered file whose commit
   is not yet in `git log`, unless a specific prompt is named in the user's message.
4. `docs-dev/PROPOSAL.md` — consult the sections referenced by the active prompt.
5. `docs-dev/architecture/GLOSSARY.md` — defined terms.

---

## Hard rules (never)

These are inviolable. If a user request appears to conflict with any of them,
surface the conflict rather than silently complying.

- Do not import any face-landmark, eye-tracking, or computer-vision library
  outside `src/tracking/backendAdapters/`.
- Do not use `any` outside `src/tracking/backendAdapters/`.
- Do not add OpenCV.js or WebGazer.js as dependencies.
- Do not transfer `OffscreenCanvas` to a worker for overlay rendering.
- Do not use `requestVideoFrameCallback` as the frame-pacing source.
- Do not include raw landmark coordinates in v1 CSV output.
- Do not place emojis, marketing copy, or decorative iconography in user-facing
  strings.
- Do not commit or push unless the active prompt explicitly instructs it.
- Do not introduce server-side storage, authentication, or upload paths in v1.
- Do not wire a real tracking backend into the default boot path before Phase 8.
  `MockTrackingBackend` remains the default through Phase 7.
- Do not store continuous signals in Zustand or any reactive store. Ring buffers
  only.

---

## Commands

Node 20 LTS, npm canonical (per `npm ci` in `.github/workflows/deploy.yml`).

```text
Install:     npm ci
Dev server:  npm run dev
Typecheck:   npm run typecheck    # tsc --noEmit
Lint:        npm run lint
Format:      npm run format
Unit tests:  npm run test
E2E tests:   npm run test:e2e
Build:       npm run build
```

Playwright browsers are installed on first CI run. Local E2E may require
`npx playwright install` once.

---

## Definition of done

Before any commit:

- typecheck passes
- lint passes
- relevant unit tests pass
- no new `any` outside `src/tracking/backendAdapters/`
- no new computer-vision library imports outside `src/tracking/backendAdapters/`
- British spelling preserved in project-defined identifiers and user-facing strings
- three-part final overview written (see below)

If a test cannot be added for a piece of work, state why in the final overview
rather than omitting it silently.

---

## Final overview format

Every prompt ends with a concise overview in three parts. The format is
mandatory even when the task succeeds without issues. Use `none` where a
section legitimately has nothing to report.

```text
1. Work completed
   - <what was implemented; whether the full request was completed;
     whether everything succeeded>
2. Open issues
   - <failing tests, unresolved errors, deferred decisions; or `none`>
3. Human actions required
   - <what the human must do before the next prompt; or `none`>
```

### Worked example, for `01_scaffold.md`

```text
1. Work completed
   - Vite + React 19 + TypeScript scaffold created with strict mode and
     noUncheckedIndexedAccess enabled.
   - Tailwind, Vitest, Playwright, ESLint, Prettier configured.
     `npm run lint` and `npm run test` both pass.
   - Repository layout per §19 created, including empty docs-dev/
     subdirectories and a placeholder src/tracking/backendAdapters/README.md.
   - Deployment workflow added at .github/workflows/deploy.yml with
     base: '/saccadacus/' set in vite.config.ts.
   - All steps requested in 01_scaffold.md completed successfully.

2. Open issues
   - Playwright browsers not yet installed in CI; first PR run will install them.
   - No real test cases yet; only Vitest's self-check is exercised.

3. Human actions required
   - Confirm GitHub Pages source is set to the deploy-pages workflow output.
   - Push the initial commit if not already pushed.
```

---

## Spelling and naming

- British spelling in project-defined identifiers, file names, and user-facing
  strings: `colour`, `behaviour`, `centre`, `initialise`, `analyse`, `normalise`,
  `visualisation`.
- Platform and library APIs follow upstream spelling: `color` in CSS, `behavior`
  on DOM scroll options, `analyze` if a library exposes that name. Do not rename.
- TypeScript identifiers: camelCase. CSV columns: snake_case. The mapping lives
  in `src/export/schema.ts`. Do not harmonise one form to the other.
- Variable names include units where ambiguity is possible: `xLocal`, `yLocal`,
  `yawDeg`, `pitchDeg`, `rollDeg`, `tsMs`, `reliability`.

---

## Coding conventions

- TypeScript strict, `noUncheckedIndexedAccess` enabled.
- ESLint with typescript-eslint, recommended-type-checked. Prettier on save.
- Component files: small and single-purpose.
- React hooks: roughly 50 lines or fewer.
- Signal-processing functions: pure, inputs accepted explicitly.
- No marketing copy, emojis, or decorative iconography in user-facing strings.
- Agent workflow notes do not belong in source files. Workflow rules live here.

---

## Commit and push policy

- Default branch is `main`. No feature branches in v1; direct commits to `main`
  are expected. Revisit when the project leaves v1.
- Commit and push only when the active prompt explicitly instructs it.
- When instructed, the commit message is the prompt filename without the `.md`
  extension (for example, `03_camera_and_frame_loop`).
- Exploratory work, debugging, and review tasks: do not commit.

---

## When blocked

If a task cannot be completed as written:

- Do not improvise around a hard rule above.
- Do not silently skip tests or commit failing code.
- Stop. Write the three-part final overview, describing the obstacle in
  section 2 and the required human decision in section 3. Exit.

---

## Project layout, condensed

Full layout in §19 of `docs-dev/PROPOSAL.md`. Constraints that recur:

- `src/tracking/backendAdapters/` is the only directory permitted to import
  face-landmark or CV libraries.
- `src/tracking/MockTrackingBackend.ts` is the default backend through Phase 7.
- Continuous signals live in pre-allocated `Float32Array` ring buffers.
  Timestamps use `Float64Array`.
- The single canonical clock is `performance.now()` (§24).
