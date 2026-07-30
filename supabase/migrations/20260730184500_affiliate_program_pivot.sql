-- Skimlinks rejected Shopifind on 2026-07-30. Remove the implicit aggregator
-- default and describe the actual commercial path for the public merchants.
-- Product-level approved deep links remain in products.affiliate_url.

ALTER TABLE public.stores
  ALTER COLUMN affiliate_program DROP DEFAULT;

UPDATE public.stores
SET affiliate_program = 'unconfigured',
    updated_at = NOW()
WHERE affiliate_program = 'skimlinks';

UPDATE public.stores
SET affiliate_program = CASE slug
  WHEN 'rapanui' THEN 'rakuten-pending'
  WHEN 'shiftcam' THEN 'direct-pending'
  WHEN 'oakywood' THEN 'direct-outreach'
  WHEN 'masterled-es' THEN 'pro-bono'
  ELSE affiliate_program
END,
updated_at = NOW()
WHERE slug IN ('rapanui', 'shiftcam', 'oakywood', 'masterled-es');
