/**
 * Curated Thinking MU pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible, initially hidden upsert.
 */
import {
  CURATED_THINKING_MU_PRODUCT_IDS,
  parseThinkingMuLookup,
  THINKING_MU_UCP_ENDPOINT,
} from "../src/lib/feeds/thinkingmu";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "thinking-mu",
  name: "Thinking MU",
  url: "https://thinkingmu.com",
  niche: "sustainable-fashion",
  short_description:
    "Moda consciente de origen mediterráneo con materiales documentados en cada prenda.",
  long_description:
    "Thinking MU nació en 2008 y diseña moda de inspiración mediterránea. La marca documenta fibras orgánicas, recicladas y biodegradables, una política de reducción de residuos, trazabilidad mediante QR y una red estable de proveedores.",
  eco_score: 0,
  values: [
    "organic-materials",
    "lower-impact-fibres",
    "traceability",
    "zero-stock-policy",
  ],
  country: "ES",
  affiliate_program: "skimlinks",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: false,
  verified: false,
  featured: false,
};

runCuratedShopifyUcpSeed({
  label: "Thinking MU",
  dryRunStoreId: "dry-run-thinking-mu",
  endpoint: THINKING_MU_UCP_ENDPOINT,
  productIds: CURATED_THINKING_MU_PRODUCT_IDS,
  intent:
    "curated sustainable fashion with explicit organic cotton or hemp material evidence",
  store: STORE,
  parse: parseThinkingMuLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
