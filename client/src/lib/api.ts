import type { Meal, MealCard } from './theMealDb';
import { normalizeMeal, normalizeMealCard } from './theMealDb';

const API_BASE = '/api';

async function jsonOrThrow<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => null)) as T | null;
  if (!resp.ok) {
    const message = (data as any)?.error ?? resp.statusText;
    throw new Error(String(message));
  }
  return data as T;
}

export async function searchMeals(query: string): Promise<MealCard[]> {
  const url = `${API_BASE}/search?s=${encodeURIComponent(query.trim())}`;
  const resp = await fetch(url);
  const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
  const meals = data.meals ?? [];
  return meals.map((m) => normalizeMealCard(m));
}

export async function filterMealsByCategory(category: string): Promise<MealCard[]> {
  const url = `${API_BASE}/filter?c=${encodeURIComponent(category.trim())}`;
  const resp = await fetch(url);
  const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
  const meals = data.meals ?? [];
  return meals.map((m) => normalizeMealCard(m));
}

export async function lookupMeal(id: string): Promise<Meal> {
  const url = `${API_BASE}/meal/${encodeURIComponent(id)}`;
  const resp = await fetch(url);
  const data = await jsonOrThrow<{ meals: any[] | null }>(resp);
  const rawMeal = data.meals?.[0];
  if (!rawMeal) throw new Error('Recipe not found');
  return normalizeMeal(rawMeal);
}

export async function getCategories(): Promise<string[]> {
  const url = `${API_BASE}/categories`;
  const resp = await fetch(url);
  const data = await jsonOrThrow<{ categories: any[] | null }>(resp);
  return (data.categories ?? [])
    .map((c) => String(c?.strCategory ?? '').trim())
    .filter(Boolean);
}

