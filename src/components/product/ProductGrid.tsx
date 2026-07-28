import { ProductCard, type ProductCardProps } from './ProductCard';

export interface ProductGridProps {
  products: ProductCardProps['product'][];
  emptyMessage?: string;
  compareEnabled?: boolean;
}

export function ProductGrid({
  products,
  emptyMessage,
  compareEnabled = false,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          {emptyMessage ??
            'No hemos encontrado nada — prueba a cambiar los filtros.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          featured={false}
          compareEnabled={compareEnabled}
        />
      ))}
    </div>
  );
}
