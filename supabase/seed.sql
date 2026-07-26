-- ============================================================================
-- Shopifind — Seed data for MVP testing.
-- Insert 3 illustrative stores + 6 products covering the 3 niches.
-- Run AFTER schema.sql. SAFE to run multiple times.
-- ============================================================================

INSERT INTO stores (slug, name, url, niche, logo_url, short_description, eco_score, values, country, active, verified, featured) VALUES
  ('everlane-eu', 'Everlane EU', 'https://www.everlane.com', 'sustainable-fashion', NULL, 'Ropa ética con materiales reciclados.', 78, ARRAY['recycled','transparent-pricing','eu-shipped'], 'US', TRUE, TRUE, FALSE),
  ('b-corp-outfitters', 'B-Corp Outfitters', 'https://b-corp-outfitters.example.com', 'sustainable-fashion', NULL, 'Outfitters certificados B-Corp, fabricados en Portugal.', 92, ARRAY['b-corp','eu-made','female-founded'], 'PT', TRUE, TRUE, TRUE),
  ('killiney-audio', 'Killiney Audio', 'https://killiney-audio.example.com', 'indie-gadgets', NULL, 'Auriculares y DACs de un fabricante irlandés.', 65, ARRAY['eu-made','repairable'], 'IE', TRUE, TRUE, FALSE),
  ('gridloom', 'GridLoom', 'https://gridloom.example.com', 'indie-gadgets', NULL, 'Organizadores modulares de escritorio, impresos en PLA reciclado.', 81, ARRAY['recycled','small-batch'], 'NL', TRUE, TRUE, FALSE),
  ('casa-vereda', 'Casa Vereda', 'https://casavereda.example.com', 'home-deco', NULL, 'Textilesartesanales y cerámica de Andalucía.', 88, ARRAY['handmade','eu-made','traditional-craft'], 'ES', TRUE, TRUE, TRUE),
  ('nordic-folk', 'Nordic Folk', 'https://nordicfolk.example.com', 'home-deco', NULL, 'Muebles de roble macizo de carpinteros finlandeses.', 84, ARRAY['eu-made','solid-wood'], 'FI', TRUE, TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- Products (illustrative)
INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'everlane-renewed-tote',
  'Renewed Tote — recycled cotton',
  'Tote bag hecho de algodón 100% reciclado. Capacidad 18L.',
  8900,
  'EUR',
  'https://placehold.co/600x600?text=Renewed+Tote',
  'https://www.everlane.com/products/renewed-tote',
  ARRAY['recycled','cotton'],
  '{"material":"recycled cotton","capacity_l":18}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'everlane-eu'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'bcorp-porto-tee',
  'Porto Tee — orgánico unisex',
  'Camiseta unisex en algodón orgánico, fabricada en Porto.',
  4500,
  'EUR',
  'https://placehold.co/600x600?text=Porto+Tee',
  'https://b-corp-outfitters.example.com/products/porto-tee',
  ARRAY['organic','eu-made','fair-wage'],
  '{"material":"organic cotton","origin":"Porto, PT"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'b-corp-outfitters'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'killiney-k3-pro',
  'K3 Pro — auriculares over-ear',
  'Drivers de 50mm, diadema reparable, acabados en aluminio.',
  19900,
  'EUR',
  'https://placehold.co/600x600?text=K3+Pro',
  'https://killiney-audio.example.com/products/k3-pro',
  ARRAY['repairable','eu-made'],
  '{"driver_mm":50,"warranty_years":5}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'killiney-audio'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'gridloom-board-12',
  'GridBoard 12 — organizador modular',
  '12 slots configurables; PLA reciclado; fabricado en Rotterdam.',
  5900,
  'EUR',
  'https://placehold.co/600x600?text=GridBoard+12',
  'https://gridloom.example.com/products/gridboard-12',
  ARRAY['recycled','small-batch','eu-made'],
  '{"material":"recycled PLA","slots":12}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'gridloom'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'casa-vereda-alfombra-zellige',
  'Alfombra Zellige — 140x200',
  'Tejida a mano en Granada con lana merina local.',
  28500,
  'EUR',
  'https://placehold.co/600x600?text=Zellige',
  'https://casavereda.example.com/products/alfombra-zellige',
  ARRAY['handmade','wool','eu-made','traditional-craft'],
  '{"material":"merino wool","origin":"Granada, ES","cm":"140x200"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'casa-vereda'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'nordic-folk-aalto-chair',
  'Aalto Chair — roble macizo',
  'Silla ergonómica tallada en roble sostenible finlandés.',
  42000,
  'EUR',
  'https://placehold.co/600x600?text=Aalto+Chair',
  'https://nordicfolk.example.com/products/aalto-chair',
  ARRAY['solid-wood','eu-made','repairable'],
  '{"material":"oak","origin":"Lahti, FI"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'nordic-folk'
ON CONFLICT (slug) DO NOTHING;

-- Tag featured products in stores
UPDATE stores SET featured = TRUE WHERE slug IN ('b-corp-outfitters','casa-vereda');

-- ============================================================================
-- Additional sustainable-fashion products (for the launch editorial collection
-- 'ethical-staples'). Run AFTER the products above; these 4 complete a curated
-- capsule of 6 items spanning price and material diversity.
-- ============================================================================

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'everlane-organic-crew-tee',
  'Organic Crew Tee — GOTS cotton',
  'Camiseta clásica en algodón 100% orgánico certificado GOTS, corte relajado y costuras laterales.',
  3500,
  'EUR',
  'https://placehold.co/600x600?text=Organic+Crew+Tee',
  'https://www.everlane.com/products/organic-crew-tee',
  ARRAY['organic','cotton','transparent-pricing'],
  '{"material":"GOTS organic cotton","fit":"relaxed"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'everlane-eu'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'everlane-renylon-puffer',
  'ReNylon Puffer — recycled nylon',
  'Chaqueta térmica con relleno de nylon 100% reciclado, costuras termoselladas. Cálida hasta -5°C.',
  15000,
  'EUR',
  'https://placehold.co/600x600?text=ReNylon+Puffer',
  'https://www.everlane.com/products/renylon-puffer',
  ARRAY['recycled','transparent-pricing'],
  '{"material":"recycled nylon","warmth":"heavy"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'everlane-eu'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'bcorp-lisbon-cardigan',
  'Lisbon Cardigan — recycled wool',
  'Cardigan en lana reciclada, tejido en Lisboa por cooperativa femenina. Lavar a mano en agua fría.',
  9500,
  'EUR',
  'https://placehold.co/600x600?text=Lisbon+Cardigan',
  'https://b-corp-outfitters.example.com/products/lisbon-cardigan',
  ARRAY['recycled','eu-made','female-founded'],
  '{"material":"recycled wool","origin":"Lisboa, PT"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'b-corp-outfitters'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (store_id, slug, title, description, price_cents, currency, image_url, source_url, eco_tags, attributes, in_stock)
SELECT
  s.id,
  'bcorp-alentejo-dress',
  'Alentejo Midi Dress — European linen',
  'Vestido midi en lino europeo de cultivo orgánico, tejido en Alentejo. Recomendado para climas secos; lavar en frío.',
  14500,
  'EUR',
  'https://placehold.co/600x600?text=Alentejo+Dress',
  'https://b-corp-outfitters.example.com/products/alentejo-dress',
  ARRAY['organic','eu-made','fair-wage','female-founded'],
  '{"material":"European linen","origin":"Alentejo, PT"}'::jsonb,
  TRUE
FROM stores s WHERE s.slug = 'b-corp-outfitters'
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Launch editorial collection: 'ethical-staples' (6 sustainable-fashion items).
-- Idempotent: re-running the seed replaces the row by slug and reorders the
-- product_ids array to match the curated order below. Same narrative source
-- lives in scripts/seed-editorial-collection.ts (CLI entry point).
--
-- Strict-mode guard: the SELECT requires ALL 6 curated slugs to exist in
-- `products` (via AND/EXISTS subqueries); if any is missing, the SELECT returns
-- 0 rows and the INSERT becomes a no-op. Prevents a silently-broken <6-item
-- partial collection from being published if the four new SF products above
-- were not applied.
-- ============================================================================

INSERT INTO editorial_collections (slug, title, subtitle, description, cover_image_url, niche, product_ids, published, published_at)
SELECT
  'ethical-staples',
  'Ethical Staples — fondo de armario ético',
  '6 básicos en algodón orgánico y materiales reciclados, fabricados bajo estándares justos.',
  'Cápsula curada para iniciar tu armario ético: dos camisetas básicas en algodón orgánico, un tote reciclado, un jersey cálido en lana reciclada, una chaqueta térmica en nylon reciclado y un vestido midi en lino europeo de cultivo orgánico. Todas las marcas tienen programas de afiliación activos, transparencia verificable y fabricación europea o de proximidad.',
  'https://placehold.co/1200x630?text=Ethical+Staples',
  'sustainable-fashion',
  COALESCE(array_agg(p.id ORDER BY array_position(
    ARRAY['everlane-renewed-tote','everlane-organic-crew-tee','everlane-renylon-puffer','bcorp-porto-tee','bcorp-lisbon-cardigan','bcorp-alentejo-dress'],
    p.slug
  )) FILTER (WHERE p.slug IN (
    'everlane-renewed-tote','everlane-organic-crew-tee','everlane-renylon-puffer','bcorp-porto-tee','bcorp-lisbon-cardigan','bcorp-alentejo-dress'
  )),
  '{}'::uuid[]),
  TRUE,
  NOW()
FROM products p
WHERE p.slug IN (
    'everlane-renewed-tote','everlane-organic-crew-tee','everlane-renylon-puffer','bcorp-porto-tee','bcorp-lisbon-cardigan','bcorp-alentejo-dress'
  )
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'everlane-renewed-tote')
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'everlane-organic-crew-tee')
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'everlane-renylon-puffer')
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'bcorp-porto-tee')
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'bcorp-lisbon-cardigan')
  AND EXISTS (SELECT 1 FROM products WHERE slug = 'bcorp-alentejo-dress')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  cover_image_url = EXCLUDED.cover_image_url,
  niche = EXCLUDED.niche,
  product_ids = EXCLUDED.product_ids,
  published = EXCLUDED.published,
  published_at = COALESCE(editorial_collections.published_at, EXCLUDED.published_at);
