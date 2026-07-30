/**
 * Curated Oakywood pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible upsert.
 */
import {
  CURATED_OAKYWOOD_PRODUCT_IDS,
  OAKYWOOD_UCP_ENDPOINT,
  parseOakywoodLookup,
} from "../src/lib/feeds/oakywood";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "oakywood",
  name: "Oakywood",
  url: "https://oakywood.shop",
  niche: "home-deco",
  short_description:
    "Accesorios de escritorio tecnológicos diseñados y fabricados en un taller familiar de Polonia.",
  long_description:
    "Oakywood combina madera y materiales de origen responsable con accesorios tecnológicos duraderos para organizar el espacio de trabajo. Documenta madera FSC, producción local, recuperación de productos y cinco años de garantía.",
  eco_score: 84,
  values: [
    "independent",
    "made-in-poland",
    "responsible-materials",
    "fsc-wood",
    "five-year-warranty",
  ],
  country: "PL",
  affiliate_program: "direct-outreach",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: true,
  verified: false,
  featured: true,
};

runCuratedShopifyUcpSeed({
  label: "Oakywood",
  dryRunStoreId: "dry-run-oakywood",
  endpoint: OAKYWOOD_UCP_ENDPOINT,
  productIds: CURATED_OAKYWOOD_PRODUCT_IDS,
  intent:
    "curated sustainable workspace accessories from an independent European maker",
  store: STORE,
  parse: parseOakywoodLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
