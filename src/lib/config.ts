/**
 * Site-wide configuration.
 * Adjust the niche focus here — the rest of the app keys off this.
 */

export const SITE_CONFIG = {
  name: 'Shopifind',
  tagline: 'Less Amazon, more you.',
  description:
    'Buscador B2C de tiendas independientes en moda sostenible, gadgets indie y deco/hogar. Curado, ético, sin dropshipping genérico.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shopifind.app',
  primaryNiches: ['sustainable-fashion', 'indie-gadgets', 'home-deco', 'iluminacion'] as const,
  legalDisclaimer:
    'Shopifind es una plataforma independiente de descubrimiento de productos. No estamos afiliados, respaldados ni patrocinados por Shopify Inc. "Shopify" es una marca registrada de Shopify Inc. y se usa aquí únicamente para describir comerciantes que operan en esa plataforma.',
};

export type NicheId = (typeof SITE_CONFIG.primaryNiches)[number];

export const NICHE_LABEL: Record<NicheId, { label: string; emoji: string; tagline: string }> = {
  'sustainable-fashion': {
    label: 'Moda sostenible',
    emoji: '👗',
    tagline: 'Marcas D2C, fabricación ética, materiales responsables.',
  },
  'indie-gadgets': {
    label: 'Gadgets indie',
    emoji: '🎛️',
    tagline: 'Pequeños fabricantes de accesorios tech, productividad y audio.',
  },
  'home-deco': {
    label: 'Deco & hogar',
    emoji: '🏠',
    tagline: 'Decoración artesanal, muebles de marcas independientes, textiles.',
  },
  iluminacion: {
    label: 'Iluminación',
    emoji: '💡',
    tagline: 'LED, smart Lighting, eficiencia energética bajo la lupa.',
  },
};

// ----- Pagination defaults (shared by /explore and /search) -----
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 96;
export const MIN_PAGE_SIZE = 12;

/**
 * Identity of a row in the niche facet list. Empty string = "no filter"
 * pseudo-entry, present in the search sidebar only (where it makes sense
 * to say "Todos los nichos"); /explore never shows the pseudo-entry
 * because there is no "all niches" page in the App Router.
 */
export type NicheFacetId = '' | NicheId;

export interface NicheFacetItem {
  id: NicheFacetId;
  label: string;
}

/**
 * Single source of truth for the niche chip list. Used by both
 *    - /search/page.tsx  filter sidebar (with the 'Todos' pseudo-entry)
 *    - /explore/[niche]/page.tsx (without the pseudo-entry, since there
 *      is no /explore listing-of-all-niches route)
 * Replaces the hardcoded array that previously lived inside
 * src/app/(shop)/search/page.tsx and was prone to drift when a new
 * primaryNiche was added.
 */
export const NICHE_FACET: readonly NicheFacetItem[] = (() => {
  const all: NicheFacetItem[] = [{ id: '', label: 'Todos' }];
  for (const id of SITE_CONFIG.primaryNiches) {
    const meta = NICHE_LABEL[id];
    all.push({ id, label: `${meta.emoji} ${meta.label}` });
  }
  return all;
})();
