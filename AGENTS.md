# Repository Guidelines
## Project Structure & Module Organization
- The Vite/React app lives in `src/` with feature-specific folders (`features`, `components`, `hooks`) and shared utilities in `lib`, `utils`, and `config`.
- Cloudflare edge middleware sits under `functions/`, while deployment and maintenance scripts are in `scripts/` and root `.mjs` helpers; add new automation there instead of `src/`.
- Use `public/` for static assets, `supabase/` and `sql/` for backend schema/config exports, and `tests/` or `src/test/` for browser automation and scripted operational checks.

## Build, Test & Development Commands
- `npm run dev`: start the Vite dev server with `.env.local`; verify feature flags before demos.
- `npm run build`: generate production assets in `build/`; run before committing configuration or CDN changes.
- `npm run preview`: locally serve the built bundle for smoke-testing.
- `npm run lint` / `npm run type-check`: enforce ESLint and strict TypeScript; run prior to every push.
- `npm run health-check:ci`: chained dead-code scan, type check, and lint; use as a release gate.
- `npm run cf:deploy`: publish `build/` to Cloudflare Pages when authenticated with the correct account.

## Coding Style & Naming Conventions
- Follow strict TypeScript; prefer typed React function components and extract shared logic into hooks.
- Stick to 2-space indentation and single quotes as in `src/App.tsx`; rely on ESLint for formatting guardrails.
- Use path aliases from `tsconfig.json` (`@/`, `@components/`, etc.) to avoid brittle relative imports.
- Name utilities and services in `camelCase`, React components in `PascalCase`, and custom hooks with a `use` prefix.
- Apply `npm run lint -- --fix` where safe; never hand-format contrary to lint output.

## Testing Guidelines
- Playwright specs reside in `tests/*.spec.ts`; run `npx playwright test tests/apple-login-language-test.spec.ts` before merging auth or localization changes.
- Operational scripts in `src/test/` expect `tsx` or `ts-node`; execute with `npx tsx src/test/<file>.ts` and document required environment variables.
- Add new browser flows with the `.spec.ts` suffix and descriptive scenario names; keep fixtures alongside the spec if created.
- Cover new features with automated journeys or deterministic service checks and flag any gaps in the PR description.

## Commit & Pull Request Guidelines
- Write imperative, scoped commit titles (e.g., `fix: handle template sync race`) reflecting the mixed `feat:`/verb style in history.
- Reference related issues or support tickets in the commit body and note configuration or data migrations.
- PRs must include a summary, testing notes, screenshots/GIFs for UI work, and links to supporting docs such as `DEPLOYMENT.md`.
- Confirm lint, type-check, and Playwright status in the PR template; explain any deliberately skipped checks.

## Security & Configuration Tips
- Keep secrets out of the repo; populate `.env.local` via `setup-env-vars.sh` and store keys like `AuthKey_*.p8` securely.
- Switch Stripe and OAuth environments with `npm run stripe:<mode>` or `npm run oauth:*`; double-check the target workspace before execution.
- Validate security-sensitive changes against `src/config/security` and `services/securityMonitorService.ts`, and document required Supabase or Redis updates in the PR.
