/**
 * Curated ShiftCam pilot using Shopify's official UCP Storefront Catalog.
 * Dry-run is the default; --write performs a reversible upsert.
 */
import {
  CURATED_SHIFTCAM_PRODUCT_IDS,
  parseShiftcamLookup,
  SHIFTCAM_UCP_ENDPOINT,
} from "../src/lib/feeds/shiftcam";
import { runCuratedShopifyUcpSeed } from "./lib/curated-shopify-ucp";

const STORE = {
  slug: "shiftcam",
  name: "ShiftCam",
  url: "https://www.shiftcam.com",
  niche: "indie-gadgets",
  short_description:
    "Óptica y accesorios modulares para fotografía móvil creados por una marca independiente de Hong Kong.",
  long_description:
    "ShiftCam nació en Hong Kong en 2017 y desarrolló mediante Kickstarter un ecosistema de lentes, grips, luces y soportes para creadores móviles. Envía internacionalmente; IVA, aranceles y costes de importación pueden variar según el destino y el checkout.",
  eco_score: 0,
  values: [
    "independent",
    "modular-system",
    "creator-tools",
    "mobile-photography",
    "worldwide-shipping",
  ],
  country: "HK",
  affiliate_program: "direct-pending",
  affiliate_id: null,
  feed_source: "shopify-ucp-curated",
  active: true,
  verified: false,
  featured: true,
};

runCuratedShopifyUcpSeed({
  label: "ShiftCam",
  dryRunStoreId: "dry-run-shiftcam",
  endpoint: SHIFTCAM_UCP_ENDPOINT,
  productIds: CURATED_SHIFTCAM_PRODUCT_IDS,
  intent:
    "curated mobile photography gear from an independent maker shipping to Spain",
  store: STORE,
  parse: parseShiftcamLookup,
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
