You are working on `saccadacus`, a static GitHub Pages web app for browser-based
eye-movement tracking. Before doing anything, read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the sections of docs-dev/PROPOSAL.md referenced below.
This is the active prompt for Phase 1.

Goal
  Create the project scaffold so that every later phase can build on a working,
  lint-clean, test-clean toolchain that deploys to GitHub Pages.

Relevant sections of PROPOSAL.md
  §18 technical stack, §19 repository structure, §26 build/test/deploy,
  §28 coding conventions, §30 workflow and prompt conventions.

Relevant files (create)
  package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx,
  src/app/App.tsx, .eslintrc / eslint config, .prettierrc, vitest config,
  playwright config, .github/workflows/deploy.yml, AGENTS.md, CLAUDE.md,
  the full docs-dev/ tree (prompts/, architecture/, decisions/, references/,
  notes/), and the empty src/ tree from §19 including
  src/tracking/backendAdapters/README.md.

Implementation steps
  1. Initialise a Vite + React 19 + TypeScript project. Enable strict mode and
     noUncheckedIndexedAccess in tsconfig.json.
  2. Add and configure Tailwind CSS, Vitest, React Testing Library, Playwright
     (Chromium, Firefox, WebKit), ESLint with typescript-eslint
     recommended-type-checked, and Prettier. Wire npm scripts: dev, build,
     typecheck (tsc --noEmit), lint, format, test, test:e2e — exactly as listed
     in AGENTS.md "Commands".
  3. Set base: '/saccadacus/' in vite.config.ts (§26).
  4. Create the directory layout from §19. Where a module is not yet
     implemented, leave the directory present (use a .gitkeep or a placeholder
     README only where §19 specifies one, e.g.
     src/tracking/backendAdapters/README.md describing the interface contract).
  5. Add .github/workflows/deploy.yml that runs npm ci, lint, Vitest, vite build,
     and publishes via actions/deploy-pages. Run Playwright on pull requests but
     do not make it a deployment gate.
  6. Render a minimal App shell (plain heading and a status placeholder, no
     marketing copy, no emojis) so dev and build succeed.
  7. Add one trivial Vitest unit test and one trivial Playwright test (app
     loads) so the test commands exercise something real.

Constraints
  Do not add any face-landmark, eye-tracking, or computer-vision library. Do not
  add OpenCV.js or WebGazer.js. No `any` outside src/tracking/backendAdapters/.
  British spelling in identifiers and user-facing strings (§28). No emojis or
  marketing copy.

Tests
  Run `npm run typecheck`, `npm run lint`, and `npm run test`. All must pass.
  Playwright browsers install on first CI run; note this rather than blocking.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: set Phase 1 to done and record the commit SHA.
  4. Commit the changes with message: 01_scaffold.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed — what was implemented and whether the full request
     succeeded.
  2. Open issues — failing tests, unresolved errors, deferred decisions, or
     `none`.
  3. Human actions required — e.g. confirm GitHub Pages source is the
     deploy-pages workflow output; or `none`.
