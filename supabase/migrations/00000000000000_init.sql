-- ============================================================================
-- Shopifind — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL > New Query).
-- Idempotent: SAFE to run multiple times.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM: plans
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE user_plan AS ENUM ('free', 'plus', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- USERS (profile data, FK to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  plan user_plan DEFAULT 'free',
  niche_prefs TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user profile when someone signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- NICHES (the 3-MVP verticals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS niches (
  id TEXT PRIMARY KEY,           -- 'sustainable-fashion', 'indie-gadgets', 'home-deco'
  label TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO niches (id, label, description, emoji, display_order) VALUES
  ('sustainable-fashion', 'Moda sostenible', 'Marcas D2C, fabricación ética, materiales responsables.', '👗', 1),
  ('indie-gadgets',       'Gadgets indie',   'Pequeños fabricantes de accesorios tech, productividad y audio.', '🎛️', 2),
  ('home-deco',           'Deco & hogar',     'Decoración artesanal, muebles de marcas independientes, textiles.', '🏠', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORES
-- ============================================================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  niche TEXT NOT NULL REFERENCES niches(id) ON UPDATE CASCADE,
  logo_url TEXT,
  short_description TEXT,
  long_description TEXT,
  eco_score INT DEFAULT 0 CHECK (eco_score BETWEEN 0 AND 100),
  values TEXT[] DEFAULT '{}',                 -- ['vegan','female-founded','eu-made','b-corp']
  country TEXT,
  affiliate_program TEXT DEFAULT 'skimlinks', -- 'skimlinks' | 'direct' | 'awin'
  affiliate_id TEXT,                          -- ID del programa cuando es directo
  feed_source TEXT,                           -- 'csv' | 'rss' | 'api' | 'manual'
  active BOOLEAN DEFAULT FALSE,               -- manual moderation gate
  verified BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_niche ON stores(niche) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_featured ON stores(featured) WHERE featured = TRUE;

-- ============================================================================
-- CATEGORIES (per-niche)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,           -- 'sustainable-fashion-dresses', etc.
  niche TEXT NOT NULL REFERENCES niches(id) ON UPDATE CASCADE,
  label TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  display_order INT DEFAULT 0
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  image_url TEXT NOT NULL,
  source_url TEXT NOT NULL,      -- original URL on store
  affiliate_url TEXT,            -- sk-gen injected URL (resolved server-side via /go/[id])
  category_id TEXT REFERENCES categories(id),
  attributes JSONB DEFAULT '{}'::jsonb,  -- {color, size, material, ...}
  eco_tags TEXT[] DEFAULT '{}',
  in_stock BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(in_stock) WHERE in_stock = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_text ON products USING GIN (
  (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')))
);
CREATE INDEX IF NOT EXISTS idx_products_eco_tags ON products USING GIN (eco_tags);
CREATE INDEX IF NOT EXISTS idx_products_store_feed ON products(store_id, in_stock, updated_at DESC);

-- ============================================================================
-- WISHLISTS — JSONB for MVP (migrate to relational table at >10k users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wishlists (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items JSONB DEFAULT '[]'::jsonb,  -- [{ product_id, store_url, price_when_added, notify }]
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SEARCH HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  filters JSONB,
  results_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);

-- ============================================================================
-- EDITORIAL COLLECTIONS (SEO curated lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS editorial_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_image_url TEXT,
  niche TEXT REFERENCES niches(id),
  product_ids UUID[] DEFAULT '{}',
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['users','stores','products','wishlists','editorial_collections']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Users: read own + public metadata for editorial (e.g., author of collection)
DROP POLICY IF EXISTS "users_self_read" ON users;
CREATE POLICY "users_self_read" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_self_update" ON users;
CREATE POLICY "users_self_update" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Wishlists: only the owner can read/write
DROP POLICY IF EXISTS "wishlists_owner_all" ON wishlists;
CREATE POLICY "wishlists_owner_all" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- Search history: only the owner can write; admins can read
DROP POLICY IF EXISTS "search_history_owner_write" ON search_history;
CREATE POLICY "search_history_owner_write" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "search_history_owner_read" ON search_history;
CREATE POLICY "search_history_owner_read" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

-- Public read on stores / products / niches / categories / editorial_collections
-- These are PUBLIC data, so RLS reads are open (writes blocked by RLS = no anon writes).
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_stores" ON stores;
CREATE POLICY "public_read_stores" ON stores FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT USING (in_stock = TRUE);

DROP POLICY IF EXISTS "public_read_niches" ON niches;
CREATE POLICY "public_read_niches" ON niches FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_read_collections" ON editorial_collections;
CREATE POLICY "public_read_collections" ON editorial_collections FOR SELECT USING (published = TRUE);

-- ============================================================================
-- Useful views
-- ============================================================================
-- v_products_with_store: enriched product rows with the store columns the
-- frontend actually reads (country, short_description, verified, niche...).
-- We avoid pulling all of stores to keep the payload small.
CREATE OR REPLACE VIEW v_products_with_store AS
SELECT
  p.id,
  p.store_id,
  p.slug,
  p.title,
  p.description,
  p.price_cents,
  p.currency,
  p.image_url,
  p.source_url,
  p.affiliate_url,
  p.category_id,
  p.attributes,
  p.eco_tags,
  p.in_stock,
  p.last_seen_at,
  p.created_at,
  p.updated_at,
  s.name        AS store_name,
  s.slug        AS store_slug,
  s.niche       AS niche,
  s.country     AS country,
  s.eco_score   AS store_eco_score,
  s.values      AS store_values,
  s.featured    AS store_featured,
  s.verified    AS verified,
  s.short_description AS short_description
FROM products p
JOIN stores s ON s.id = p.store_id
WHERE p.in_stock = TRUE AND s.active = TRUE;

-- ============================================================================
-- Done.
-- ============================================================================
