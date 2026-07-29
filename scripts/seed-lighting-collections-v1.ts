/**
 * scripts/seed-lighting-collections-v1.ts
 * ============================================================================
 * Idempotent CLI that seeds 3 curated editorial collections on the
 * iluminacion niche for the Verano 2026 launch:
 *
 *   1. verano-techos-led        — Smart Cooling: 2x ventilador 3CCT + plafón
 *                                 CCT 50W + 2x lámpara curva + downlight
 *                                 corte ajustable (6 SKUs verified)
 *   2. verano-terraza-jardin    — Terraza & Jardín: 5 soluciones solares
 *                                 IP44/IP65 (5 SKUs verified)
 *   3. carril-inteligente       — Carril enchufes deslizantes (50 + 100cm)
 *                                 + tres mecanismos + regleta bajo mueble
 *                                 (6 SKUs verified)
 *
 * Slugs in this file are verified against Supabase via
 *   /rest/v1/products?slug=eq.<slug>&select=id
 * — every wishlist slug returns a real row.
 *
 * Re-running is safe (onConflict: 'slug'). If a slug is missing from the
 * catalog (e.g. a SKU is dropped later), the script logs a warning and
 * continues with whatever DID resolve — never aborts the whole publish.
 *
 * PREREQUISITE
 *   - supabase/seed.sql + scripts/seed-lighting-v1.ts already applied
 *     (masterled-es + curated products in Supabase)
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * RUN
 *   pnpm scripts:seed:lighting:collections                  # dry-run
 *   pnpm scripts:seed:lighting:collections -- --write       # apply
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Runtime config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '\u274c Missing required env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const WRITE = process.argv.includes('--write');

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------------
// Collections fixture — Verano 2026 (verified slugs)
// ---------------------------------------------------------------------------

interface CollectionCfg {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  /** We deliberately leave cover_image_url null — the collection page
   *  (src/app/(shop)/collections/[slug]/page.tsx) falls back to the first
   *  product's image_url when cover_image_url is null, so the page looks
   *  real even without a custom cover. */
  cover_image_url: null;
  /** Wishlist of masterled-* slugs. Order = display order in the capsule. */
  product_slugs: readonly string[];
}

const COLLECTIONS: readonly CollectionCfg[] = [
  {
    slug: 'verano-techos-led',
    title: 'Techos LED con luz y ventilaci\u00f3n \u2014 Verano 2026',
    subtitle:
      '6 soluciones para refrescar el sal\u00f3n con luz funcional: ventiladores de techo con luz LED 3CCT, plafones CCT 50W, dos l\u00e1mparas curvas colgantes y un downlight de corte ajustable.',
    description:
      'C\u00e1psula curada para modernizar la iluminaci\u00f3n de techo del sal\u00f3n o el dormitorio. Incluye dos variantes del ventilador con aspas retr\u00e1ctiles y luz LED 3CCT (la mejor opci\u00f3n para reducir calor y regular la temperatura de color), un plaf\u00f3n CCT 50W para cocinas grandes, dos l\u00e1mparas LED colgantes de la serie curva con dise\u00f1o escandinavo y un downlight circular de corte ajustable (instalaci\u00f3n limpia en falso techo). Eficiencia lum\u00ednica verificable y stock UE.',
    cover_image_url: null,
    product_slugs: [
      'masterled-ventilador-de-techo-con-aspas-retractiles-luz-led-3cct-contr-5380',
      'masterled-ventilador-de-techo-con-aspas-retractiles-luz-led-3cct-contr-5381',
      'masterled-plafon-led-redondo-cct-50w-3029',
      'masterled-lampara-de-techo-led-60w-curva6-2443',
      'masterled-lampara-de-techo-led-38w-curva5-2441',
      'masterled-downlight-panel-30w-circular-de-corte-ajustable-3610',
    ],
  },
  {
    slug: 'verano-terraza-jardin',
    title: 'Terraza & Jard\u00edn \u2014 farolas solares Verano 2026',
    subtitle:
      '5 soluciones solares para exterior: farolas de 40W a 100W, aplique con detector y baliza de pie con sensor PIR.',
    description:
      'C\u00e1psula curada para terrazas, jardines y fincas con cinco escalas de uso: una farola de 100W y 8000 l\u00famenes, una farola de 60W, una opci\u00f3n de 40W con sensor, un aplique de pared con detector y una baliza de pie PIR. Se priorizan usos distintos frente a repetir variantes casi id\u00e9nticas.',
    cover_image_url: null,
    product_slugs: [
      'masterled-farola-solar-led-100w-8000lm-ip65-3129',
      'masterled-farola-solar-led-60w-5000lm-ip65-2167',
      'masterled-farola-solar-led-40w-con-sensor-de-movimiento-ip65-2043',
      'masterled-aplique-de-pared-solar-led-con-detector-de-movimiento-y-luz--2555',
      'masterled-baliza-solar-led-de-pie-62-cm-con-sensor-de-movimiento-pir-i-2414',
    ],
  },
  {
    slug: 'carril-inteligente',
    title: 'Carril de enchufes deslizantes \u2014 sistema completo',
    subtitle:
      '6 piezas verificadas: carriles de 50 y 100cm, tres mecanismos Schuko/USB compatibles y regleta bajo mueble.',
    description:
      'El sistema completo para modernizar puntos de enchufe: carriles deslizantes de 50 y 100cm, m\u00f3dulo Schuko de 16A y dos opciones USB A+C compatibles. Se a\u00f1ade una regleta bajo mueble con Schuko y USB como alternativa compacta para cocina o escritorio.',
    cover_image_url: null,
    product_slugs: [
      'masterled-carril-enchufes-deslizantes-100cm-5386',
      'masterled-carril-enchufes-deslizantes-50cm-3430',
      'masterled-enchufe-schuko-para-rail-16a-3432',
      'masterled-enchufe-usb-a-c-para-rail-2-4a-3433',
      'masterled-enchufe-usb-a-c-3-1a-para-carril-deslizante-5383',
      'masterled-regleta-led-bajo-mueble-9w-toma-schuko-usb-a-c-blanco-gris-3871',
    ],
  },
];

