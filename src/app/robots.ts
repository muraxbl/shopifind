import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/lib/config';

/**
 * Dynamic /robots.txt (Next.js 13+ convention from src/app/robots.ts).
 *
 * Allow ALL routes by default — Shopifind is a public-facing
 * discovery / SEO-friendly catalogue and we want maximum indexability
 * for the 3 collection pages, 4 explore hubs and 1441 product pages.
 *
 * Block these specific routes:
 *
 *   /api/   — REST/Server endpoints; never indexable.
 *   /admin/ — private ops/admin tools (future-proof even if empty now
 *             — Google will find the path once it exists).
 *   /auth/  — login / OAuth callback endpoints; never indexable.
 *   /go/    — \u2192 Skimlinks affiliate redirects (302 to go.redirectingat.com).
 *             Crawling these counts as Skimlinks click-outs and causes
 *             pure noise in our affiliate dashboard. Block the bot path.
 *   /search — infinite permutational URL space (?q=*, &niche=*, &tag=*);
 *             disallow prevents crawler traps and duplicate-content
 *             dilution.
 *
 * Sitemap reference appended so Googlebot picks up the URL list on the
 * same fetch.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.url.replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/auth/', '/go/', '/search'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
