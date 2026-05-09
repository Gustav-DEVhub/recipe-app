import type { MealCard } from '../lib/theMealDb';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Heart } from 'lucide-react';

const IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="%230b1220"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23cbd5e1" font-family="sans-serif" font-size="28">Image unavailable offline</text></svg>';

export function RecipeCard({
  meal,
  isFavorite,
  onToggleFavorite,
  onOpenDetails,
  onAddToShoppingList
}: {
  meal: MealCard;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetails: () => void;
  onAddToShoppingList?: () => void;
}) {
  return (
    <Card className="premium-panel motion-card group mx-auto w-full max-w-md overflow-hidden rounded-2xl transition-all duration-300 sm:max-w-none">
      <div className="relative aspect-[4/3] w-full bg-white/5">
        <img
          src={meal.offlineThumbnail ?? meal.thumbnail}
          alt={`Thumbnail for ${meal.title}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = IMAGE_FALLBACK;
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-2 top-2 flex gap-2">
          {meal.category ? <Badge>{meal.category}</Badge> : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      </div>

      <CardContent className="space-y-3 p-4 pt-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-main">{meal.title}</h3>

        <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
          {meal.area ? <span className="premium-accent rounded-full border px-2 py-1">{meal.area}</span> : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={onOpenDetails}
            className="premium-btn-main h-9 rounded-lg text-sm font-semibold"
            aria-label={`View recipe details for ${meal.title}`}
          >
            View
          </Button>
          <Button
            type="button"
            aria-label={isFavorite ? 'Unfavorite recipe' : 'Favorite recipe'}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="premium-btn-ghost h-9 rounded-lg border border-slate-500/40 text-sm font-semibold"
          >
            <Heart aria-hidden className="mr-2 h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'Favorited' : 'Favorite'}
          </Button>
        </div>
        {onAddToShoppingList ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onAddToShoppingList}
            className="h-9 w-full rounded-lg text-sm font-semibold"
            aria-label={`Add ${meal.title} ingredients to shopping list`}
          >
            Add to list
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
