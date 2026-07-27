-- ============================================================================
-- Shopifind — Add 'iluminacion' vertical
-- Run AFTER 00000000000000_init.sql + 00000000000001_click_attribution.sql.
-- Idempotent: SAFE to run multiple times.
-- ============================================================================

INSERT INTO niches (id, label, description, emoji, display_order) VALUES
  (
    'iluminacion',
    'Iluminación',
    'Marcas independientes de iluminación LED técnica: bombillas, tiras, downlights, paneles, drivers. Geolocalizada España + UE con foco en vida útil larga, reciclabilidad y certificaciones CE/RoHS.',
    '💡',
    4
  )
ON CONFLICT (id) DO NOTHING;
