-- ============================================================================
-- Shopifind — Click attribution (Skimlinks webhook target).
-- Run AFTER 00000000000000_init.sql. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS click_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xcust TEXT NOT NULL,
  product_slug TEXT,
  source_url TEXT,
  merchant_id TEXT,
  intent TEXT NOT NULL CHECK (intent IN ('visit', 'buys')),
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  commission_cents INT,
  country_code TEXT,
  ip_hash TEXT,
  raw_payload JSONB NOT NULL,
  payload_timestamp TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL
);

-- Dedupe: Skimlinks may retry the same event. Unique canonical triple.
CREATE UNIQUE INDEX IF NOT EXISTS idx_click_attr_dedupe
  ON click_attribution(xcust, intent, payload_timestamp);

CREATE INDEX IF NOT EXISTS idx_click_attr_paid_at
  ON click_attribution(paid_at DESC) WHERE paid = TRUE;

CREATE INDEX IF NOT EXISTS idx_click_attr_product
  ON click_attribution(product_id) WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_click_attr_slug
  ON click_attribution(product_slug) WHERE product_slug IS NOT NULL;

ALTER TABLE click_attribution ENABLE ROW LEVEL SECURITY;

-- Admin-only read (staff / analytics dashboards). Server actions use service-role
-- key (bypasses RLS). Authenticated users see nothing.
DROP POLICY IF EXISTS "click_attribution_admin_read" ON click_attribution;
CREATE POLICY "click_attribution_admin_read" ON click_attribution
  FOR SELECT USING (auth.jwt() -> 'app_metadata' ? 'admin');

-- Server actions (via service-role) bypass RLS for INSERT. No anon insert policy.
-- This guarantees only our webhook can append events.
