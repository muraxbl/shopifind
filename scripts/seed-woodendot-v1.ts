/**
 * Curated Woodendot pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible, initially hidden upsert.
 */
import {
  CURATED_WOODENDOT_PRODUCT_IDS,
  parseWoodendotLookup,
  WOODENDOT_UCP_ENDPOINT,
} from "../src/lib/feeds/woodendot";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "woodendot",
  name: "Woodendot",
  url: "https://woodendot.com",
  niche: "home-deco",
  short_description:
    "Mobiliario y accesorios de madera diseñados y fabricados localmente en Íscar, España.",
  long_description:
    "Woodendot crea mobiliario, iluminación y accesorios contemporáneos en Íscar. La marca documenta producción artesanal local, uso exclusivo de madera certificada FSC, embalajes reciclados y reciclables, cinco años de garantía y recuperación de muebles mediante su iniciativa Vida.",
  eco_score: 0,
  values: [
    "independent",
    "made-in-spain",
    "fsc-certified-wood",
    "local-craftsmanship",
    "five-year-warranty",
    "circular-take-back",
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
  label: "Woodendot",
  dryRunStoreId: "dry-run-woodendot",
  endpoint: WOODENDOT_UCP_ENDPOINT,
  productIds: CURATED_WOODENDOT_PRODUCT_IDS,
  intent:
    "curated furniture, lighting and home accessories made locally in Spain",
  store: STORE,
  parse: parseWoodendotLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
