import express from 'express';

const router = express.Router();

const MEALDB_API_BASE = (process.env.MEALDB_API_BASE ?? 'https://www.themealdb.com/api/json/v1').replace(/\/+$/, '');
const MEALDB_API_KEY = process.env.MEALDB_API_KEY ?? '1';

type MealDbResponse<T> = {
  meals: T[] | null;
  [key: string]: unknown;
};

async function proxyJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MealDB request failed: ${resp.status} ${resp.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }

  return (await resp.json()) as T;
}

function mealDbUrl(route: string): string {
  return `${MEALDB_API_BASE}/${encodeURIComponent(MEALDB_API_KEY)}/${route}`;
}

// Simple in-memory TTL cache for categories.
const categoriesCache: { data: unknown | null; expiresAt: number } = {
  data: null,
  expiresAt: 0
};

const CATEGORIES_TTL_MS = 60 * 60 * 1000; // 1 hour

router.get('/search', async (req, res) => {
  const s = String(req.query.s ?? '').trim();
  if (!s) {
    res.status(400).json({ error: 'Missing query parameter: s' });
    return;
  }

  try {
    const url = mealDbUrl(`search.php?s=${encodeURIComponent(s)}`);
    const data = await proxyJson<MealDbResponse<unknown>>(url);

    // User-specific (via query), so keep it short and let the SW cache on the client.
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to search recipes', details: (err as Error).message });
  }
});

router.get('/meal/:id', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Missing route parameter: id' });
    return;
  }

  try {
    const url = mealDbUrl(`lookup.php?i=${encodeURIComponent(id)}`);
    const data = await proxyJson<MealDbResponse<unknown>>(url);

    res.setHeader('Cache-Control', 'private, max-age=0');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to load recipe details', details: (err as Error).message });
  }
});

router.get('/categories', async (_req, res) => {
  const now = Date.now();
  if (categoriesCache.data && now < categoriesCache.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=43200');
    res.json(categoriesCache.data);
    return;
  }

  try {
    const url = mealDbUrl('categories.php');
    const data = await proxyJson<unknown>(url);

    categoriesCache.data = data;
    categoriesCache.expiresAt = now + CATEGORIES_TTL_MS;

    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=43200');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to load categories', details: (err as Error).message });
  }
});

router.get('/filter', async (req, res) => {
  const c = String(req.query.c ?? '').trim();
  if (!c) {
    res.status(400).json({ error: 'Missing query parameter: c' });
    return;
  }

  try {
    const url = mealDbUrl(`filter.php?c=${encodeURIComponent(c)}`);
    const data = await proxyJson<MealDbResponse<unknown>>(url);

    // Category filter response depends on c.
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to load category meals', details: (err as Error).message });
  }
});

router.get('/random', async (_req, res) => {
  try {
    const url = mealDbUrl('random.php');
    const data = await proxyJson<MealDbResponse<unknown>>(url);

    res.setHeader('Cache-Control', 'private, max-age=0');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to load a random recipe', details: (err as Error).message });
  }
});

export default router;

