import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Meal } from '../lib/theMealDb';
import { addMealIngredientsToShoppingList, getAllFavorites, removeFavorite } from '../features/favorites/db';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { RecipeCard } from '../components/recipe-card';

type SortKey = 'title' | 'category' | 'area';

export default function Favorites() {
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('title');

  async function refresh() {
    setLoading(true);
    try {
      const rows = await getAllFavorites();
      setFavorites(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {
      setFavorites([]);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? favorites.filter((m) => m.title.toLowerCase().includes(needle) || (m.category ?? '').toLowerCase().includes(needle))
      : favorites.slice();

    rows.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'category') return (a.category ?? '').localeCompare(b.category ?? '');
      return (a.area ?? '').localeCompare(b.area ?? '');
    });
    return rows;
  }, [favorites, q, sortKey]);

  async function removeMeal(meal: Meal) {
    try {
      await removeFavorite(meal.id);
      toast.success('Removed from Favorites');
      await refresh();
    } catch {
      toast.error('Could not remove favorite');
    }
  }

  async function addToShoppingList(meal: Meal) {
    try {
      const summary = await addMealIngredientsToShoppingList(meal);
      toast.success(`Added ${summary.added} item(s)${summary.merged ? `, merged ${summary.merged}` : ''}.`);
    } catch {
      toast.error('Could not add ingredients to shopping list.');
    }
  }

  return (
    <div className="app-page-shell flex flex-col gap-6">
      <section aria-label="Favorites controls" className="motion-fade-up mx-auto w-full max-w-4xl rounded-xl border border-border bg-card/50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 sm:w-2/3">
            <label htmlFor="fav-search" className="text-main text-sm font-medium">
              Search favorites
            </label>
            <Input
              id="fav-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title or category"
              aria-label="Search favorites"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="fav-sort" className="text-main text-sm font-medium">
                Sort
              </label>
              <select
                id="fav-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-10 rounded-md border border-[color:var(--panel-border)] bg-[color:var(--surface-strong)] px-3 text-sm text-[color:var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]"
                aria-label="Sort favorites"
              >
                <option value="title">Title</option>
                <option value="category">Category</option>
                <option value="area">Area</option>
              </select>
            </div>
            <Badge>{filtered.length} saved</Badge>
          </div>
        </div>
      </section>

      <section aria-label="Saved recipes">
        {loading ? (
          <div className="motion-stagger mx-auto grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card/50">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="motion-stagger mx-auto grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((meal) => {
              const mealCard = {
                id: meal.id,
                title: meal.title,
                category: meal.category,
                area: meal.area,
                thumbnail: meal.thumbnail,
                offlineThumbnail: meal.offlineThumbnail
              };

              return (
                <div key={meal.id} className="relative">
                  <RecipeCard
                    meal={mealCard}
                    isFavorite={true}
                    onToggleFavorite={() => removeMeal(meal)}
                    onOpenDetails={() => navigate(`/details/${meal.id}`, { state: { prefetchedMeal: meal } })}
                    onAddToShoppingList={() => addToShoppingList(meal)}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => removeMeal(meal)}
                      aria-label={`Remove ${meal.title} from favorites`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <p className="text-main text-sm font-medium">No favorites yet.</p>
            <p className="text-muted mt-2 text-sm">
              {!navigator.onLine
                ? 'Offline and no saved data found. Connect once, then save favorites for offline usage.'
                : 'Go to Home and tap the heart to save recipes.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
