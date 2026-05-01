export type MealIngredient = {
  ingredient: string;
  measure: string;
};

export type Meal = {
  id: string;
  title: string;
  category?: string;
  area?: string;
  thumbnail?: string;
  offlineThumbnail?: string;
  instructions?: string;
  tags?: string[];
  youtubeUrl?: string;
  ingredients: MealIngredient[];
};

export type MealCard = {
  id: string;
  title: string;
  category?: string;
  area?: string;
  thumbnail?: string;
  offlineThumbnail?: string;
};

function cleanStr(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  return s ? s : undefined;
}

function splitTags(v: unknown): string[] | undefined {
  const raw = String(v ?? '').trim();
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeIngredients(meal: any): MealIngredient[] {
  const ingredients: MealIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = cleanStr(meal[`strIngredient${i}`]);
    if (!ingredient) continue;
    const measure = cleanStr(meal[`strMeasure${i}`]) ?? '';
    ingredients.push({ ingredient, measure });
  }
  return ingredients;
}

export function normalizeMeal(raw: any): Meal {
  return {
    id: String(raw?.idMeal ?? ''),
    title: String(raw?.strMeal ?? ''),
    category: cleanStr(raw?.strCategory),
    area: cleanStr(raw?.strArea),
    thumbnail: cleanStr(raw?.strMealThumb),
    instructions: cleanStr(raw?.strInstructions),
    tags: splitTags(raw?.strTags),
    youtubeUrl: cleanStr(raw?.strYoutube),
    ingredients: normalizeIngredients(raw)
  };
}

export function normalizeMealCard(raw: any): MealCard {
  return {
    id: String(raw?.idMeal ?? ''),
    title: String(raw?.strMeal ?? ''),
    category: cleanStr(raw?.strCategory),
    area: cleanStr(raw?.strArea),
    thumbnail: cleanStr(raw?.strMealThumb)
  };
}