// ---------------------------------------------------------------------------
// Generic collection upsert (DRY, loops over COLLECTIONS)
// ---------------------------------------------------------------------------

type Resolution = {
  collection: CollectionCfg;
  resolvedIds: string[];
  missing: string[];
  collectionId: string | null;
  createdFresh: boolean;
};

function logSection(label: string) {
  console.log(
    `\n\u2500\u2500 ${label} ${'\u2500'.repeat(Math.max(0, 60 - label.length))}`,
  );
}

async function ensureCollection(cfg: CollectionCfg): Promise<Resolution> {
  // 1. Resolve slugs → ids in wish-list order. Skip missing.
  const productsRes = await sb
    .from('products')
    .select('id, slug')
    .in('slug', [...cfg.product_slugs])
    .eq('in_stock', true);
  if (productsRes.error) {
    throw new Error(
      `Product lookup for '${cfg.slug}' failed: ${productsRes.error.message}`,
    );
  }

  const idBySlug = new Map<string, string>();
  for (const r of (productsRes.data ?? []) as Array<{
    id: string;
    slug: string;
  }>) {
    idBySlug.set(r.slug, r.id);
  }
  const missing = cfg.product_slugs.filter((s) => !idBySlug.has(s));
  const resolvedIds: string[] = [];
  for (const s of cfg.product_slugs) {
    const id = idBySlug.get(s);
    if (id) resolvedIds.push(id);
  }

  if (missing.length > 0) {
    console.warn(
      `  \u26a0\ufe0f  ${cfg.slug}: ${missing.length} slug(s) missing in catalog, skipping: ${missing.join(', ')}`,
    );
  }
  console.log(
    `  \u2713 ${cfg.slug}: resolved ${resolvedIds.length}/${cfg.product_slugs.length} product IDs`,
  );

  if (!WRITE) {
    return {
      collection: cfg,
      resolvedIds,
      missing,
      collectionId: null,
      createdFresh: false,
    };
  }

  // 2. Check if collection already published (preserve published_at).
  const preRes = await sb
    .from('editorial_collections')
    .select('id, published, published_at')
    .eq('slug', cfg.slug)
    .maybeSingle();
  let alreadyPublished = false;
  let existingPublishedAt: string | null = null;
  if (!preRes.error && preRes.data) {
    const pre = preRes.data as {
      published: boolean | null;
      published_at: string | null;
    };
    alreadyPublished = !!pre.published && !!pre.published_at;
    existingPublishedAt = pre.published_at ?? null;
  }

  // 3. Upsert.
  const collRes = await sb
    .from('editorial_collections')
    .upsert(
      {
        slug: cfg.slug,
        title: cfg.title,
        subtitle: cfg.subtitle,
        description: cfg.description,
        cover_image_url: cfg.cover_image_url,
        niche: 'iluminacion',
        product_ids: resolvedIds,
        published: true,
        published_at: alreadyPublished
          ? existingPublishedAt
          : new Date().toISOString(),
      } as never,
      { onConflict: 'slug' },
    )
    .select('id, published_at')
    .single();
  if (collRes.error) {
    throw new Error(
      `Collection upsert for '${cfg.slug}' failed: ${collRes.error.message}`,
    );
  }

  const r = collRes.data as { id: string; published_at: string | null };
  console.log(
    `  \u2713 ${cfg.slug}: id=${r.id.slice(0, 8)}\u2026 published_at=${r.published_at ?? '(null)'} ${alreadyPublished ? '(preserved)' : '(fresh)'}`,
  );
  return {
    collection: cfg,
    resolvedIds,
    missing,
    collectionId: r.id,
    createdFresh: !alreadyPublished,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\u25b6 Seeding ${COLLECTIONS.length} iluminacion collections (Verano 2026)${
      !WRITE ? ' [DRY RUN \u2014 no DB writes]' : ''
    }`,
  );

  logSection('STEP 1 \u2014 resolve product slugs against catalog');
  const resolutions: Resolution[] = [];
  for (const cfg of COLLECTIONS) {
    const res = await ensureCollection(cfg);
    resolutions.push(res);
  }

  logSection('STEP 2 \u2014 final report');
  const summary = {
    ok: true,
    dryRun: !WRITE,
    collections: resolutions.map((r) => ({
      slug: r.collection.slug,
      title: r.collection.title,
      productIdsResolved: r.resolvedIds.length,
      productIdsMissing: r.missing.length,
      missing: r.missing,
      collectionId: r.collectionId,
      publishedFresh: r.createdFresh,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!WRITE) {
    console.log(
      '\n\u2705 DRY RUN OK \u2014 no DB writes performed. Re-run with --write to apply.\n',
    );
    return;
  }
  console.log(
    '\n\u2705 DONE \u2014 3 lighting collections seeded for /collections/<slug> URLs.\n',
  );
}

main().catch((err) => {
  console.error('\n\u274c FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
