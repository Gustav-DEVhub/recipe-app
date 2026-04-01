import { openDB, type IDBPDatabase } from 'idb';
import type { Meal } from '../../lib/theMealDb';

const DB_NAME = 'recipes-pwa-db';
const DB_VERSION = 1;

const FAVORITES_STORE = 'favorites';
const MEAL_DETAILS_STORE = 'meal_details';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEAL_DETAILS_STORE)) {
          db.createObjectStore(MEAL_DETAILS_STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

export async function upsertMealDetails(meal: Meal) {
  const db = await getDb();
  await db.put(MEAL_DETAILS_STORE, meal);
}

export async function getMealDetails(id: string): Promise<Meal | null> {
  const db = await getDb();
  const meal = (await db.get(MEAL_DETAILS_STORE, id)) as Meal | undefined;
  return meal ?? null;
}

export async function saveFavorite(meal: Meal) {
  const db = await getDb();
  // Store full meal details for offline details page.
  await db.put(FAVORITES_STORE, meal);
  // Also keep it in the details cache.
  await db.put(MEAL_DETAILS_STORE, meal);
}

export async function removeFavorite(id: string) {
  const db = await getDb();
  await db.delete(FAVORITES_STORE, id);
}

export async function getFavorite(id: string): Promise<Meal | null> {
  const db = await getDb();
  const meal = (await db.get(FAVORITES_STORE, id)) as Meal | undefined;
  return meal ?? null;
}

export async function getAllFavorites(): Promise<Meal[]> {
  const db = await getDb();
  const all = (await db.getAll(FAVORITES_STORE)) as Meal[];
  // Sort newest? IndexedDB doesn't guarantee order; keep deterministic by title.
  return all.sort((a, b) => a.title.localeCompare(b.title));
}

