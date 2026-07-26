'use client';

/**
 * WishlistHeartButton — small Client Component island used inside ProductCard.
 *
 * Why this is its own component:
 * - ProductCard.tsx is rendered as a Server Component (inside `/`, `/explore/*`,
 *   and `/store/[slug]`), and Server Components cannot receive onClick handlers
 *   in Next.js 14's App Router.
 * - Extracting ONLY this icon keeps the entire card as server-rendered HTML
 *   (great for SEO + image optimization), and ships only the tiny client JS
 *   needed to react to the click.
 *
 * V1: stub (no-op handler that opens a future dialog or navigates to /wishlist).
 * V2: will wire to `addToWishlist` server action with optimistic UI, same as
 * the existing `AddToWishlistButton` on the product detail page.
 */

import { Heart } from 'lucide-react';

export function WishlistHeartButton({ productId }: { productId: string }) {
  return (
    <button
      type="button"
      aria-label="Guardar en wishlist"
      data-product-id={productId}
      onClick={(e) => {
        // Stop propagation so the wrapping <Link> in ProductCard does not
        // also navigate to the product page when the user clicks the heart.
        // (preventDefault is a no-op on type="button" so it's omitted.)
        e.stopPropagation();
        // TODO (V2): wire to addToWishlist server action with optimistic UI.
      }}
      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-foreground/70 backdrop-blur transition-colors hover:bg-background hover:text-rose-500"
    >
      <Heart className="h-4 w-4" />
    </button>
  );
}
