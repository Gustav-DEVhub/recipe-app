# Repository Guidelines

## Project Structure & Module Organization
This repository is a small monorepo:
- `client/`: React + Vite + TypeScript frontend (UI in `src/components`, pages in `src/pages`, shared helpers in `src/lib`, offline storage in `src/features`).
- `server/`: Express + TypeScript backend proxy (`src/app.ts`, routes in `src/routes`).
- `api/[...all].ts`: Vercel serverless entrypoint that bridges `/api/*` to the Express app.
- `vercel.json`: build/output/routing config for unified deployment.

Keep frontend-only code inside `client`, backend-only code inside `server`, and avoid cross-imports between both packages.

## Build, Test, and Development Commands
Run from repo root unless noted:
- `npm run dev`: starts backend and frontend concurrently.
- `npm run dev:server`: starts only the Express server (`server`).
- `npm run dev:client`: starts only the Vite app (`client`).
- `npm run install:all`: installs dependencies for both packages.
- `npm --prefix client run build`: production frontend build (used by Vercel).
- `npm --prefix client run preview`: preview built frontend locally.
- `npm --prefix server run start`: run server without watcher.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode (enabled in both `tsconfig.json` files). Follow existing conventions:
- 2-space indentation.
- Components/pages: `PascalCase` filenames (`RecipeCard.tsx`, `Home.tsx`).
- Utilities/modules: `camelCase` or lowercase (`queryClient.ts`, `db.ts`).
- Prefer small, focused modules and explicit exports.

No dedicated formatter/linter is configured yet; keep style consistent with neighboring files.

## Testing Guidelines
There is currently no automated test suite configured. For now, validate changes with manual smoke checks:
- Run `npm run dev`.
- Verify search, categories, details, favorites, and offline fallback.
- For deploy-related changes, verify `/api/categories` and at least one recipe lookup in preview/production.

If adding tests, prefer `Vitest` for `client` and `supertest` + `vitest/jest` style tests for `server`.

## Commit & Pull Request Guidelines
Current history uses short, informal subjects. Standardize going forward:
- Use imperative, concise commit subjects (e.g., `fix(api): handle empty search query`).
- Keep commits scoped to one logical change.
- PRs should include: purpose, key changes, verification steps, and screenshots/GIFs for UI updates.
- Link related issue/task IDs when available.
