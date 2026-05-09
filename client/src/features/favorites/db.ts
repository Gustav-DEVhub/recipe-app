import { openDB, type IDBPDatabase } from 'idb';
import type { Meal, MealCard, MealIngredient } from '../../lib/theMealDb';

const DB_NAME = 'recipes-pwa-db';
const DB_VERSION = 4;

const FAVORITES_STORE = 'favorites';
const MEAL_DETAILS_STORE = 'meal_details';
const RECENTS_STORE = 'recent_meals';
const QUERY_CACHE_STORE = 'query_cache';
const SHOPPING_LIST_STORE = 'shopping_list_items';
const IMPORT_EXPORT_JOBS_STORE = 'import_export_jobs';

type QueryCacheRecord = {
  id: string;
  value: unknown;
  updatedAt: number;
};

export type ShoppingListItem = {
  id: string;
  ingredient: string;
  measure: string;
  normalizedKey: string;
  quantityText: string;
  checked: boolean;
  sourceMealIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type ImportRecipeDTO = {
  recipe: Meal;
  source: 'json' | 'markdown' | 'paprika';
};

export type ExportRecipeDTO = Meal;

export type ImportConflictStrategy = 'skip' | 'overwrite';

export type ImportJob = {
  id: string;
  source: 'json' | 'markdown' | 'paprika';
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  strategy: ImportConflictStrategy;
  createdAt: number;
};

// V2 placeholders (no runtime usage in v1).
export type UserProfile = {
  id: string;
  email?: string;
  displayName?: string;
};

export type SharedRecipeRef = {
  id: string;
  mealId: string;
  createdByUserId: string;
  createdAt: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      terminated() {
        dbPromise = null;
      },
      upgrade(db) {
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEAL_DETAILS_STORE)) {
          db.createObjectStore(MEAL_DETAILS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(RECENTS_STORE)) {
          db.createObjectStore(RECENTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(QUERY_CACHE_STORE)) {
          db.createObjectStore(QUERY_CACHE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SHOPPING_LIST_STORE)) {
          db.createObjectStore(SHOPPING_LIST_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IMPORT_EXPORT_JOBS_STORE)) {
          db.createObjectStore(IMPORT_EXPORT_JOBS_STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

function isRecoverableDbError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error ?? '').toLowerCase();
  return msg.includes('closing') || msg.includes('notfounderror') || msg.includes('object stores');
}

async function withDbRetry<T>(fn: (db: IDBPDatabase) => Promise<T>): Promise<T> {
  try {
    const db = await getDb();
    return await fn(db);
  } catch (err) {
    if (!isRecoverableDbError(err)) throw err;
    dbPromise = null;
    const db = await getDb();
    return await fn(db);
  }
}

async function cacheMealImage(url?: string) {
  if (!url || typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open('recipes-pwa-manual-images');
    const response = await fetch(url, { mode: 'no-cors' });
    await cache.put(url, response);
  } catch {
    // Ignore image caching failures.
  }
}

async function fetchImageAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read image blob'));
      reader.readAsDataURL(blob);
    });
    return dataUrl || undefined;
  } catch {
    return undefined;
  }
}

async function hydrateOfflineThumbnail(meal: Meal): Promise<Meal> {
  if (meal.offlineThumbnail) return meal;
  const offlineThumbnail = await fetchImageAsDataUrl(meal.thumbnail);
  return offlineThumbnail ? { ...meal, offlineThumbnail } : meal;
}

