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
  primaryNiches: ['sustainable-fashion', 'indie-gadgets', 'home-deco'] as const,
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
};
