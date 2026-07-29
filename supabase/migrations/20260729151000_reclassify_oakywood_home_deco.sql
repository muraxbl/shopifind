-- Oakywood's curated assortment is workspace furniture and wooden desk
-- organization. Keeping it under indie-gadgets left the public home-deco hub
-- empty even though this merchant is a stronger editorial fit there.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE slug = 'oakywood') THEN
    RAISE EXCEPTION 'Oakywood store is missing';
  END IF;

  UPDATE public.stores
  SET niche = 'home-deco'
  WHERE slug = 'oakywood'
    AND niche IS DISTINCT FROM 'home-deco';
END
$$;

-- Operational rollback, if the taxonomy decision changes:
-- UPDATE public.stores SET niche = 'indie-gadgets' WHERE slug = 'oakywood';
