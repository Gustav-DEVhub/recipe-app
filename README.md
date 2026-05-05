# Recipes PWA

Progressive Web App (PWA) de recetas usando TheMealDB, con cliente React + Vite + Tailwind + shadcn/ui y backend proxy en Node.js/Express.

## Features

- Busqueda de recetas por nombre.
- Exploracion por categorias.
- Vista de detalle con ingredientes, instrucciones, tags y enlace de YouTube.
- Favoritos offline con IndexedDB (add/view/delete).
- PWA instalable con manifest + service worker manual.
- Fallback offline para navegacion y cache runtime para `/api/*`.
- UI responsive con skeletons, estados vacios y manejo de errores.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS v3, shadcn/ui, TanStack Query, sonner.
- Backend: Node.js, Express, TypeScript, helmet, cors, compression.
- Offline storage: IndexedDB (`idb`).
- Data source: TheMealDB v1 (a traves de proxy backend).

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
  src/features/favorites/db.ts
  src/lib/api.ts
  src/lib/queryClient.ts
  src/styles/globals.css
  public/manifest.webmanifest
  public/offline.html
  public/icons/*
  public/sw.js
```

## Setup (Unified)

1. Crear variables del server:

```bash
cd server
cp .env.example .env
```

2. Volver a la raiz y levantar todo:

```bash
cd ..
npm i
npm run install:all
npm run dev
```

Con esto se levantan server y client en paralelo desde la raiz del repo.

## Debug Scripts

```bash
npm run dev:server
npm run dev:client
```

- Server default: `http://localhost:3001`
- Client default: `http://localhost:5174`
- Vite proxy reenvia `/api/*` a `http://localhost:3001`

## Environment Variables (Server)

Archivo: `server/.env`

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

Importante: el cliente solo consume `/api/*`; nunca llama directo a TheMealDB.

## PWA Details

- Manifest: `client/public/manifest.webmanifest`
- Service Worker: `client/public/sw.js` (manual, sin Workbox)
- Offline fallback page: `client/public/offline.html`

### Cache Strategy

- Precache: shell de app + assets estaticos esenciales.
- Runtime `/api/categories`: stale-while-revalidate.
- Runtime `/api/search`, `/api/meal/:id`, `/api/filter`: network-first con fallback a cache.
- Images: stale-while-revalidate.
- Navigation offline: intenta `index.html`, luego `offline.html`.

### How to Test Offline

1. Levanta toda la app con `npm run dev` desde la raiz.
2. Navega por Home/Details y guarda recetas en favoritos.
3. Abre DevTools y simula modo offline.
4. Recarga la app.
5. Verifica favoritos y fallback offline.

## Build and Deploy Notes

- Server:
  - `cd server && npm run start`
  - Deploy sugerido: Render/Railway/Fly.
- Client:
  - `cd client && npm run build`
  - Deploy sugerido: Netlify/Vercel.

## Vercel (Monorepo Unico)

Este repo soporta deploy en un solo proyecto de Vercel:
- Frontend estatico desde `client/dist`
- API Express en `/api/*` via funcion serverless (`api/index.ts`)

Archivos clave:
- `vercel.json`
- `api/[...all].ts`
- `server/src/app.ts`

### Variables de entorno en Vercel

Configura en Project Settings -> Environment Variables:

```env
MEALDB_API_BASE=https://www.themealdb.com/api/json/v1
MEALDB_API_KEY=1
# Optional:
# CORS_ORIGIN=https://tu-dominio.vercel.app
```

### Flujo de deploy recomendado

1. Push a GitHub.
2. Importa el repo en Vercel.
3. Vercel detectara `vercel.json` y usara:
   - Build command: `npm --prefix client run build`
   - Output directory: `client/dist`
4. Configura las variables de entorno arriba.
5. Deploy.

### Verificacion post-deploy

- `https://tu-dominio.vercel.app/` carga la app.
- `https://tu-dominio.vercel.app/api/categories` responde JSON.
- Busqueda, categorias, detalles y favoritos funcionan sin exponer API key.

## Post-Generation Checklist

- Reemplazar iconos placeholder en `client/public/icons`.
- Revisar colores/branding final.
- Validar instalacion PWA en Android/Desktop.
- Confirmar politica de cache segun trafico esperado.
- Ejecutar smoke tests de offline favorites.
