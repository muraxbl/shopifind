'use client';

import { useTransition, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { addToWishlist, removeFromWishlist } from '@/actions/wishlist';
import { cn } from '@/lib/utils';

interface Props extends Omit<ButtonProps, 'onClick'> {
  productId: string;
  priceWhenAdded: number;
  storeUrl?: string;
  /** Optional: pre-fill "in wishlist" state for SSR. */
  initiallyInWishlist?: boolean;
}

export function AddToWishlistButton({
  productId,
  priceWhenAdded,
  storeUrl,
  initiallyInWishlist = false,
  className,
  children,
  ...rest
}: Props) {
  const [isPending, start] = useTransition();
  const [inWishlist, setInWishlist] = useState(initiallyInWishlist);

  const handleClick = () => {
    start(async () => {
      try {
        if (inWishlist) {
          await removeFromWishlist(productId);
          setInWishlist(false);
        } else {
          await addToWishlist({
            productId,
            priceWhenAdded: priceWhenAdded,
            storeUrl,
            notify: true,
          });
          setInWishlist(true);
        }
      } catch (e) {
        // V1: surface a toast.
        console.error('Wishlist toggle failed', e);
      }
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className={cn('gap-2', className)}
      variant={inWishlist ? 'default' : rest.variant ?? 'outline'}
      {...rest}
    >
      <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
      {children ?? (isPending ? 'Guardando…' : inWishlist ? 'En tu wishlist' : 'Guardar')}
    </Button>
  );
}
