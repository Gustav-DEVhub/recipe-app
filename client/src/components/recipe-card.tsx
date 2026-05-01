import type { MealCard } from '../lib/theMealDb';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Heart } from 'lucide-react';

export function RecipeCard({
  meal,
  isFavorite,
  onToggleFavorite,
  onOpenDetails
}: {
  meal: MealCard;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetails: () => void;
}) {
  return (
    <Card className="premium-panel group overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3] w-full bg-white/5">
        <img
          src={meal.offlineThumbnail ?? meal.thumbnail}
          alt={`Thumbnail for ${meal.title}`}
          loading="lazy"
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
      </CardContent>
    </Card>
  );
}
