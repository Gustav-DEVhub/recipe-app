import type { Meal } from '../../lib/theMealDb';
import {
  getAllStoredMealsForExport,
  mapIngredientLines,
  saveImportedRecipes,
  type ImportConflictStrategy,
  type ImportJob,
  type ImportRecipeDTO,
  upsertImportExportJob
} from '../favorites/db';

function sanitizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function randomId(prefix: string): string {
  const chunk = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${chunk}`;
}

function toMeal(input: any): Meal | null {
  const id = sanitizeText(input?.id ?? input?.idMeal ?? randomId('imported'));
  const title = sanitizeText(input?.title ?? input?.name ?? input?.strMeal);
  if (!title) return null;

  const ingredientsRaw = Array.isArray(input?.ingredients)
    ? input.ingredients
    : Array.isArray(input?.ingredientLines)
      ? input.ingredientLines
      : [];

  const ingredients = ingredientsRaw
    .map((item: any) => {
      if (typeof item === 'string') {
        return { ingredient: item.trim(), measure: '' };
      }
      return {
        ingredient: sanitizeText(item?.ingredient ?? item?.name),
        measure: sanitizeText(item?.measure ?? item?.amount)
      };
    })
    .filter((item: any) => item.ingredient);

  return {
    id,
    title,
    category: sanitizeText(input?.category ?? input?.strCategory) || undefined,
    area: sanitizeText(input?.area ?? input?.strArea) || undefined,
    thumbnail: sanitizeText(input?.thumbnail ?? input?.photo_url ?? input?.strMealThumb) || undefined,
    offlineThumbnail: sanitizeText(input?.offlineThumbnail) || undefined,
    instructions: sanitizeText(input?.instructions ?? input?.description ?? input?.strInstructions) || undefined,
    tags: Array.isArray(input?.tags)
      ? input.tags.map((t: unknown) => sanitizeText(t)).filter(Boolean)
      : sanitizeText(input?.strTags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    youtubeUrl: sanitizeText(input?.youtubeUrl ?? input?.strYoutube) || undefined,
    ingredients
  };
}

export async function exportRecipesAsJson(): Promise<string> {
  const meals = await getAllStoredMealsForExport();
  return JSON.stringify(meals, null, 2);
}

export async function getExportableRecipesSummary(): Promise<{ count: number; source: string }> {
  const meals = await getAllStoredMealsForExport();
  return {
    count: meals.length,
    source: 'favorites, cached details, and recent offline-ready recipes'
  };
}

export async function exportRecipesAsMarkdown(): Promise<string> {
  const meals = await getAllStoredMealsForExport();
  return meals
    .map((meal) => {
      const lines: string[] = [];
      lines.push(`# ${meal.title}`);
      lines.push(`- ID: ${meal.id}`);
      if (meal.category) lines.push(`- Category: ${meal.category}`);
      if (meal.area) lines.push(`- Area: ${meal.area}`);
      if (meal.tags?.length) lines.push(`- Tags: ${meal.tags.join(', ')}`);
      lines.push('');
      lines.push('## Ingredients');
      if (meal.ingredients.length) {
        for (const ing of mapIngredientLines(meal.ingredients)) {
          lines.push(`- ${ing}`);
        }
      } else {
        lines.push('- (none)');
      }
      lines.push('');
      lines.push('## Instructions');
      lines.push(meal.instructions?.trim() || '(none)');
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

export async function exportRecipesAsPaprikaJson(): Promise<string> {
  const meals = await getAllStoredMealsForExport();
  const recipes = meals.map((meal) => ({
    uid: meal.id,
    name: meal.title,
    description: meal.instructions ?? '',
    ingredients: mapIngredientLines(meal.ingredients),
    category: meal.category ?? '',
    cuisine: meal.area ?? '',
    tags: meal.tags ?? [],
    source_url: meal.youtubeUrl ?? '',
    photo_url: meal.thumbnail ?? ''
  }));

  return JSON.stringify({ format: 'paprika-basic', version: 1, recipes }, null, 2);
}

export function importRecipesFromJson(content: string): ImportRecipeDTO[] {
  const parsed: unknown = JSON.parse(content);
  const candidate = parsed as { recipes?: unknown[] };
  const rows: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(candidate?.recipes) ? candidate.recipes : [];
  return rows
    .map((entry: unknown) => toMeal(entry as any))
    .filter((entry): entry is Meal => Boolean(entry))
    .map((recipe: Meal) => ({ recipe, source: 'json' as const }));
}

export function importRecipesFromPaprika(content: string): ImportRecipeDTO[] {
  const parsed: unknown = JSON.parse(content);
  const candidate = parsed as { recipes?: unknown[] };
  const rows: unknown[] = Array.isArray(candidate?.recipes) ? candidate.recipes : Array.isArray(parsed) ? parsed : [];

  return rows
    .map((entry: any) =>
      toMeal({
        id: entry?.uid ?? entry?.id,
        title: entry?.name,
        category: entry?.category,
        area: entry?.cuisine,
        instructions: entry?.description,
        tags: Array.isArray(entry?.tags) ? entry.tags : [],
        youtubeUrl: entry?.source_url,
        thumbnail: entry?.photo_url,
        ingredientLines: Array.isArray(entry?.ingredients) ? entry.ingredients : []
      })
    )
    .filter((entry): entry is Meal => Boolean(entry))
    .map((recipe: Meal) => ({ recipe, source: 'paprika' as const }));
}

export function importRecipesFromMarkdown(content: string): ImportRecipeDTO[] {
  const blocks = content.split(/\n\s*---\s*\n/g).map((block) => block.trim()).filter(Boolean);
  const output: ImportRecipeDTO[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const titleLine = lines.find((line) => line.startsWith('# '));
    if (!titleLine) continue;

    const title = titleLine.replace(/^#\s+/, '').trim();
    const idLine = lines.find((line) => /^-\s+ID:/i.test(line));
    const categoryLine = lines.find((line) => /^-\s+Category:/i.test(line));
    const areaLine = lines.find((line) => /^-\s+Area:/i.test(line));
    const tagsLine = lines.find((line) => /^-\s+Tags:/i.test(line));

    const ingredientsStart = lines.findIndex((line) => /^##\s+Ingredients/i.test(line));
    const instructionsStart = lines.findIndex((line) => /^##\s+Instructions/i.test(line));

    const ingredientLines =
      ingredientsStart >= 0
        ? lines
            .slice(ingredientsStart + 1, instructionsStart >= 0 ? instructionsStart : undefined)
            .map((line) => line.replace(/^-\s+/, '').trim())
            .filter((line) => line && line !== '(none)')
        : [];

    const instructions =
      instructionsStart >= 0
        ? lines.slice(instructionsStart + 1).join('\n').trim().replace(/^\(none\)$/i, '')
        : '';

    const meal = toMeal({
      id: idLine?.replace(/^-\s+ID:\s*/i, '').trim(),
      title,
      category: categoryLine?.replace(/^-\s+Category:\s*/i, '').trim(),
      area: areaLine?.replace(/^-\s+Area:\s*/i, '').trim(),
      tags: tagsLine
        ?.replace(/^-\s+Tags:\s*/i, '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      instructions,
      ingredientLines
    });

    if (meal) output.push({ recipe: meal, source: 'markdown' });
  }

  return output;
}

export async function runBulkImport(
  recipes: ImportRecipeDTO[],
  source: ImportJob['source'],
  strategy: ImportConflictStrategy = 'skip'
): Promise<{ imported: number; skipped: number; failed: number; jobId: string }> {
  const summary = await saveImportedRecipes(recipes, strategy);
  const jobId = randomId('import-job');

  await upsertImportExportJob({
    id: jobId,
    source,
    total: recipes.length,
    imported: summary.imported,
    skipped: summary.skipped,
    failed: summary.failed,
    strategy,
    createdAt: Date.now()
  });

  return { ...summary, jobId };
}
