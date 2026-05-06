import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { getFavorite, getMealDetails, removeFavorite, saveFavorite, upsertMealDetails } from '../features/favorites/db';
import { lookupMeal } from '../lib/api';
import type { Meal } from '../lib/theMealDb';

const IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="%230b1220"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23cbd5e1" font-family="sans-serif" font-size="34">Image unavailable offline</text></svg>';

function isFullMeal(value: unknown): value is Meal {
  const meal = value as Meal | null;
  return Boolean(meal && typeof meal.id === 'string' && Array.isArray(meal.ingredients));
}

export default function Details() {
  const { id } = useParams<{ id: string }>();
  const mealId = String(id ?? '').trim();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { prefetchedMeal?: Meal; fromSearch?: string } | null) ?? null;
  const prefetchedMeal = navState?.prefetchedMeal;

  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const query = useQuery({
    queryKey: ['meal', mealId],
    enabled: Boolean(mealId),
    queryFn: async (): Promise<Meal> => {
      if (prefetchedMeal && String((prefetchedMeal as Meal).id ?? '').trim() === mealId && isFullMeal(prefetchedMeal)) {
        await upsertMealDetails(prefetchedMeal);
        return prefetchedMeal;
      }

      // Local-first: if this recipe is already stored, render it even with no network.
      const localCached = await getMealDetails(mealId);
      if (localCached && isFullMeal(localCached)) return localCached;
      const localFavorite = await getFavorite(mealId);
      if (localFavorite && isFullMeal(localFavorite)) {
        await upsertMealDetails(localFavorite);
        return localFavorite;
      }

      try {
        const meal = await lookupMeal(mealId);
        await upsertMealDetails(meal);
        return meal;
      } catch (err) {
        // Final fallback if local cache was not available before.
        const cached = await getMealDetails(mealId);
        if (cached && isFullMeal(cached)) return cached;
        const fromFavorite = await getFavorite(mealId);
        if (fromFavorite && isFullMeal(fromFavorite)) return fromFavorite;
        throw err;
      }
    },
    retry: 1
  });

  const { data: meal, isLoading, error, refetch } = query;

  // Load favorite status from IndexedDB when the route changes.
  useEffect(() => {
    let ignore = false;
    if (!mealId) return;

    (async () => {
      try {
        const fav = await getFavorite(mealId);
        if (!ignore) setIsFavorite(Boolean(fav));
      } catch {
        // ignore
      }
    })();

    return () => {
      ignore = true;
    };
  }, [mealId]);

  async function toggleFavorite() {
    if (!meal) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await removeFavorite(meal.id);
        setIsFavorite(false);
        toast.success('Removed from Favorites');
      } else {
        // meal is either fresh from API or cached via the queryFn offline fallback.
        await saveFavorite(meal);
        setIsFavorite(true);
        toast.success('Saved to Favorites');
      }
    } catch (err) {
      toast.error('Could not update favorite.');
      console.error(err);
    } finally {
      setFavoriteLoading(false);
    }
  }

  const tags = meal?.tags ?? [];
  const canGoBack = window.history.length > 1;
  const querySuffix = navState?.fromSearch ?? '';

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Back navigation">
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => {
            if (canGoBack) {
              navigate(-1);
              return;
            }
            navigate(`/${querySuffix}`);
          }}
        >
          Back
        </Button>
      </section>

      <section aria-label="Recipe details">
        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="aspect-[16/10] w-full rounded-xl" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-4 h-32 w-full" />
            </div>
          </div>
        ) : !mealId ? (
          <div role="alert" className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-sm font-medium text-rose-200">Invalid recipe link.</p>
            <p className="mt-1 text-xs text-muted">Missing recipe id.</p>
            <Button className="mt-3" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        ) : error || !meal ? (
          <div role="alert" className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-sm font-medium text-rose-200">Recipe not available offline.</p>
            <p className="mt-1 text-xs text-muted">{(error as Error)?.message ?? 'Not found'}</p>
            <Button className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl border border-border bg-card/50">
                {meal.thumbnail ? (
                  <img
                    src={meal.offlineThumbnail ?? meal.thumbnail}
                    alt={`Image of ${meal.title}`}
                    className="h-auto w-full max-h-[320px] object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = IMAGE_FALLBACK;
                    }}
                  />
                ) : (
                  <div className="aspect-[16/10] bg-white/5" />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {meal.category ? <Badge>{meal.category}</Badge> : null}
                {meal.area ? <Badge>{meal.area}</Badge> : null}
                {tags.map((t) => (
                  <Badge key={t} className="bg-white/10">
                    {t}
                  </Badge>
                ))}
              </div>

              <Card className="premium-panel">
                <CardContent className="p-5">
                  <h1 className="text-main text-xl font-semibold">{meal.title}</h1>
                  <p className="text-muted mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {meal.instructions ?? 'No instructions available.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <aside className="flex flex-col gap-4">
              <Card className="premium-panel">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">Ingredients</h2>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" className="premium-btn-ghost h-9 border border-slate-500/40">
                          View all
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Ingredients for {meal.title}</DialogTitle>
                          <DialogDescription>Stored offline if you favorite this recipe.</DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 max-h-[70vh] overflow-auto pr-2">
                          {meal.ingredients.length ? (
                            <ul className="space-y-2">
                              {meal.ingredients.map((ing, idx) => (
                                <li key={`${ing.ingredient}-${idx}`} className="flex gap-3 text-sm">
                                  <span className="text-main font-medium">{ing.ingredient}</span>
                                  <span className="text-muted">{ing.measure}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted text-sm">No ingredients found.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {meal.ingredients.slice(0, 8).map((ing, idx) => (
                      <li key={`${ing.ingredient}-${idx}`} className="flex gap-3 text-sm">
                        <span className="text-main font-medium">{ing.ingredient}</span>
                        <span className="text-muted">{ing.measure}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="premium-panel">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold">YouTube</h2>
                  {meal.youtubeUrl ? (
                    <Button asChild className="premium-btn-ghost mt-3 w-full justify-start border border-slate-500/40" size="default">
                      <a href={meal.youtubeUrl} target="_blank" rel="noreferrer">
                        Watch on YouTube
                      </a>
                    </Button>
                  ) : (
                    <p className="text-muted mt-2 text-sm">No video provided.</p>
                  )}
                  <Button
                    onClick={toggleFavorite}
                    className="mt-4 w-full premium-btn-main"
                    aria-pressed={isFavorite}
                    disabled={favoriteLoading}
                  >
                    {isFavorite ? 'Unfavorite' : 'Favorite'}
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </section>

      <section aria-label="Navigation hint">
        <Link to="/" className="text-sm text-sky-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
          Back to Home
        </Link>
      </section>
    </div>
  );
}
