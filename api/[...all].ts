type AnyObject = Record<string, unknown>;

type CategoriesCache = {
  data: AnyObject | null;
  expiresAt: number;
};

const MEALDB_API_BASE = (process.env.MEALDB_API_BASE ?? 'https://www.themealdb.com/api/json/v1').replace(/\/+$/, '');
const MEALDB_API_KEY = process.env.MEALDB_API_KEY ?? '1';
const CATEGORIES_TTL_MS = 60 * 60 * 1000;

const categoriesCache: CategoriesCache = {
  data: null,
  expiresAt: 0
};

function mealDbUrl(route: string): string {
  return `${MEALDB_API_BASE}/${encodeURIComponent(MEALDB_API_KEY)}/${route}`;
}

async function fetchMealDb(url: string): Promise<AnyObject> {
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MealDB request failed: ${resp.status} ${resp.statusText}${text ? ` - ${text.slice(0, 180)}` : ''}`);
  }

  return (await resp.json()) as AnyObject;
}

function parsePathAndQuery(req: any): { path: string; query: URLSearchParams } {
  const host = req.headers?.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);
  const fromQuery = String(url.searchParams.get('path') ?? '').replace(/^\/+|\/+$/g, '');
  const fromPathname = String(url.pathname ?? '')
    .replace(/^\/+/, '')
    .replace(/^api\/(?:\[\.\.\.all\]\/?)?/, '')
    .replace(/^\/+|\/+$/g, '');
  const path = fromQuery || fromPathname;
  return { path, query: url.searchParams };
}

function sendJson(res: any, status: number, body: AnyObject): void {
  res.status(status).json(body);
}

export default async function handler(req: any, res: any) {
  try {
    const { path, query } = parsePathAndQuery(req);
    const [resource, id] = path.split('/');

    if (!resource) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (resource === 'categories') {
      const now = Date.now();
      if (categoriesCache.data && now < categoriesCache.expiresAt) {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=43200');
        sendJson(res, 200, categoriesCache.data);
        return;
      }

      const data = await fetchMealDb(mealDbUrl('categories.php'));
      categoriesCache.data = data;
      categoriesCache.expiresAt = now + CATEGORIES_TTL_MS;
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=43200');
      sendJson(res, 200, data);
      return;
    }

    if (resource === 'search') {
      const s = String(query.get('s') ?? '').trim();
      if (!s) {
        sendJson(res, 400, { error: 'Missing query parameter: s' });
        return;
      }

      const data = await fetchMealDb(mealDbUrl(`search.php?s=${encodeURIComponent(s)}`));
      res.setHeader('Cache-Control', 'private, max-age=0');
      sendJson(res, 200, data);
      return;
    }

    if (resource === 'filter') {
      const c = String(query.get('c') ?? '').trim();
      if (!c) {
        sendJson(res, 400, { error: 'Missing query parameter: c' });
        return;
      }

      const data = await fetchMealDb(mealDbUrl(`filter.php?c=${encodeURIComponent(c)}`));
      res.setHeader('Cache-Control', 'private, max-age=0');
      sendJson(res, 200, data);
      return;
    }

    if (resource === 'meal') {
      const mealId = String(id ?? '').trim();
      if (!mealId) {
        sendJson(res, 400, { error: 'Missing route parameter: id' });
        return;
      }

      const data = await fetchMealDb(mealDbUrl(`lookup.php?i=${encodeURIComponent(mealId)}`));
      res.setHeader('Cache-Control', 'private, max-age=0');
      sendJson(res, 200, data);
      return;
    }

    if (resource === 'random') {
      const data = await fetchMealDb(mealDbUrl('random.php'));
      res.setHeader('Cache-Control', 'private, max-age=0');
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 502, {
      error: 'Proxy request failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
