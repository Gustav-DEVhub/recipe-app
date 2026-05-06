import type { Meal, MealCard } from './theMealDb';
import { normalizeMeal, normalizeMealCard } from './theMealDb';
import {
  cacheCategoriesList,
  cacheMealCards,
  getCachedCategoriesList,
  getCachedMealCards,
  getFavorite,
  getMealDetails
} from '../features/favorites/db';

const API_BASE = '/api';

function isOfflineHint(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

async function jsonOrThrow<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => null)) as T | null;
  if (!resp.ok) {
    const message = (data as any)?.error ?? resp.statusText;
    throw new Error(String(message));
  }
  return data as T;
}

export async function searchMeals(query: string): Promise<MealCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${API_BASE}/search?s=${encodeURIComponent(trimmed)}`;

  try {
    const resp = await fetch(url);
    const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
    const meals = (data.meals ?? []).map((m) => normalizeMealCard(m));
    await cacheMealCards('search', trimmed, meals);
    return meals;
  } catch (error) {
    const cached = await getCachedMealCards('search', trimmed);
    if (cached.length) return cached;
    if (isOfflineHint()) throw new Error('Offline and no cached search results');
    throw error;
  }
}

export async function filterMealsByCategory(category: string): Promise<MealCard[]> {
  const trimmed = category.trim();
  if (!trimmed) return [];
  const url = `${API_BASE}/filter?c=${encodeURIComponent(trimmed)}`;

  try {
    const resp = await fetch(url);
    const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
    const meals = (data.meals ?? []).map((m) => normalizeMealCard(m));
    await cacheMealCards('filter', trimmed, meals);
    return meals;
  } catch (error) {
    const cached = await getCachedMealCards('filter', trimmed);
    if (cached.length) return cached;
    if (isOfflineHint()) throw new Error('Offline and no cached category results');
    throw error;
  }
}

export async function lookupMeal(id: string): Promise<Meal> {
  const url = `${API_BASE}/meal/${encodeURIComponent(id)}`;
  try {
    const resp = await fetch(url);
    const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
    const rawMeal = data.meals?.[0];
    if (!rawMeal) throw new Error('Recipe not found');
    return normalizeMeal(rawMeal);
  } catch (error) {
    const [cachedDetails, cachedFavorite] = await Promise.all([getMealDetails(id), getFavorite(id)]);
    if (cachedDetails) return cachedDetails;
    if (cachedFavorite) return cachedFavorite;
    if (isOfflineHint()) throw new Error('Offline and recipe not cached yet');
    throw error;
  }
}

export async function getCategories(): Promise<string[]> {
  const url = `${API_BASE}/categories`;
  try {
    const resp = await fetch(url);
    const data = await jsonOrThrow<{ categories: any[] | null }>(resp);
    const categories = (data.categories ?? [])
      .map((c) => String(c?.strCategory ?? '').trim())
      .filter(Boolean);
    await cacheCategoriesList(categories);
    return categories;
  } catch (error) {
    const cached = await getCachedCategoriesList();
    if (cached.length) return cached;
    if (isOfflineHint()) throw new Error('Offline and no cached categories');
    throw error;
  }
}
