import { openDB, type IDBPDatabase } from 'idb';
import type { Meal } from '../../lib/theMealDb';

const DB_NAME = 'recipes-pwa-db';
const DB_VERSION = 2;

const FAVORITES_STORE = 'favorites';
const MEAL_DETAILS_STORE = 'meal_details';
const RECENTS_STORE = 'recent_meals';

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
    // Ignore image caching failures: we still keep the record in IndexedDB.
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

async function getByIdFlexible(store: string, id: string): Promise<Meal | null> {
  const normalized = String(id ?? '').trim();
  if (!normalized) return null;

  const direct = (await withDbRetry(async (db) => db.get(store, normalized))) as Meal | undefined;
  if (direct) return direct;

  const all = (await withDbRetry(async (db) => db.getAll(store))) as Meal[];
  const found = all.find((item) => String((item as any)?.id ?? '').trim() === normalized);
  return found ?? null;
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
  return getByIdFlexible(MEAL_DETAILS_STORE, id);
}

export async function saveFavorite(meal: Meal) {
  const id = String(meal.id ?? '').trim();
  if (!id) return;
  const hydratedMeal = await hydrateOfflineThumbnail(meal);
  await withDbRetry(async (db) => {
    // Store full meal details for offline details page.
    await db.put(FAVORITES_STORE, { ...hydratedMeal, id });
    // Also keep it in the details cache.
    await db.put(MEAL_DETAILS_STORE, { ...hydratedMeal, id });
  });
  await addRecentMeal(hydratedMeal);
  await cacheMealImage(hydratedMeal.thumbnail);
}

export async function removeFavorite(id: string) {
  await withDbRetry(async (db) => db.delete(FAVORITES_STORE, id));
}

export async function getFavorite(id: string): Promise<Meal | null> {
  return getByIdFlexible(FAVORITES_STORE, id);
}

export async function getAllFavorites(): Promise<Meal[]> {
  const all = (await withDbRetry(async (db) => db.getAll(FAVORITES_STORE))) as Meal[];
  // Sort newest? IndexedDB doesn't guarantee order; keep deterministic by title.
  return all
    .filter((m) => String(m?.id ?? '').trim().length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));
}
