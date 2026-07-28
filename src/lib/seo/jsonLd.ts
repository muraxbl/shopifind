type ProductJsonLdInput = {
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  storeName: string;
  storeSlug: string;
  siteUrl: string;
};

export function buildProductJsonLd(input: ProductJsonLdInput) {
  const baseUrl = input.siteUrl.replace(/\/+$/, '');
  const productUrl = `${baseUrl}/product/${input.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    image: [input.imageUrl],
    url: productUrl,
    offers: {
      '@type': 'Offer',
      price: (input.priceCents / 100).toFixed(2),
      priceCurrency: input.currency,
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: productUrl,
      seller: {
        '@type': 'Organization',
        name: input.storeName,
        url: `${baseUrl}/store/${input.storeSlug}`,
      },
    },
  };
}

/** Prevent catalog text from closing the JSON-LD script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
