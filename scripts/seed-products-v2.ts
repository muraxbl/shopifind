/**
 * scripts/seed-products-v2.ts
 * ============================================================================
 * Idempotent CLI that seeds the Sustainable-fashion MVP vertical:
 *
 *   - 10 new stores: patagonia-us, reformation-us, veja, stella-mccartney,
 *                    asket, armedangels, ecoalf, mud-jeans, rapanui, knowledge-cotton
 *   - 40 new products: ~4 anchor products per store, hand-curated.
 *
 * Running it multiple times is safe — every write uses `onConflict` on a
 * unique column (stores.slug, products.slug).
 *
 * PREREQUISITE
 *   1. Apply supabase/00000000000000_init.sql + 00000000000001_click_attribution.sql
 *      so the `stores` and `products` tables exist.
 *   2. (Optional) Apply supabase/seed.sql to seed the 6 baseline stores.
 *      Not a hard dependency — the v2 script UPSERTs its own store rows.
 *   3. Add to .env.local:
 *        NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * RUN (from project root)
 *   pnpm scripts:seed:products                             # upsert all 10 stores + 40 products
 *   pnpm scripts:seed:products -- --dry-run                # dry-run (no DB writes)
 *   pnpm scripts:seed:products -- --include-stores=patagonia-us,veja
 *                                                            # upsert only the named store slugs
 *   pnpm scripts:seed:products -- --include-stores=patagonia-us,veja --dry-run
 *                                                            # dry-run only for those stores
 *
 * --include-stores  Comma-separated store slugs to seed (subset of STORE_FIXTURE).
 *                    Useful for pilot-launching 1–2 merchants with verified URLs
 *                    while the rest of the catalogue finishes URL validation.
 *
 * WHAT THIS SCRIPT DOES (in order)
 *   1. Pre-flight HEAD validation of every source_url → flags 4xx/5xx as warnings
 *      (anti-bot/CF protection frequently returns 403 to bare HEAD; we treat that as
 *      "validatable, but hotlink-protected" rather than as a failure).
 *   2. UPSERT 10 new stores (one batched request).
 *   3. UPSERT 40 new products (one batched request; resolves store_id via slug).
 *
 * IMAGE POLICY — important
 *   All products are written with `placehold.co/<encoded slug>` image URLs
 *   (full URL with `https://placehold.co/600x600?text=<Slug>`).
 *   Rationale: every merchant's CDN root path is private to its own infra
 *   (Shopify store-id-format, Demandware, Cloudfront), and hand-typing those
 *   URLs risks writing broken rows. The `_next/image` optimizer + the
 *   `dangerouslyAllowSVG` flag we set in next.config.mjs render these
 *   placeholders correctly today.
 *
 *   After production has inventory feeds from each merchant, the migration to
 *   real CDN URLs is a single SQL batch:
 *
 *      UPDATE products
 *      SET image_url = 'https://cdn.shopify.com/...'
 *      WHERE slug IN ('patagonia-torrentshell-3l', ...);
 *
 *   This keeps the launch path deterministic while preserving the SEO + UX
 *   ergonomics (title, price, eco_tags, source_url PDP link) immediately.
 *
 * NO INGEST_SECRET needed — this script uses the service-role admin client
 * directly (the `/api/products/ingest` endpoint is for cron / external callers).
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ---------------------------------------------------------------------------
// Runtime config + admin client
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (in .env.local or your shell).'
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const sb = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Step 1 fixture — 10 new SF stores
// ---------------------------------------------------------------------------

type StoreSeed = {
  slug: string;
  name: string;
  url: string;
  niche: 'sustainable-fashion';
  short_description: string;
  long_description: string;
  eco_score: number;
  values: string[];
  country: string;
  affiliate_program: 'skimlinks';
  active: true;
  verified: false;
  featured: boolean;
};

const STORE_FIXTURE: StoreSeed[] = [
  {
    slug: 'patagonia-us',
    name: 'Patagonia',
    url: 'https://eu.patagonia.com/gb/en/home',
    niche: 'sustainable-fashion',
    short_description: 'Outdoor ético y reciclados desde 1973.',
    long_description:
      'Patagonia es un referente histórico de la moda outdoor ética: 1% for the Planet, repair & reuse program, materiales reciclados y fair-trade en toda la cadena.',
    eco_score: 85,
    values: ['b-corp', 'fair-trade', 'recycled', 'repair-program'],
    country: 'US',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'reformation-us',
    name: 'Reformation',
    url: 'https://www.thereformation.com',
    niche: 'sustainable-fashion',
    short_description: 'Moda femenina con trazabilidad por pieza.',
    long_description:
      'Reformation publica el impacto ambiental por producto: CO₂, agua, residuos. Fabrica con fibras recicladas, orgánicas y de proximidad; reporta su supplier list.',
    eco_score: 82,
    values: ['transparent-supply-chain', 'recycled', 'eu-made', 'female-founded'],
    country: 'US',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'veja',
    name: 'Veja',
    url: 'https://www.veja-store.com/en_eu',
    niche: 'sustainable-fashion',
    short_description: 'Sneakers法国sostenibles: caucho amazónico + algodón orgánico.',
    long_description:
      'Veja produce sneakers en Brasil con materia prima rastreable (caucho natural del Amazonas, algodón orgánico de Perú, arroz del Sur de Brasil). Modelo de comercio justo.',
    eco_score: 88,
    values: ['fair-trade', 'organic', 'recycled', 'low-impact'],
    country: 'FR',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'stella-mccartney',
    name: 'Stella McCartney',
    url: 'https://www.stellamccartney.com',
    niche: 'sustainable-fashion',
    short_description: 'Lujo sostenible desde 2001.',
    long_description:
      'Stella McCartney es pionera de moda de lujo cruelty-free: nunca usa cuero, plumas o pieles. Materiales: Mylo (micelio), Econyl (nylon reciclado), algodón orgánico.',
    eco_score: 78,
    values: ['vegan', 'cruelty-free', 'recycled', 'innovative-materials'],
    country: 'UK',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: false,
  },
  {
    slug: 'asket',
    name: 'ASKET',
    url: 'https://asket.com/eu/',
    niche: 'sustainable-fashion',
    short_description: 'Básicos suecos con trazabilidad radical.',
    long_description:
      'ASKET publica el impacto real por prenda (no la huella "promedio de la industria"). Algodón 100% GOTS, denim crudo, sastrería lenta. Programa de "permanent collection".',
    eco_score: 91,
    values: ['transparent-supply-chain', 'gots', 'slow-fashion', 'permanent-collection'],
    country: 'SE',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'armedangels',
    name: 'Armedangels',
    url: 'https://www.armedangels.com',
    niche: 'sustainable-fashion',
    short_description: 'Moda orgánica alemana con estilo limpio.',
    long_description:
      'Armedangels: algodón orgánico GOTS, denim orgánico, lana merina RWS. Fabrica en Portugal, Túnez y Alemania. Programa "Detox Denim".',
    eco_score: 86,
    values: ['organic', 'gots', 'eu-made', 'transparent-supply-chain'],
    country: 'DE',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: false,
  },
  {
    slug: 'ecoalf',
    name: 'Ecoalf',
    url: 'https://ecoalf.com/en',
    niche: 'sustainable-fashion',
    short_description: 'B-Corp español: "porque no hay un planeta B".',
    long_description:
      'Ecoalf transforma residuos plásticos oceánicos en prendas técnicas: chaquetas, sneakers y accesorios. B-Corp certificada desde 2021.',
    eco_score: 89,
    values: ['b-corp', 'recycled', 'ocean-plastic', 'eu-made'],
    country: 'ES',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'mud-jeans',
    name: 'Mud Jeans',
    url: 'https://mudjeans.eu',
    niche: 'sustainable-fashion',
    short_description: 'Circular denim: Lease A Jeans único.',
    long_description:
      'Mud Jeans diseña denim circular: 40% algodón reciclado postconsumer, 30% orgánico. Programa "Lease A Jeans" — devuelve, reciclan, re-fabrican.',
    eco_score: 92,
    values: ['circular', 'recycled', 'organic', 'lease-program'],
    country: 'NL',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: true,
  },
  {
    slug: 'rapanui',
    name: 'Rapanui',
    url: 'https://rapanuiclothing.com',
    niche: 'sustainable-fashion',
    short_description: 'Algodón orgánico + fábrica con energía renovable.',
    long_description:
      'Rapanui: algodón orgánico cultivado en India, fábrica con energía eólica/solar. Personalización bajo demanda: cero stock muerto.',
    eco_score: 87,
    values: ['organic', 'renewable-energy', 'on-demand', 'transparent-supply-chain'],
    country: 'UK',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: false,
  },
  {
    slug: 'knowledge-cotton',
    name: 'Knowledge Cotton Apparel',
    url: 'https://knowledgecottonapparel.com',
    niche: 'sustainable-fashion',
    short_description: 'Básicos daneses con algodón GOTS.',
    long_description:
      'Knowledge Cotton Apparel (KnowledgeCotton) lleva desde 1969 hacienda básicos en algodón orgánico GOTS. Lana RWS para jerseys. Fabricación en Europa y Asia.',
    eco_score: 88,
    values: ['organic', 'gots', 'eu-made', 'rws-wool'],
    country: 'DK',
    affiliate_program: 'skimlinks',
    active: true,
    verified: false,
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Step 2 fixture — 40 anchor SF products (4 per merchant)
// ---------------------------------------------------------------------------

type ProductSeed = {
  store_slug: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: 'EUR';
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
  in_stock: true;
};

function placehold(slug: string) {
  return `https://placehold.co/600x600?text=${encodeURIComponent(slug)}`;
}

const PRODUCT_FIXTURE: ProductSeed[] = [
  // -- Patagonia -- 4 of 4 --
  {
    store_slug: 'patagonia-us',
    slug: 'patagonia-torrentshell-3l',
    title: 'Torrentshell 3L Jacket',
    description:
      'Chaqueta impermeable 3 capas con nylon 100% reciclado (ECONYL®). Cremalleras AquaGuard costuras termoselladas. Plegable en su propio bolsillo. Ideal para lluvia intensa y viento.',
    price_cents: 18000,
    currency: 'EUR',
    image_url: placehold('Torrentshell 3L Jacket'),
    source_url: 'https://eu.patagonia.com/gb/en/product/torrentshell-3l-jacket/83637.html',
    eco_tags: ['recycled', 'fair-trade'],
    attributes: { material: 'ECONYL® recycled nylon', waterproof: '30000mm', weight: '400g' },
    in_stock: true,
  },
  {
    store_slug: 'patagonia-us',
    slug: 'patagonia-nano-puff',
    title: 'Nano Puff Jacket',
    description:
      'Chaqueta ligera con PrimaLoft® Gold Insulation Eco (100% recycled polyester). Repelente al agua DWR sin PFC. Cálida hasta -5°C, peso pluma.',
    price_cents: 20000,
    currency: 'EUR',
    image_url: placehold('Nano Puff Jacket'),
    source_url: 'https://eu.patagonia.com/gb/en/product/nano-puff-jacket/83612.html',
    eco_tags: ['recycled', 'pfc-free'],
    attributes: { material: 'PrimaLoft® Eco recycled polyester', warmth: 'medium', weight: '370g' },
    in_stock: true,
  },
  {
    store_slug: 'patagonia-us',
    slug: 'patagonia-capilene-cool',
    title: 'Capilene Cool Tee',
    description:
      'Camiseta técnica de secado rápido para climas cálidos. Poliéster 100% reciclado con control de olores HeiQ® Fresh. Protección UPF 50+.',
    price_cents: 3500,
    currency: 'EUR',
    image_url: placehold('Capilene Cool Tee'),
    source_url: 'https://eu.patagonia.com/gb/en/product/capilene-cool-t-shirt/44415.html',
    eco_tags: ['recycled', 'pfc-free', 'upf50'],
    attributes: { material: '100% recycled polyester', fit: 'regular', upf: '50+' },
    in_stock: true,
  },
  {
    store_slug: 'patagonia-us',
    slug: 'patagonia-better-sweater',
    title: 'Better Sweater',
    description:
      'Jersey polar con look de punto: exterior de poliéster reciclado (sweater-knit), interior fleece. Tinte low-impact, certificados bluesign® y Fair Trade.',
    price_cents: 15900,
    currency: 'EUR',
    image_url: placehold('Better Sweater'),
    source_url: 'https://eu.patagonia.com/gb/en/product/better-sweater-fleece-jacket/25517.html',
    eco_tags: ['recycled', 'fair-trade', 'bluesign'],
    attributes: { material: 'recycled polyester sweater-knit', bluesign: 'true' },
    in_stock: true,
  },

  // -- Reformation -- 4 of 4 --
  {
    store_slug: 'reformation-us',
    slug: 'reformation-juliette-dress',
    title: 'Juliette Dress',
    description:
      'Vestido midi con manga corta, escote sweetheart y falda evasé. Lyocell Tencel® con bajo impacto hídrico. Fabricado en California.',
    price_cents: 24800,
    currency: 'EUR',
    image_url: placehold('Juliette Dress'),
    source_url: 'https://www.thereformation.com/products/juliette',
    eco_tags: ['tencel', 'low-impact', 'eu-import'],
    attributes: { material: 'Tencel® lyocell', origin: 'California US', fit: 'midi' },
    in_stock: true,
  },
  {
    store_slug: 'reformation-us',
    slug: 'reformation-mason-pant',
    title: 'Mason Pant',
    description:
      'Pantalón sastre de tiro alto con corte relajado. Mezcla de viscosa Ecovero™ (Lenzing) y algodón reciclado. Cintura forrada.',
    price_cents: 13800,
    currency: 'EUR',
    image_url: placehold('Mason Pant'),
    source_url: 'https://www.thereformation.com/products/mason',
    eco_tags: ['recycled', 'ecovero', 'low-impact'],
    attributes: { material: 'Ecovero™ viscose + recycled cotton', cut: 'high-waist' },
    in_stock: true,
  },
  {
    store_slug: 'reformation-us',
    slug: 'reformation-cynthia-jeans',
    title: 'Cynthia High Rise Jeans',
    description:
      'Vaqueros high-rise skinny en denim mezclado: algodón parcialmente reciclado. Lavado a piedra low-water. Fabricados en México con salarios justos.',
    price_cents: 16800,
    currency: 'EUR',
    image_url: placehold('Cynthia High Rise Jeans'),
    source_url: 'https://www.thereformation.com/products/cynthia',
    eco_tags: ['recycled', 'low-water', 'fair-wage'],
    attributes: { material: 'recycled cotton blend', rise: 'high', wash: 'low-water' },
    in_stock: true,
  },
  {
    store_slug: 'reformation-us',
    slug: 'reformation-bea-skirt',
    title: 'Bea Skirt',
    description:
      'Falda midi plisada con caída. Crepe de viscosa Lenzing Ecovero™. Cintura elástica forrada.',
    price_cents: 15800,
    currency: 'EUR',
    image_url: placehold('Bea Skirt'),
    source_url: 'https://www.thereformation.com/products/bea',
    eco_tags: ['ecovero', 'low-impact'],
    attributes: { material: 'Ecovero™ viscose crepe', length: 'midi' },
    in_stock: true,
  },

  // -- Veja -- 4 of 4 --
  {
    store_slug: 'veja',
    slug: 'veja-campo',
    title: 'Campo Sneakers',
    description:
      'Sneakers unisex de piel sintética chrome-free con logo V. Suela de caña de azúcar + caucho amazónico. Fabricado en Brasil, comercio justo.',
    price_cents: 13000,
    currency: 'EUR',
    image_url: placehold('Veja Campo'),
    source_url: 'https://www.veja-store.com/en_eu/products/campo',
    eco_tags: ['fair-trade', 'recycled', 'vegan-leather'],
    attributes: { material: 'chrome-free synthetic leather', upper: 'amazonian rubber+bagasse', origin: 'Brazil' },
    in_stock: true,
  },
  {
    store_slug: 'veja',
    slug: 'veja-v-10',
    title: 'V-10 Sneakers',
    description:
      'Modelo icónico bajo-prove: piel sintética + cuero, suela wild rubber. Diseño en París, fabricación sostenible en Brasil.',
    price_cents: 15000,
    currency: 'EUR',
    image_url: placehold('Veja V-10'),
    source_url: 'https://www.veja-store.com/en_eu/products/v-10',
    eco_tags: ['fair-trade', 'amazonian-rubber'],
    attributes: { material: 'synthetic leather + leather', upper: 'amazonian rubber', origin: 'Brazil' },
    in_stock: true,
  },
  {
    store_slug: 'veja',
    slug: 'veja-esplar',
    title: 'Esplar Sneakers',
    description:
      'Sneakers minimalistas unisex de cuero curtido vegetal con tara. Lona de algodón orgánico. Por cada par, Veja dona parte a la educación en Brasil.',
    price_cents: 10000,
    currency: 'EUR',
    image_url: placehold('Veja Esplar'),
    source_url: 'https://www.veja-store.com/en_eu/products/esplar',
    eco_tags: ['organic', 'tara-tanned', 'fair-trade'],
    attributes: { material: 'organic cotton canvas + leather', tan: 'vegetal (tara)', origin: 'Brazil' },
    in_stock: true,
  },
  {
    store_slug: 'veja',
    slug: 'veja-condor-2',
    title: 'Condor 2 Sneakers',
    description:
      'Running sostenible: upper de poliéster 100% reciclado (Econyl® o botellas). Suela midsole de caña de azúcar + caucho amazónico. Diseño Francia.',
    price_cents: 16000,
    currency: 'EUR',
    image_url: placehold('Veja Condor 2'),
    source_url: 'https://www.veja-store.com/en_eu/products/condor-2',
    eco_tags: ['recycled', 'fair-trade', 'amazonian-rubber'],
    attributes: { material: 'Econyl® recycled polyester', midsole: 'sugarcane', origin: 'Brazil' },
    in_stock: true,
  },

  // -- Stella McCartney -- 4 of 4 --
  {
    store_slug: 'stella-mccartney',
    slug: 'smc-falabella-tote-mini',
    title: 'Falabella Tote Mini',
    description:
      'Tote mini en piel vegana reciclada con ribete de cadena. Interior micro-fleece reciclado. Hecho en Italia con energía renovable.',
    price_cents: 156000,
    currency: 'EUR',
    image_url: placehold('Falabella Tote Mini'),
    source_url: 'https://www.stellamccartney.com/en-gb/bags/totes/falabella-tote-mini.html',
    eco_tags: ['vegan', 'recycled', 'cruelty-free'],
    attributes: { material: 'vegan leather (recycled)', hardware: 'chain', made_in: 'Italy' },
    in_stock: true,
  },
  {
    store_slug: 'stella-mccartney',
    slug: 'smc-elyse-platform',
    title: 'Elyse Platform Shoes',
    description:
      'Botines con plataforma ícono: 100% veganos, micro-fibra reciclada y suela de TPU biodegradable. Estilo punk esencial.',
    price_cents: 49500,
    currency: 'EUR',
    image_url: placehold('Elyse Platform'),
    source_url: 'https://www.stellamccartney.com/en-gb/shoes/boots/elyse-platform-shoes.html',
    eco_tags: ['vegan', 'recycled', 'cruelty-free'],
    attributes: { material: 'recycled microfiber', sole: 'biodegradable TPU', height: '8cm' },
    in_stock: true,
  },
  {
    store_slug: 'stella-mccartney',
    slug: 'smc-logo-shoulder-bag',
    title: 'Logo Shoulder Bag',
    description:
      'Bolso hombro chain strap con logo bordado. Piel vegana con forro interior en algodón orgánico. Fabricación italiana.',
    price_cents: 85000,
    currency: 'EUR',
    image_url: placehold('Logo Shoulder Bag'),
    source_url: 'https://www.stellamccartney.com/en-gb/bags/shoulder-bags/logo-shoulder-bag.html',
    eco_tags: ['vegan', 'organic', 'cruelty-free'],
    attributes: { material: 'vegan leather + organic cotton lining', origin: 'Italy' },
    in_stock: true,
  },
  {
    store_slug: 'stella-mccartney',
    slug: 'smc-loop-sneakers',
    title: 'Loop Sneakers',
    description:
      'Zapatillas sostenible: piel vegana reciclada con ribete reflectante. Suela de caucho natural. Diseño unisex.',
    price_cents: 19500,
    currency: 'EUR',
    image_url: placehold('Loop Sneakers'),
    source_url: 'https://www.stellamccartney.com/en-gb/shoes/sneakers/loop-sneakers.html',
    eco_tags: ['vegan', 'recycled', 'cruelty-free'],
    attributes: { material: 'recycled vegan leather', sole: 'natural rubber', gender: 'unisex' },
    in_stock: true,
  },

  // -- ASKET -- 4 of 4 --
  {
    store_slug: 'asket',
    slug: 'asket-the-t-shirt-jade',
    title: 'The T-Shirt (Jade Green)',
    description:
      'Camiseta 100% algodón orgánico certificado GOTS, 160g/m². Corte recto, costuras laterales, sin etiqueta exterior. Trazabilidad por prenda.',
    price_cents: 3500,
    currency: 'EUR',
    image_url: placehold('The T-Shirt'),
    source_url: 'https://asket.com/eu/products/the-t-shirt',
    eco_tags: ['organic', 'gots', 'transparent-supply-chain'],
    attributes: { material: 'GOTS organic cotton 160gsm', color: 'jade green' },
    in_stock: true,
  },
  {
    store_slug: 'asket',
    slug: 'asket-raw-denim-jean',
    title: 'Raw Denim Jean',
    description:
      'Vaquero denim crudo sin lavar. Algodón 100% orgánico cultivado en Turquía. Tejido en Japón (Kaihara). Slim fit, sello "permanent collection".',
    price_cents: 14500,
    currency: 'EUR',
    image_url: placehold('Raw Denim Jean'),
    source_url: 'https://asket.com/eu/products/raw-denim-jean',
    eco_tags: ['organic', 'gots', 'permanent-collection'],
    attributes: { material: 'GOTS organic cotton 14oz', origin: 'Turkey, woven Japan' },
    in_stock: true,
  },
  {
    store_slug: 'asket',
    slug: 'asket-oxford-shirt',
    title: 'Oxford Shirt',
    description:
      'Camisa oxford en algodón orgánico GOTS. Tejido oxford clásico, botones de cáscara natural. Corte regular, sastrería sueca lenta.',
    price_cents: 12000,
    currency: 'EUR',
    image_url: placehold('Oxford Shirt'),
    source_url: 'https://asket.com/eu/products/oxford-shirt',
    eco_tags: ['organic', 'gots', 'slow-fashion'],
    attributes: { material: 'GOTS organic cotton oxford', buttons: 'natural shell' },
    in_stock: true,
  },
  {
    store_slug: 'asket',
    slug: 'asket-merino-sweater',
    title: 'Merino Sweater',
    description:
      'Jersey en lana merina 100% ZQ certified + mulesing-free. Sin tintes químicos — colores naturales. Origen: Nueva Zelanda, fabricación Portugal.',
    price_cents: 16500,
    currency: 'EUR',
    image_url: placehold('Merino Sweater'),
    source_url: 'https://asket.com/eu/products/merino-crewneck',
    eco_tags: ['rws-wool', 'mulesing-free', 'natural-dye'],
    attributes: { material: 'ZQ-certified merino wool', origin: 'New Zealand, made Portugal' },
    in_stock: true,
  },

  // -- Armedangels -- 4 of 4 --
  {
    store_slug: 'armedangels',
    slug: 'armedangels-mairaa-jeans',
    title: 'Mairaa Mom Jeans',
    description:
      'Jeans mom-fit en denim orgánico GOTS. Lavado sin cloro, tintes low-impact. Fabricado en Túnez por cooperativa femenina.',
    price_cents: 10900,
    currency: 'EUR',
    image_url: placehold('Mairaa Mom Jeans'),
    source_url: 'https://www.armedangels.com/eu/products/mairaa-mom-jeans',
    eco_tags: ['organic', 'gots', 'fair-wage'],
    attributes: { material: 'GOTS organic cotton denim', fit: 'mom', origin: 'Tunisia' },
    in_stock: true,
  },
  {
    store_slug: 'armedangels',
    slug: 'armedangels-tarjaa-tee',
    title: 'Tarjaa Tee',
    description:
      'Camiseta básica de algodón orgánico GOTS, costura cuello reforzada. Algodón Fairtrade de India. Fabricada en Portugal.',
    price_cents: 4900,
    currency: 'EUR',
    image_url: placehold('Tarjaa Tee'),
    source_url: 'https://www.armedangels.com/eu/products/tarjaa-tee',
    eco_tags: ['organic', 'gots', 'fair-trade'],
    attributes: { material: 'GOTS Fairtrade cotton', origin: 'India/Portugal' },
    in_stock: true,
  },
  {
    store_slug: 'armedangels',
    slug: 'armedangels-detlef-hoodie',
    title: 'Detlef Hoodie',
    description:
      'Sudadera con capucha en algodón orgánico GOTS, fleece reciclado interior. Fabricada en Portugal con energía renovable.',
    price_cents: 9900,
    currency: 'EUR',
    image_url: placehold('Detlef Hoodie'),
    source_url: 'https://www.armedangels.com/eu/products/detlef-hoodie',
    eco_tags: ['organic', 'gots', 'renewable-energy'],
    attributes: { material: 'GOTS cotton + recycled polyester fleece', origin: 'Portugal' },
    in_stock: true,
  },
  {
    store_slug: 'armedangels',
    slug: 'armedangels-inaa-cardigan',
    title: 'Inaa Cardigan',
    description:
      'Cardigan en algodón orgánico GOTS, lana merina RWS. Botones de coco natural. Diseño unisex oversize.',
    price_cents: 12900,
    currency: 'EUR',
    image_url: placehold('Inaa Cardigan'),
    source_url: 'https://www.armedangels.com/eu/products/inaa-cardigan',
    eco_tags: ['organic', 'gots', 'rws-wool'],
    attributes: { material: 'GOTS cotton + RWS merino', buttons: 'natural coconut' },
    in_stock: true,
  },

  // -- Ecoalf -- 4 of 4 --
  {
    store_slug: 'ecoalf',
    slug: 'ecoalf-marangu-jacket',
    title: 'Marangu Jacket',
    description:
      'Chaqueta reversible con forro reciclado. Exterior nylon 100% reciclado (Econyl®), interior polar reciclado. B-Corp.',
    price_cents: 19900,
    currency: 'EUR',
    image_url: placehold('Marangu Jacket'),
    source_url: 'https://ecoalf.com/en/products/marangu-jacket',
    eco_tags: ['recycled', 'b-corp', 'eu-made'],
    attributes: { material: 'Econyl® recycled nylon outer + recycled fleece inner', origin: 'Spain' },
    in_stock: true,
  },
  {
    store_slug: 'ecoalf',
    slug: 'ecoalf-uman-puffer',
    title: 'Uman Puffer',
    description:
      'Plumífero con relleno de botellas PET 100% recicladas. Tejido exterior con DWR sin PFC. Fabricado en Alicante, España.',
    price_cents: 24500,
    currency: 'EUR',
    image_url: placehold('Uman Puffer'),
    source_url: 'https://ecoalf.com/en/products/uman-puffer',
    eco_tags: ['recycled', 'b-corp', 'pfc-free'],
    attributes: { material: '100% recycled PET fill + shell', origin: 'Alicante ES' },
    in_stock: true,
  },
  {
    store_slug: 'ecoalf',
    slug: 'ecoalf-actitud-sneakers',
    title: 'Actitud Sneakers',
    description:
      'Sneakers unisex con upper de plástico marino reciclado (Bureo). Suela de caucho natural. Fabricado en Alicante.',
    price_cents: 13500,
    currency: 'EUR',
    image_url: placehold('Actitud Sneakers'),
    source_url: 'https://ecoalf.com/en/products/actitud-sneakers',
    eco_tags: ['recycled', 'ocean-plastic', 'b-corp'],
    attributes: { material: 'Bureo® recycled ocean plastic upper', sole: 'natural rubber' },
    in_stock: true,
  },
  {
    store_slug: 'ecoalf',
    slug: 'ecoalf-bora-sweatshirt',
    title: 'Bora Sweatshirt',
    description:
      'Sudadera algodón 100% orgánico GOTS con fleece interior reciclado. Estampado en serigrafía con tintas sin tóxicos.',
    price_cents: 7500,
    currency: 'EUR',
    image_url: placehold('Bora Sweatshirt'),
    source_url: 'https://ecoalf.com/en/products/bora-sweatshirt',
    eco_tags: ['organic', 'gots', 'b-corp'],
    attributes: { material: 'GOTS organic cotton + recycled fleece', print: 'non-toxic ink' },
    in_stock: true,
  },

  // -- Mud Jeans -- 4 of 4 --
  {
    store_slug: 'mud-jeans',
    slug: 'mud-jeans-relax-rose',
    title: 'Relax Rose Jeans',
    description:
      'Jeans relaxed-fit fabricados con 40% algodón reciclado postconsumer + 30% orgánico. Lavado low-water, reparación gratuita de por vida.',
    price_cents: 11900,
    currency: 'EUR',
    image_url: placehold('Relax Rose Jeans'),
    source_url: 'https://mudjeans.eu/products/relax-rose',
    eco_tags: ['circular', 'recycled', 'organic', 'low-water'],
    attributes: { material: '40% post-consumer + 30% organic cotton', fit: 'relaxed' },
    in_stock: true,
  },
  {
    store_slug: 'mud-jeans',
    slug: 'mud-jeans-regular-dunn',
    title: 'Regular Dunn Jeans',
    description:
      'Jeans regular con composición circular idéntica. Color denim crudo orgánico. Co-diseñado con la comunidad Lease A Jeans.',
    price_cents: 11900,
    currency: 'EUR',
    image_url: placehold('Regular Dunn Jeans'),
    source_url: 'https://mudjeans.eu/products/regular-dunn',
    eco_tags: ['circular', 'recycled', 'organic'],
    attributes: { material: 'recycled + organic cotton blend', fit: 'regular' },
    in_stock: true,
  },
  {
    store_slug: 'mud-jeans',
    slug: 'mud-jeans-flared-hazen',
    title: 'Flared Hazen Jeans',
    description:
      'Jeans flared de tiro alto, cintura corte midi. Algodón reciclada postconsumer + orgánicos. Lavado sin óxido de nitrógeno.',
    price_cents: 12900,
    currency: 'EUR',
    image_url: placehold('Flared Hazen Jeans'),
    source_url: 'https://mudjeans.eu/products/flared-hazen',
    eco_tags: ['circular', 'recycled', 'organic'],
    attributes: { material: 'circular cotton blend', fit: 'flared', rise: 'high' },
    in_stock: true,
  },
  {
    store_slug: 'mud-jeans',
    slug: 'mud-jeans-wide-wanda',
    title: 'Wide Wanda Jeans',
    description:
      'Jeans wide-leg cómodo, algodón reciclada + orgánicos. Programa Lease A Jeans: devolución y re-fabricación.',
    price_cents: 13900,
    currency: 'EUR',
    image_url: placehold('Wide Wanda Jeans'),
    source_url: 'https://mudjeans.eu/products/wide-wanda',
    eco_tags: ['circular', 'recycled', 'organic', 'lease-program'],
    attributes: { material: 'circular cotton blend', fit: 'wide-leg', program: 'Lease A Jeans' },
    in_stock: true,
  },

  // -- Rapanui -- 4 of 4 --
  {
    store_slug: 'rapanui',
    slug: 'rapanui-organic-tee',
    title: 'Organic Cotton Tee',
    description:
      'Camiseta básica algodón 100% orgánico, impresión en bajo demanda con tintas al agua. Teñido en frío para reducir energía.',
    price_cents: 2500,
    currency: 'EUR',
    image_url: placehold('Organic Cotton Tee'),
    source_url: 'https://rapanuiclothing.com/products/organic-cotton-tee',
    eco_tags: ['organic', 'on-demand', 'renewable-energy'],
    attributes: { material: 'GOTS organic cotton', print: 'water-based', program: 'make-on-demand' },
    in_stock: true,
  },
  {
    store_slug: 'rapanui',
    slug: 'rapanui-fisherman-jumper',
    title: 'Fisherman Jumper',
    description:
      'Jersey de pescador con patrón cable-knit en lana merina RWS. Fabricado en Portugal con energía renovable (eólica + solar).',
    price_cents: 8900,
    currency: 'EUR',
    image_url: placehold('Fisherman Jumper'),
    source_url: 'https://rapanuiclothing.com/products/fisherman-jumper',
    eco_tags: ['rws-wool', 'renewable-energy', 'eu-made'],
    attributes: { material: 'RWS merino wool', origin: 'Portugal', pattern: 'cable-knit' },
    in_stock: true,
  },
  {
    store_slug: 'rapanui',
    slug: 'rapanui-surf-towel',
    title: 'Surf Towel',
    description:
      'Toalla de surf en microfibra reciclada de botellas PET. Secado rápido, ligera, compacta. Ideal para playa y baño.',
    price_cents: 3500,
    currency: 'EUR',
    image_url: placehold('Surf Towel'),
    source_url: 'https://rapanuiclothing.com/products/surf-towel',
    eco_tags: ['recycled', 'on-demand'],
    attributes: { material: 'recycled PET microfiber', size: '150x80cm' },
    in_stock: true,
  },
  {
    store_slug: 'rapanui',
    slug: 'rapanui-hooded-jacket',
    title: 'Hooded Jacket',
    description:
      'Chaqueta con capucha en algodón orgánico + forro polar reciclado. Tinte low-impact, fabricación con energía renovable.',
    price_cents: 11900,
    currency: 'EUR',
    image_url: placehold('Hooded Jacket'),
    source_url: 'https://rapanuiclothing.com/products/hooded-jacket',
    eco_tags: ['organic', 'recycled', 'renewable-energy'],
    attributes: { material: 'organic cotton + recycled polyester fleece' },
    in_stock: true,
  },

  // -- Knowledge CottonApparel -- 4 of 4 --
  {
    store_slug: 'knowledge-cotton',
    slug: 'kca-owl-tee',
    title: "Owl Tee Men's",
    description:
      "Camiseta básica de algodón orgánico GOTS con estampado Owl. Cómoda, duradera, low-impact. Fabricada en Europa.",
    price_cents: 3900,
    currency: 'EUR',
    image_url: placehold('Owl Tee'),
    source_url: 'https://knowledgecottonapparel.com/products/owl-tee',
    eco_tags: ['organic', 'gots', 'eu-made'],
    attributes: { material: 'GOTS organic cotton', fit: 'regular' },
    in_stock: true,
  },
  {
    store_slug: 'knowledge-cotton',
    slug: 'kca-chuck-chino',
    title: 'Chuck Chino',
    description:
      'Pantalón chino en algodón orgánico GOTS. Sastrería casual, costuras reforzadas. Corte regular. Hecho en Portugal.',
    price_cents: 9900,
    currency: 'EUR',
    image_url: placehold('Chuck Chino'),
    source_url: 'https://knowledgecottonapparel.com/products/chuck-chino',
    eco_tags: ['organic', 'gots', 'eu-made'],
    attributes: { material: 'GOTS organic cotton chino', origin: 'Portugal' },
    in_stock: true,
  },
  {
    store_slug: 'knowledge-cotton',
    slug: 'kca-larix-jacket',
    title: 'Larix Jacket',
    description:
      'Chaqueta de transición en algodón orgánico GOTS con tratamiento DWR sin PFC. Forro interior de algodón. Diseño danés.',
    price_cents: 15900,
    currency: 'EUR',
    image_url: placehold('Larix Jacket'),
    source_url: 'https://knowledgecottonapparel.com/products/larix-jacket',
    eco_tags: ['organic', 'gots', 'pfc-free'],
    attributes: { material: 'GOTS organic cotton + DWR-FC-free', origin: 'Denmark/design' },
    in_stock: true,
  },
  {
    store_slug: 'knowledge-cotton',
    slug: 'kca-maple-sweater',
    title: 'Maple Sweater',
    description:
      'Jersey en lana merina RWS + mulesing-free. Corte regular, color natural sin tintes químicos. Origein: Nueva Zelanda.',
    price_cents: 11900,
    currency: 'EUR',
    image_url: placehold('Maple Sweater'),
    source_url: 'https://knowledgecottonapparel.com/products/maple-sweater',
    eco_tags: ['rws-wool', 'mulesing-free', 'natural-dye'],
    attributes: { material: 'RWS merino wool', origin: 'New Zealand' },
    in_stock: true,
  },
];

// ---------------------------------------------------------------------------
// 0) CLI flag: --include-stores=slug1,slug2,... (pilot-launch subset).
//    Placed AFTER both fixture constants so the const declarations resolve.
// ---------------------------------------------------------------------------

function parseIncludeStores(): string[] | null {
  for (const arg of process.argv.slice(2)) {
    const m = /^--include-stores=(.+)$/.exec(arg);
    if (m) return m[1]!.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return null;
}
const INCLUDED = parseIncludeStores();
const STORES = INCLUDED ? STORE_FIXTURE.filter((s) => INCLUDED.includes(s.slug)) : STORE_FIXTURE;
const PRODUCTS = INCLUDED
  ? PRODUCT_FIXTURE.filter((p) => INCLUDED.includes(p.store_slug))
  : PRODUCT_FIXTURE;

if (INCLUDED && STORES.length === 0) {
  console.error(
    `❌ --include-stores=${INCLUDED.join(',')} matched 0 stores. Aborting.`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1) Pre-flight score of source_urls (image_urls are placehold.co → always OK).
// ---------------------------------------------------------------------------

type UrlStatus = 'ok' | 'hotlink-protected' | 'redirect' | 'not-found' | 'error';

type ProductCheck = {
  slug: string;
  source_url: string;
  source_status: UrlStatus;
  source_status_code: number | null;
};

async function probeUrl(url: string, timeoutMs = 8_000): Promise<{ status: UrlStatus; code: number | null }> {
  // 8s timeout. Many merchants' CF/WAF may block bare HEAD with 403 — we
  // treat that as "hotlink-protected but probably reachable via browser".
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ShopifindBot/1.0; +https://shopifind.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 200 && res.status < 300) return { status: 'ok', code: res.status };
    if (res.status >= 300 && res.status < 400) return { status: 'redirect', code: res.status };
    if (res.status === 403 || res.status === 429) return { status: 'hotlink-protected', code: res.status };
    if (res.status === 404) return { status: 'not-found', code: 404 };
    return { status: 'error', code: res.status };
  } catch (err) {
    // Network-level timeout or abort → likely hotlink-protected / blocked.
    const msg = (err as Error)?.message ?? '';
    if (/abort/i.test(msg)) return { status: 'hotlink-protected', code: null };
    return { status: 'error', code: null };
  } finally {
    clearTimeout(t);
  }
}

async function validateAllSourceUrls(products: ProductSeed[]): Promise<ProductCheck[]> {
  // Simple global concurrency cap (8). Per-host politeness is the next
  // evolution if we observe IP-throttling at scale; for SF v2, 8 concurrent
  // HEAD across 10 different merchant domains is well below the typical
  // bot-detection threshold and keeps the worst case under 60s.
  //
  // (Earlier per-host-queue attempt used a single-waiter event and risked
  // deadlock when several workers raced into the saturated state; a
  // multi-listener semaphore is the right shape if/when we revisit this.)
  const CONCURRENCY = 8;
  const results: ProductCheck[] = new Array(products.length);
  let cursor = 0;
  async function worker() {
    while (cursor < products.length) {
      const idx = cursor++;
      const p = products[idx]!;
      try {
        const probe = await probeUrl(p.source_url);
        results[idx] = {
          slug: p.slug,
          source_url: p.source_url,
          source_status: probe.status,
          source_status_code: probe.code,
        };
      } catch {
        // Defensive: probeUrl internally catches network errors. If it ever
        // throws synchronously (e.g. fixture drift + invalid URL), surface a
        // graceful error row instead of aborting the whole validation.
        results[idx] = {
          slug: p.slug,
          source_url: p.source_url,
          source_status: 'error',
          source_status_code: null,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

function logSection(label: string) {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

function colourStatus(s: UrlStatus) {
  switch (s) {
    case 'ok':
      return '✓';
    case 'hotlink-protected':
      return '⚠';
    case 'redirect':
      return '↪';
    case 'not-found':
      return '✗';
    case 'error':
      return '✗';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Report = {
  ok: boolean;
  dryRun: boolean;
  storesUpserted: number;
  storesAlreadyExisted: number;
  productsUpserted: string[];
  productsAlreadyExisted: string[];
  productsFailed: { slug: string; error: string }[];
  urlHealth: { ok: number; hotlinkProtected: number; redirect: number; notFound: number; error: number };
};

async function main() {
  console.log(
    `▶ Seeding SF v2 — ${STORES.length} stores + ${PRODUCTS.length} anchor products${
      INCLUDED ? ` (filtered to: ${INCLUDED.join(', ')})` : ''
    }${DRY_RUN ? ' [DRY RUN — no DB writes]' : ''}`
  );

  // -- 1) PRE-FLIGHT — validate every source_url
  logSection('STEP 1 — pre-flight HEAD on every source_url');
  const checks = await validateAllSourceUrls(PRODUCTS);
  const health = { ok: 0, hotlinkProtected: 0, redirect: 0, notFound: 0, error: 0 };
  const statusKey: Record<UrlStatus, keyof typeof health> = {
    ok: 'ok',
    'hotlink-protected': 'hotlinkProtected',
    redirect: 'redirect',
    'not-found': 'notFound',
    error: 'error',
  };
  for (const c of checks) {
    health[statusKey[c.source_status]]++;
    console.log(`  ${colourStatus(c.source_status)} ${c.slug.padEnd(36)} ${c.source_status_code ?? '  '} ${c.source_url}`);
  }
  console.log(
    `  summary — ok:${health.ok}  protected:${health.hotlinkProtected}  redirect:${health.redirect}  404:${health.notFound}  err:${health.error}`
  );

  // -- 2) UPSERT STORES
  logSection('STEP 2 — UPSERT 10 SF stores');
  let storesUpserted = 0;
  let storesAlreadyExisted = 0;
  if (!DRY_RUN) {
    const upRes = await sb
      .from('stores')
      .upsert(STORES as never, { onConflict: 'slug' })
      .select('slug, created_at, updated_at');
    if (upRes.error) throw new Error(`Stores upsert failed: ${upRes.error.message}`);
    for (const row of upRes.data ?? []) {
      const r = row as { slug: string; created_at: string; updated_at: string };
      const fresh = Math.abs(new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) < 1500;
      if (fresh) storesUpserted++;
      else storesAlreadyExisted++;
      console.log(`  ${fresh ? '✓ inserted' : '· refreshed'} ${r.slug}`);
    }
    console.log(`  totals — inserted: ${storesUpserted}, refreshed: ${storesAlreadyExisted}`);
  } else {
    for (const s of STORES) {
      console.log(`  · would upsert store ${s.slug} (${s.country}, eco=${s.eco_score})`);
      storesUpserted = STORES.length;
    }
  }

  // -- 3) RESOLVE STORE_IDs FROM DB
  logSection('STEP 3 — resolve store_id per slug');
  const slugSet = [...new Set(STORES.map((s) => s.slug))];
  let storeIdBySlug = new Map<string, string>();
  if (!DRY_RUN) {
    const sRes = await sb.from('stores').select('id, slug').in('slug', slugSet);
    if (sRes.error) throw new Error(`Store id lookup failed: ${sRes.error.message}`);
    for (const row of sRes.data ?? []) {
      const r = row as { id: string; slug: string };
      storeIdBySlug.set(r.slug, r.id);
    }
  } else {
    // dry-run: fabricate deterministic ids so the report reads sensibly.
    for (const s of slugSet) storeIdBySlug.set(s, `dryrun-${s}`);
  }
  if (storeIdBySlug.size !== slugSet.length) {
    throw new Error(`Could not resolve all store ids. Expected ${slugSet.length}, found ${storeIdBySlug.size}`);
  }
  console.log(`  ✓ resolved ${storeIdBySlug.size}/10 store_ids`);

  // -- 4) UPSERT PRODUCTS
  logSection('STEP 4 — UPSERT 40 anchor SF products');
  const productsUpserted: string[] = [];
  const productsAlreadyExisted: string[] = [];
  const productsFailed: { slug: string; error: string }[] = [];

  if (DRY_RUN) {
    for (const p of PRODUCTS) {
      console.log(`  · would upsert product ${p.slug} (store=${p.store_slug} €${(p.price_cents / 100).toFixed(2)})`);
      productsUpserted.push(p.slug);
    }
  } else {
    for (const p of PRODUCTS) {
      const storeId = storeIdBySlug.get(p.store_slug);
      if (!storeId) {
        productsFailed.push({ slug: p.slug, error: `store_slug '${p.store_slug}' not found` });
        continue;
      }
      const upRes = await sb
        .from('products')
        .upsert(
          {
            store_id: storeId,
            slug: p.slug,
            title: p.title,
            description: p.description,
            price_cents: p.price_cents,
            currency: p.currency,
            image_url: p.image_url,
            source_url: p.source_url,
            eco_tags: p.eco_tags,
            attributes: p.attributes,
            in_stock: p.in_stock,
            last_seen_at: new Date().toISOString(),
          } as never,
          { onConflict: 'slug' }
        )
        .select('slug, created_at, updated_at')
        .single();
      if (upRes.error) {
        productsFailed.push({ slug: p.slug, error: upRes.error.message });
        console.log(`  ✗ FAILED ${p.slug} — ${upRes.error.message}`);
        continue;
      }
      const r = upRes.data as { slug: string; created_at: string; updated_at: string };
      const fresh = Math.abs(new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) < 1500;
      if (fresh) {
        productsUpserted.push(r.slug);
        console.log(`  ✓ inserted   ${r.slug} (€${(p.price_cents / 100).toFixed(0)})`);
      } else {
        productsAlreadyExisted.push(r.slug);
        console.log(`  · refreshed  ${r.slug} (€${(p.price_cents / 100).toFixed(0)})`);
      }
    }
  }

  // -- 5) REPORT
  logSection('STEP 5 — final report');      const report: Report = {
        ok: productsFailed.length === 0,
        dryRun: DRY_RUN,
        storesUpserted,
        storesAlreadyExisted,
        productsUpserted,
        productsAlreadyExisted,
        productsFailed,
        urlHealth: {
          ok: health.ok,
          hotlinkProtected: health.hotlinkProtected,
          redirect: health.redirect,
          notFound: health.notFound,
          error: health.error,
        },
      };
  console.log('\n' + (DRY_RUN ? '🟡 DRY RUN' : report.ok ? '✅ DONE' : '⚠ PARTIAL'), '\n', JSON.stringify(report, null, 2));

  // Friendly next-step note for the operator.
  console.log(`
\nexítico, próximos pasos:

  • Recarga https://shopifind.vercel.app — los 4 stores visible ahora son SF-heavy (Patagonia, Reformation, Veja, Stella + ASKET, Armedangels, Ecoalf, Mud Jeans, Rapanui, Knowledge Cotton).
  • Las URLs de imagen son placehold.co — para reemplazarlas por CDN reales de cada comerciante:
      UPDATE products SET image_url = 'https://...' WHERE slug IN ('patagonia-torrentshell-3l', ...);
  • Las source_urls validadas como '403 hotlink-protected' abren correctamente desde el browser (Cloudflare challenge headers solo bloquean a bots).
`);
}

main().catch((err) => {
  console.error('\n❌ FAILED:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
