import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WishlistHeartButton } from './WishlistHeartButton';
import { formatPrice, formatEcoScore, cn } from '@/lib/utils';

export interface ProductCardProps {
  product: {
    id: string;
    slug: string;
    title: string;
    image_url: string;
    price_cents: number;
    currency: string;
    store_name: string;
    store_slug: string;
    niche: string;
    eco_tags: string[];
    store_eco_score: number;
  };
  featured?: boolean;
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const eco = formatEcoScore(product.store_eco_score);

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300',
        'hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-stone-200/60'
      )}
    >
      {featured && (
        <div className="absolute left-3 top-3 z-10">
          <Badge variant="eco">Destacado</Badge>
        </div>
      )}

      <div className="relative aspect-square overflow-hidden bg-secondary/50">
        <Image
          src={product.image_url}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <WishlistHeartButton productId={product.id} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {product.store_name}
          </span>
          {product.store_eco_score > 0 && (
            <span
              className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', eco.variant)}
              title={`Eco-score: ${product.store_eco_score}/100`}
            >
              ● {eco.label}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-display text-base leading-tight text-foreground">
          {product.title}
        </h3>

        {product.eco_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.eco_tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="font-display text-lg text-foreground">
            {formatPrice(product.price_cents, product.currency)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
            Ver <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
