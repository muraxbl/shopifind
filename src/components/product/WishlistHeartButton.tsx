'use client';

/**
 * WishlistHeartButton — small Client Component island used inside ProductCard.
 *
 * Why this is its own component:
 * - ProductCard.tsx is rendered as a Server Component (inside `/`, `/explore/*`,
 *   and `/store/[slug]`), and Server Components cannot receive onClick handlers
 *   in Next.js 15's App Router.
 * - Extracting ONLY this icon keeps the entire card as server-rendered HTML
 *   (great for SEO + image optimization), and ships only the tiny client JS
 *   needed to react to the click.
 *
 * Uses the same server actions as the full PDP button while keeping the card
 * itself server-rendered.
 */

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { addToWishlist, removeFromWishlist } from '@/actions/wishlist';
import { cn } from '@/lib/utils';

export function WishlistHeartButton({
  productId,
  initiallyInWishlist = false,
}: {
  productId: string;
  initiallyInWishlist?: boolean;
}) {
  const [inWishlist, setInWishlist] = useState(initiallyInWishlist);
  const [isPending, start] = useTransition();

  return (
    <button
      type="button"
      aria-label={inWishlist ? 'Quitar de wishlist' : 'Guardar en wishlist'}
      aria-pressed={inWishlist}
      disabled={isPending}
      data-product-id={productId}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const previous = inWishlist;
          setInWishlist(!previous);
          try {
            if (previous) {
              await removeFromWishlist(productId);
            } else {
              await addToWishlist({ productId, notify: true });
            }
          } catch (error) {
            setInWishlist(previous);
            throw error;
          }
        });
      }}
      className={cn(
        'absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-foreground/70 backdrop-blur transition-colors hover:bg-background hover:text-rose-500 disabled:cursor-wait disabled:opacity-70',
        inWishlist && 'text-rose-500'
      )}
    >
      <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
    </button>
  );
}
