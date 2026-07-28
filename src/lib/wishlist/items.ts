export type WishlistItem = {
  product_id: string;
  store_url?: string;
  price_when_added: number;
  notify: boolean;
  added_at: string;
};

export function normalizeWishlistItems(value: unknown): WishlistItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is WishlistItem => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.product_id === 'string' &&
      typeof row.price_when_added === 'number' &&
      Number.isFinite(row.price_when_added) &&
      typeof row.notify === 'boolean' &&
      typeof row.added_at === 'string' &&
      (row.store_url === undefined || typeof row.store_url === 'string')
    );
  });
}

export function hasWishlistItem(items: readonly WishlistItem[], productId: string): boolean {
  return items.some((item) => item.product_id === productId);
}

export function appendWishlistItem(
  items: readonly WishlistItem[],
  item: WishlistItem
): WishlistItem[] {
  return hasWishlistItem(items, item.product_id) ? [...items] : [...items, item];
}

export function withoutWishlistItem(
  items: readonly WishlistItem[],
  productId: string
): WishlistItem[] {
  return items.filter((item) => item.product_id !== productId);
}
