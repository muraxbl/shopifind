'use client';

import { useTransition, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { addToWishlist, removeFromWishlist } from '@/actions/wishlist';
import { cn } from '@/lib/utils';

interface Props extends Omit<ButtonProps, 'onClick'> {
  productId: string;
  /** Optional: pre-fill "in wishlist" state for SSR. */
  initiallyInWishlist?: boolean;
}

export function AddToWishlistButton({
  productId,
  initiallyInWishlist = false,
  className,
  children,
  ...rest
}: Props) {
  const [isPending, start] = useTransition();
  const [inWishlist, setInWishlist] = useState(initiallyInWishlist);

  const handleClick = () => {
    start(async () => {
      const previous = inWishlist;
      setInWishlist(!previous);
      try {
        if (previous) {
          await removeFromWishlist(productId);
        } else {
          await addToWishlist({ productId, notify: true });
        }
      } catch (e) {
        setInWishlist(previous);
        throw e;
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
