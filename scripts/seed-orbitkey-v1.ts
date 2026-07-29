/**
 * Curated Orbitkey pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible, initially hidden upsert.
 */
import {
  CURATED_ORBITKEY_PRODUCT_IDS,
  ORBITKEY_UCP_ENDPOINT,
  parseOrbitkeyLookup,
} from "../src/lib/feeds/orbitkey";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "orbitkey",
  name: "Orbitkey",
  url: "https://www.orbitkey.eu",
  niche: "indie-gadgets",
  short_description:
    "Accesorios funcionales para organizar llaves, tecnología y espacios de trabajo.",
  long_description:
    "Orbitkey diseña en Melbourne accesorios de organización personal, viaje y escritorio. Su catálogo europeo se sirve desde Países Bajos e incluye productos con materiales reciclados, alternativas sin cuero animal, pilas reemplazables y dos años de garantía; las evidencias ambientales se conservan producto a producto.",
  eco_score: 0,
  values: [
    "design-led",
    "durability",
    "recycled-materials",
    "responsible-materials",
  ],
  country: "AU",
  affiliate_program: "direct-on-request",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: false,
  verified: false,
  featured: false,
};

runCuratedShopifyUcpSeed({
  label: "Orbitkey",
  dryRunStoreId: "dry-run-orbitkey",
  endpoint: ORBITKEY_UCP_ENDPOINT,
  productIds: CURATED_ORBITKEY_PRODUCT_IDS,
  intent:
    "curated durable organization and tech accessories with product-level material evidence",
  store: STORE,
  parse: parseOrbitkeyLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
