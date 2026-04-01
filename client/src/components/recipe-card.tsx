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
    <Card className="group overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-white/5">
        <img
          src={meal.thumbnail}
          alt={`Thumbnail for ${meal.title}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-2 top-2 flex gap-2">
          {meal.category ? <Badge>{meal.category}</Badge> : null}
        </div>
        <div className="absolute right-2 top-2">
          <Button
            type="button"
            variant={isFavorite ? 'default' : 'secondary'}
            size="icon"
            aria-label={isFavorite ? 'Unfavorite recipe' : 'Favorite recipe'}
            aria-pressed={isFavorite}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="rounded-full"
          >
            <Heart aria-hidden className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>
        </div>
      </div>

      <CardContent className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenDetails}
          className="text-left focus:outline-none"
          aria-label={`Open recipe details for ${meal.title}`}
        >
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{meal.title}</h3>
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          {meal.area ? <span className="rounded-full bg-white/5 px-2 py-1">{meal.area}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

