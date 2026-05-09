# Recipes PWA

A Progressive Web App (PWA) for recipes powered by TheMealDB, with a React + Vite + Tailwind + shadcn/ui client and a Node.js/Express proxy backend.

## Features

- Search recipes by name.
- Browse recipes by category.
- Recipe detail view with ingredients, instructions, tags, and YouTube link.
- Offline favorites with IndexedDB (add/view/delete).
- Offline shopping list (checklist, clear completed, export CSV/JSON, print).
- Bulk recipe import/export (Markdown, JSON, basic Paprika JSON).
- Installable PWA with manifest + manual service worker.
- Offline navigation fallback and runtime cache for `/api/*`.
- Responsive UI with skeleton loaders, empty states, and error handling.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS v3, shadcn/ui, TanStack Query, sonner.
- Backend: Node.js, Express, TypeScript, helmet, cors, compression.
- Offline storage: IndexedDB (`idb`).
- Data source: TheMealDB v1 (through backend proxy).

## Project Structure

```txt
/server
  .env.example
  package.json
  src/index.ts
  src/routes/mealdb.ts

/client
  index.html
  vite.config.ts
  package.json
  postcss.config.cjs
  tailwind.config.cjs
  src/main.tsx
  src/App.tsx
  src/components/*
  src/pages/{Home,Details,Favorites}.tsx
  src/pages/{ShoppingList,ImportExport}.tsx
  src/features/favorites/db.ts
  src/features/import-export/service.ts
  src/lib/api.ts
  src/lib/queryClient.ts
  src/styles/globals.css
  public/manifest.webmanifest
  public/offline.html
  public/icons/*
  public/sw.js
```

## Setup (Unified)

1. Create server environment variables:

```bash
cd server
cp .env.example .env
```

2. Go back to repo root and start everything:

```bash
cd ..
npm i
npm run install:all
npm run dev
```

This starts server and client in parallel from the repository root.

## Debug Scripts

```bash
npm run dev:server
npm run dev:client
```

- Server default: `http://localhost:3001`
- Client default: `http://localhost:5174`
- Vite proxy forwards `/api/*` to `http://localhost:3001`

## Environment Variables (Server)

File: `server/.env`

```env
MEALDB_API_BASE=https://www.themealdb.com/api/json/v1
MEALDB_API_KEY=1
PORT=3001
# CORS_ORIGIN=http://localhost:5174
```

## API Routes (Proxy)

- `GET /api/search?s={query}` -> `search.php?s=...`
- `GET /api/meal/:id` -> `lookup.php?i=...`
- `GET /api/categories` -> `categories.php`
- `GET /api/filter?c={category}` -> `filter.php?c=...`
- `GET /api/random` -> `random.php`

Important: the client only consumes `/api/*`; it never calls TheMealDB directly.

## PWA Details

- Manifest: `client/public/manifest.webmanifest`
- Service Worker: `client/public/sw.js` (manual, no Workbox)
- Offline fallback page: `client/public/offline.html`

### Cache Strategy

- Precache: app shell + essential static assets.
- Runtime `/api/categories`: stale-while-revalidate.
- Runtime `/api/search`, `/api/meal/:id`, `/api/filter`: network-first with cache fallback.
- Images: stale-while-revalidate.
- Offline navigation: try `index.html`, then `offline.html`.

### How to Test Offline

1. Start the app with `npm run dev` from repo root.
2. Navigate through Home/Details and save some favorites.
3. Open DevTools and simulate offline mode.
4. Reload the app.
5. Verify favorites and offline fallback behavior.

## Build and Deploy Notes

- Server:
  - `cd server && npm run start`
  - Suggested deploy: Render/Railway/Fly.
- Client:
  - `cd client && npm run build`
  - Suggested deploy: Netlify/Vercel.

## Vercel (Single Monorepo Project)

This repository supports deploying frontend + API in one Vercel project:
- Static frontend from `client/dist`
- Express API under `/api/*` through serverless handler (`api/index.ts`)

Key files:
- `vercel.json`
- `api/[...all].ts`
- `server/src/app.ts`

### Environment Variables on Vercel

Set in Project Settings -> Environment Variables:

```env
MEALDB_API_BASE=https://www.themealdb.com/api/json/v1
MEALDB_API_KEY=1
# Optional:
# CORS_ORIGIN=https://your-domain.vercel.app
```

### Recommended Deploy Flow

1. Push to GitHub.
2. Import the repository in Vercel.
3. Vercel reads `vercel.json` and uses:
   - Build command: `npm --prefix client run build`
   - Output directory: `client/dist`
4. Add the environment variables above.
5. Deploy.

### Post-deploy Verification

- `https://your-domain.vercel.app/` loads the app.
- `https://your-domain.vercel.app/api/categories` returns JSON.
- Search, categories, details, and favorites work without exposing API keys.

## Post-generation Checklist

- Replace placeholder icons in `client/public/icons`.
- Finalize brand colors and visual style.
- Validate PWA install on Android/Desktop.
- Confirm cache strategy for expected traffic.
- Run offline favorites smoke tests.

## Roadmap V2 (Planned, not active in v1)

- Supabase integration for authentication + multi-device sync.
- Share recipes/lists with signed links.
- OAuth (Google) as optional social login.