function normalizeQueryPart(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

function makeQueryCacheId(kind: 'search' | 'filter' | 'categories', key = ''): string {
  const normalized = normalizeQueryPart(key);
  return normalized ? `${kind}:${normalized}` : kind;
}

function normalizeIngredientKey(ingredient: string): string {
  return String(ingredient ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeMeasures(current: string, incoming: string): string {
  const parts = new Set<string>();
  String(current ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => parts.add(s));
  String(incoming ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => parts.add(s));
  return Array.from(parts).join(' | ');
}

function asValidMeal(value: unknown): Meal | null {
  const meal = value as Meal | null;
  if (!meal || typeof meal.id !== 'string' || !Array.isArray(meal.ingredients)) return null;
  return meal;
}

async function getByIdFlexible<T>(store: string, id: string): Promise<T | null> {
  const normalized = String(id ?? '').trim();
  if (!normalized) return null;

  const direct = (await withDbRetry(async (db) => db.get(store, normalized))) as T | undefined;
  if (direct) return direct;

  const all = (await withDbRetry(async (db) => db.getAll(store))) as Array<T & { id?: string }>;
  const found = all.find((item) => String(item?.id ?? '').trim() === normalized);
  return found ?? null;
}

async function getOfflineThumbnailForMeal(id: string): Promise<string | undefined> {
  const [details, favorite, recent] = await Promise.all([
    getByIdFlexible<Meal>(MEAL_DETAILS_STORE, id),
    getByIdFlexible<Meal>(FAVORITES_STORE, id),
    getByIdFlexible<Meal>(RECENTS_STORE, id)
  ]);

  return details?.offlineThumbnail ?? favorite?.offlineThumbnail ?? recent?.offlineThumbnail;
}

async function enrichMealCardsWithOfflineThumb(cards: MealCard[]): Promise<MealCard[]> {
  return Promise.all(
    cards.map(async (card) => {
      if (card.offlineThumbnail) return card;
      const offlineThumbnail = await getOfflineThumbnailForMeal(card.id);
      return offlineThumbnail ? { ...card, offlineThumbnail } : card;
    })
  );
}

export async function addRecentMeal(meal: Meal) {
  const id = String(meal.id ?? '').trim();
  if (!id) return;
  const hydratedMeal = await hydrateOfflineThumbnail(meal);
  const now = Date.now();
  await withDbRetry(async (db) => db.put(RECENTS_STORE, { ...hydratedMeal, id, recentAt: now }));
  await cacheMealImage(hydratedMeal.thumbnail);
}

export async function getRecentMeals(limit = 18): Promise<Meal[]> {
  const all = (await withDbRetry(async (db) => db.getAll(RECENTS_STORE))) as Array<Meal & { recentAt?: number }>;
  return all
    .sort((a, b) => (b.recentAt ?? 0) - (a.recentAt ?? 0))
    .slice(0, limit)
    .map(({ recentAt: _recentAt, ...meal }) => meal);
}

export async function upsertMealDetails(meal: Meal) {
  const id = String(meal.id ?? '').trim();
  if (!id) return;
  const hydratedMeal = await hydrateOfflineThumbnail(meal);
  await withDbRetry(async (db) => db.put(MEAL_DETAILS_STORE, { ...hydratedMeal, id }));
  await addRecentMeal(hydratedMeal);
}

export async function getMealDetails(id: string): Promise<Meal | null> {
  return getByIdFlexible<Meal>(MEAL_DETAILS_STORE, id);
}

export async function saveFavorite(meal: Meal) {
  const id = String(meal.id ?? '').trim();
  if (!id) return;
  const hydratedMeal = await hydrateOfflineThumbnail(meal);
  await withDbRetry(async (db) => {
    await db.put(FAVORITES_STORE, { ...hydratedMeal, id });
    await db.put(MEAL_DETAILS_STORE, { ...hydratedMeal, id });
  });
  await addRecentMeal(hydratedMeal);
  await cacheMealImage(hydratedMeal.thumbnail);
}

export async function removeFavorite(id: string) {
  await withDbRetry(async (db) => db.delete(FAVORITES_STORE, id));
}

export async function getFavorite(id: string): Promise<Meal | null> {
  return getByIdFlexible<Meal>(FAVORITES_STORE, id);
}

export async function getAllFavorites(): Promise<Meal[]> {
  const all = (await withDbRetry(async (db) => db.getAll(FAVORITES_STORE))) as Meal[];
  return all
    .filter((m) => String(m?.id ?? '').trim().length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function cacheCategoriesList(categories: string[]): Promise<void> {
  const clean = categories.map((c) => String(c ?? '').trim()).filter(Boolean);
  const record: QueryCacheRecord = {
    id: makeQueryCacheId('categories'),
    value: clean,
    updatedAt: Date.now()
  };
  await withDbRetry(async (db) => db.put(QUERY_CACHE_STORE, record));
}

export async function getCachedCategoriesList(): Promise<string[]> {
  const record = (await withDbRetry(async (db) =>
    db.get(QUERY_CACHE_STORE, makeQueryCacheId('categories'))
  )) as QueryCacheRecord | undefined;

  if (!record) return [];
  const value = Array.isArray(record.value) ? record.value : [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

export async function cacheMealCards(kind: 'search' | 'filter', key: string, meals: MealCard[]): Promise<void> {
  const queryKey = normalizeQueryPart(key);
  if (!queryKey) return;
  const cleanMeals = meals.filter((m) => String(m?.id ?? '').trim().length > 0);
  const enriched = await enrichMealCardsWithOfflineThumb(cleanMeals);
  const record: QueryCacheRecord = {
    id: makeQueryCacheId(kind, queryKey),
    value: enriched,
    updatedAt: Date.now()
  };
  await withDbRetry(async (db) => db.put(QUERY_CACHE_STORE, record));
}

export async function getCachedMealCards(kind: 'search' | 'filter', key: string): Promise<MealCard[]> {
  const queryKey = normalizeQueryPart(key);
  if (!queryKey) return [];
  const record = (await withDbRetry(async (db) =>
    db.get(QUERY_CACHE_STORE, makeQueryCacheId(kind, queryKey))
  )) as QueryCacheRecord | undefined;

  if (!record) return [];
  const value = Array.isArray(record.value) ? record.value : [];
  const meals = value as MealCard[];
  const clean = meals.filter((m) => String(m?.id ?? '').trim().length > 0);
  return enrichMealCardsWithOfflineThumb(clean);
}

export async function getShoppingListItems(): Promise<ShoppingListItem[]> {
  const all = (await withDbRetry(async (db) => db.getAll(SHOPPING_LIST_STORE))) as ShoppingListItem[];
  return all.sort((a, b) => a.createdAt - b.createdAt || a.ingredient.localeCompare(b.ingredient));
}

export async function upsertShoppingListItem(input: Omit<ShoppingListItem, 'createdAt' | 'updatedAt'>): Promise<void> {
  const now = Date.now();
  const existing = await getByIdFlexible<ShoppingListItem>(SHOPPING_LIST_STORE, input.id);
  const payload: ShoppingListItem = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await withDbRetry(async (db) => db.put(SHOPPING_LIST_STORE, payload));
}

export async function setShoppingItemChecked(id: string, checked: boolean): Promise<void> {
  const item = await getByIdFlexible<ShoppingListItem>(SHOPPING_LIST_STORE, id);
  if (!item) return;
  await upsertShoppingListItem({ ...item, checked });
}

export async function removeShoppingListItem(id: string): Promise<void> {
  await withDbRetry(async (db) => db.delete(SHOPPING_LIST_STORE, id));
}

export async function clearCompletedShoppingItems(): Promise<void> {
  const all = await getShoppingListItems();
  await withDbRetry(async (db) => {
    const tx = db.transaction(SHOPPING_LIST_STORE, 'readwrite');
    for (const item of all) {
      if (item.checked) await tx.store.delete(item.id);
    }
    await tx.done;
  });
}

export async function clearAllShoppingListItems(): Promise<void> {
  await withDbRetry(async (db) => {
    await db.clear(SHOPPING_LIST_STORE);
  });
}

export async function addMealIngredientsToShoppingList(mealOrId: Meal | string): Promise<{ added: number; merged: number }> {
  let meal: Meal | null = null;

  if (typeof mealOrId === 'string') {
    const trimmed = mealOrId.trim();
    if (!trimmed) return { added: 0, merged: 0 };
    meal = (await getMealDetails(trimmed)) ?? (await getFavorite(trimmed));
  } else {
    meal = mealOrId;
  }

  const safeMeal = asValidMeal(meal);
  if (!safeMeal) return { added: 0, merged: 0 };

  let added = 0;
  let merged = 0;

  for (const ing of safeMeal.ingredients) {
    const ingredient = String(ing?.ingredient ?? '').trim();
    if (!ingredient) continue;

    const normalizedKey = normalizeIngredientKey(ingredient);
    const existing = (await withDbRetry(async (db) => db.get(SHOPPING_LIST_STORE, normalizedKey))) as ShoppingListItem | undefined;

    const sourceMealIds = Array.from(new Set([...(existing?.sourceMealIds ?? []), safeMeal.id]));
    const measure = mergeMeasures(existing?.measure ?? '', String(ing?.measure ?? '').trim());

    const payload: Omit<ShoppingListItem, 'createdAt' | 'updatedAt'> = {
      id: normalizedKey,
      ingredient,
      normalizedKey,
      measure,
      quantityText: measure,
      checked: existing?.checked ?? false,
      sourceMealIds
    };

    await upsertShoppingListItem(payload);
    if (existing) merged += 1;
    else added += 1;
  }

  return { added, merged };
}

export async function exportShoppingListJson(): Promise<string> {
  const items = await getShoppingListItems();
  return JSON.stringify(items, null, 2);
}

function escapeCsv(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function exportShoppingListCsv(): Promise<string> {
  const items = await getShoppingListItems();
  const header = ['ingredient', 'quantity', 'checked', 'sourceMealIds'];
  const lines = items.map((item) =>
    [
      escapeCsv(item.ingredient),
      escapeCsv(item.quantityText || item.measure),
      item.checked ? 'true' : 'false',
      escapeCsv(item.sourceMealIds.join('|'))
    ].join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export async function upsertImportExportJob(job: ImportJob): Promise<void> {
  await withDbRetry(async (db) => db.put(IMPORT_EXPORT_JOBS_STORE, job));
}

export async function getImportExportJobs(limit = 20): Promise<ImportJob[]> {
  const all = (await withDbRetry(async (db) => db.getAll(IMPORT_EXPORT_JOBS_STORE))) as ImportJob[];
  return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function saveImportedRecipes(
  recipes: ImportRecipeDTO[],
  strategy: ImportConflictStrategy = 'skip'
): Promise<{ imported: number; skipped: number; failed: number }> {
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of recipes) {
    try {
      const meal = asValidMeal(item.recipe);
      if (!meal || !meal.id) {
        failed += 1;
        continue;
      }

      const existing = await getMealDetails(meal.id);
      if (existing && strategy === 'skip') {
        skipped += 1;
        continue;
      }

      await upsertMealDetails(meal);
      imported += 1;
    } catch {
      failed += 1;
    }
  }

  return { imported, skipped, failed };
}

export async function getAllStoredMealsForExport(): Promise<ExportRecipeDTO[]> {
  const [favorites, recents, details] = await Promise.all([
    getAllFavorites(),
    getRecentMeals(250),
    withDbRetry(async (db) => db.getAll(MEAL_DETAILS_STORE)) as Promise<Meal[]>
  ]);

  const byId = new Map<string, Meal>();
  for (const meal of [...details, ...recents, ...favorites]) {
    if (!meal?.id) continue;
    byId.set(meal.id, meal);
  }

  return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function mapIngredientLines(ingredients: MealIngredient[]): string[] {
  return ingredients
    .map((ing) => `${String(ing.measure ?? '').trim()} ${String(ing.ingredient ?? '').trim()}`.trim())
    .filter(Boolean);
}
