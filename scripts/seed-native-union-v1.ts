/**
 * Curated Native Union pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible, initially hidden upsert.
 */
import {
  CURATED_NATIVE_UNION_PRODUCT_IDS,
  NATIVE_UNION_UCP_ENDPOINT,
  parseNativeUnionLookup,
} from "../src/lib/feeds/nativeUnion";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "native-union",
  name: "Native Union",
  url: "https://www.nativeunion.com",
  niche: "indie-gadgets",
  short_description:
    "Accesorios tecnológicos de diseño con foco declarado en calidad y durabilidad.",
  long_description:
    "Native Union diseña accesorios para dispositivos, carga, escritorio y movilidad. La marca documenta una transición a materiales reciclados en varias líneas, alternativas sin cuero animal, garantías y una estrategia de producto centrada en durabilidad, pero reconoce que su recorrido ambiental sigue en progreso.",
  eco_score: 0,
  values: [
    "design-led",
    "durability",
    "recycled-materials",
    "repair-and-care-documentation",
  ],
  country: "HK",
  affiliate_program: "skimlinks",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: false,
  verified: false,
  featured: false,
};

runCuratedShopifyUcpSeed({
  label: "Native Union",
  dryRunStoreId: "dry-run-native-union",
  endpoint: NATIVE_UNION_UCP_ENDPOINT,
  productIds: CURATED_NATIVE_UNION_PRODUCT_IDS,
  intent:
    "curated diverse durable tech accessories with explicit recycled material evidence where available",
  store: STORE,
  parse: parseNativeUnionLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
