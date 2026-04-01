import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Meal, MealCard } from '../lib/theMealDb';
import { filterMealsByCategory, getCategories, searchMeals, lookupMeal } from '../lib/api';
import { getAllFavorites, getMealDetails, removeFavorite, saveFavorite, upsertMealDetails } from '../features/favorites/db';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { RecipeCard } from '../components/recipe-card';

export default function Home() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<Meal[]>([]);
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    // Favorites are local-only, so load them once on mount.
    getAllFavorites()
      .then((rows) => setFavorites(rows))
      .catch(() => {
        // If IDB fails, keep UI usable.
        setFavorites([]);
      });
  }, []);

  const refreshFavorites = async () => {
    const rows = await getAllFavorites();
    setFavorites(rows);
  };

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 60, // categories are relatively static
    retry: 1
  });

  const searchQuery = useQuery({
    queryKey: ['search', activeQuery],
    queryFn: () => searchMeals(activeQuery),
    enabled: Boolean(activeQuery),
    retry: 1
  });

  const filterQuery = useQuery({
    queryKey: ['filter', activeCategory],
    queryFn: () => filterMealsByCategory(activeCategory ?? ''),
    enabled: Boolean(activeCategory),
    retry: 1
  });

  const mealCards: MealCard[] = activeQuery ? searchQuery.data ?? [] : filterQuery.data ?? [];
  const mealsLoading = (activeQuery ? searchQuery.isLoading : filterQuery.isLoading) || false;
  const mealsError = (activeQuery ? searchQuery.error : filterQuery.error) as Error | null | undefined;

  async function toggleFavorite(meal: MealCard) {
    if (togglingId === meal.id) return;
    setTogglingId(meal.id);
    try {
      const isFav = favoriteIds.has(meal.id);
      if (isFav) {
        await removeFavorite(meal.id);
        toast.success('Removed from Favorites');
      } else {
        // Offline UX: only allow favoriting if we already have full details cached.
        const cachedDetails = await getMealDetails(meal.id);
        if (cachedDetails) {
          await saveFavorite(cachedDetails);
          toast.success('Saved to Favorites (cached)');
        } else if (!navigator.onLine) {
          toast.error('Offline: recipe details are not cached yet.');
        } else {
          const fullMeal = await lookupMeal(meal.id);
          await upsertMealDetails(fullMeal);
          await saveFavorite(fullMeal);
          toast.success('Saved to Favorites');
        }
      }

      await refreshFavorites();
    } catch (err) {
      toast.error('Could not update favorites.');
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  }

  const resultsTitle = activeCategory
    ? `Category: ${activeCategory}`
    : activeQuery
      ? `Search: ${activeQuery}`
      : 'Browse recipes';

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Search recipes" className="rounded-xl border border-border bg-card/50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = query.trim();
            if (!trimmed) return;
            setActiveQuery(trimmed);
            setActiveCategory(null);
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor="search-input">
            Search by recipe name
          </label>
          <Input
            id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meals (e.g. chicken)"
            autoComplete="off"
          />
          <Button type="submit" className="sm:w-auto">
            Search
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setActiveQuery('');
              setActiveCategory(null);
              setQuery('');
            }}
          >
            Clear
          </Button>
        </form>
      </section>

      <section aria-label="Recipe categories" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-100">Categories</h2>
        <div className="flex flex-wrap gap-2" role="list">
          {categoriesLoading ? (
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-24" />)
          ) : (
            (categories ?? []).map((cat) => {
              const isSelected = activeCategory === cat;
              return (
                <Button
                  key={cat}
                  type="button"
                  variant={isSelected ? 'default' : 'ghost'}
                  className="h-8 rounded-full px-3"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setActiveCategory(cat);
                    setActiveQuery('');
                  }}
                >
                  {cat}
                </Button>
              );
            })
          )}
        </div>
      </section>

      <section aria-label="Search results" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">{resultsTitle}</h2>
          {(activeQuery || activeCategory) && mealCards.length ? (
            <Badge>{mealCards.length} recipe(s)</Badge>
          ) : null}
        </div>

        {mealsError ? (
          <div role="alert" className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-sm font-medium text-rose-200">Could not load results.</p>
            <p className="mt-1 text-xs text-slate-300">{mealsError.message}</p>
          </div>
        ) : null}

        {mealsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : mealCards.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mealCards.map((meal) => (
              <RecipeCard
                key={meal.id}
                meal={meal}
                isFavorite={favoriteIds.has(meal.id)}
                onToggleFavorite={() => toggleFavorite(meal)}
                onOpenDetails={() => navigate(`/details/${meal.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
            <p className="text-sm font-medium text-slate-100">No results yet.</p>
            <p className="mt-2 text-sm text-slate-300">Try a search or pick a category.</p>
          </div>
        )}
      </section>
    </div>
  );
}

