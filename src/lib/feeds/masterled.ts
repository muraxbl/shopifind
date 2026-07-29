export type MasterledCsvRow = Record<string, string>;

export type MasterledProduct = {
  store_id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: 'EUR';
  image_url: string;
  source_url: string;
  eco_tags: string[];
  attributes: Record<string, string>;
  in_stock: boolean;
  last_seen_at: string;
};

export type ParsedMasterledFeed = {
  headers: string[];
  rows: MasterledCsvRow[];
  validRows: MasterledCsvRow[];
};

export const MASTERLED_MAX_CURATED_PRODUCTS = 50;

/**
 * Human-reviewed variants, ordered by editorial priority. The curator fills
 * the places left by protected families from this list and ignores unavailable
 * variants. Extra IDs at the end are deliberate reserves for future stock
 * changes; they never make the public selection exceed 50 rows.
 */
export const MASTERLED_CURATED_ATTRIBUTE_IDS = [
  // Existing user intent: active alert/wishlist and observed click-outs.
  '789',
  '2119',
  '764',
  '766',
  '1724',
  '894',
  '3871',
  '3702',
  '3705',
  // Interior and architectural lighting.
  '3634',
  '3029',
  '2443',
  '2441',
  '3610',
  '5345',
  // Solar, exterior and pool use cases.
  '3129',
  '2167',
  '2043',
  '2555',
  '2414',
  '5336',
  '1926',
  '3424',
  // Smart controls, safety and electrical utility.
  '5327',
  '4919',
  '5270',
  '2148',
  '2703',
  '5421',
  // Complete LED-strip systems rather than near-identical colour variants.
  '3648',
  '3666',
  '3438',
  '3722',
  '3772',
  '874',
  '1637',
  // Professional, efficient and emergency applications.
  '3679',
  '3619',
  '5062',
  '2732',
  '3414',
  '1812',
  // Reviewed reserves, used only when an earlier optional variant is absent.
  '5350',
  '2823',
  '2287',
  '2143',
  '1563',
  '1205',
  '2491',
  '5299',
  '3787',
  '5003',
  '4912',
  '4925',
  '5351',
] as const;

export type CuratedMasterledFeed = {
  rows: MasterledCsvRow[];
  protectedRows: MasterledCsvRow[];
  missingPreferredIds: string[];
  unavailablePreferredIds: string[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function stripHtml(html: string, max = 600): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function parseMasterledPrice(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function parseStock(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isProtectedMasterledRow(row: MasterledCsvRow): boolean {
  const title = row['nombre'] ?? '';
  const categories = row['Categorías'] ?? '';
  return (
    /ventilador(?:es)? de techo/i.test(title) ||
    /(?:^|,\s*)Carril Enchufes Deslizantes(?:\s*,|$)/i.test(categories)
  );
}

export function curateMasterledFeed(
  rows: readonly MasterledCsvRow[],
  limit = MASTERLED_MAX_CURATED_PRODUCTS,
): CuratedMasterledFeed {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MASTERLED_MAX_CURATED_PRODUCTS
  ) {
    throw new Error(
      `Masterled curated limit must be between 1 and ${MASTERLED_MAX_CURATED_PRODUCTS}.`,
    );
  }

  const byAttributeId = new Map<string, MasterledCsvRow>();
  for (const row of rows) {
    const attributeId = row['id_product_attribute']?.trim();
    if (attributeId && !byAttributeId.has(attributeId)) {
      byAttributeId.set(attributeId, row);
    }
  }

  const protectedRows = rows.filter(isProtectedMasterledRow);
  if (protectedRows.length > limit) {
    throw new Error(
      `Masterled protected families contain ${protectedRows.length} rows, above the ${limit}-row limit.`,
    );
  }

  const selected = new Map<string, MasterledCsvRow>();
  for (const row of protectedRows) {
    selected.set(row['id_product_attribute']!, row);
  }

  const missingPreferredIds: string[] = [];
  const unavailablePreferredIds: string[] = [];
  for (const attributeId of MASTERLED_CURATED_ATTRIBUTE_IDS) {
    if (selected.size >= limit) break;
    const row = byAttributeId.get(attributeId);
    if (!row) {
      missingPreferredIds.push(attributeId);
      continue;
    }
    if (selected.has(attributeId)) continue;
    if (parseStock(row['stock']) <= 0) {
      unavailablePreferredIds.push(attributeId);
      continue;
    }
    selected.set(attributeId, row);
  }

  return {
    rows: [...selected.values()],
    protectedRows,
    missingPreferredIds,
    unavailablePreferredIds,
  };
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidRow(row: MasterledCsvRow): boolean {
  const productId = Number.parseInt(row['id_product'] ?? '', 10);
  const attributeId = Number.parseInt(row['id_product_attribute'] ?? '', 10);
  return (
    Boolean(row['nombre']?.trim()) &&
    Boolean(row['precio']?.trim()) &&
    parseMasterledPrice(row['precio']) > 0 &&
    isHttpUrl(row['Imagen 1']) &&
    Number.isSafeInteger(productId) &&
    productId > 0 &&
    Number.isSafeInteger(attributeId) &&
    attributeId >= 0
  );
}

function deriveEcoTags(row: MasterledCsvRow): string[] {
  const tags = new Set<string>(['led', 'low-energy', 'eu-made']);
  if (/aluminio|pvc/i.test(row['Material'] ?? '')) tags.add('recyclable');
  const lifetime =
    Number.parseInt((row['Horas de vida'] ?? '0').replace(/[^\d]/g, ''), 10) ||
    0;
  if (lifetime >= 25_000) tags.add('long-lifespan');
  const certifications = (row['Certificaciones'] ?? '').toLowerCase();
  if (certifications.includes('ce') && certifications.includes('rohs')) {
    tags.add('certified');
  }
  return [...tags].sort();
}

function deriveAttributes(row: MasterledCsvRow): Record<string, string> {
  const attributes: Record<string, string> = {};
  const fields = [
    ['potencia', row['Potencia']],
    ['lumens', row['Lumens']],
    ['temperatura_color', row['Temperatura de color']],
    ['angulo_apertura', row['Ángulo de apertura']],
    ['material', row['Material']],
    ['certificaciones', row['Certificaciones']],
    ['garantia', row['Garantía']],
    ['grado_proteccion', row['Grado de protección']],
    ['casquillo', row['Tipo Casquillo'] || row['Casquillo']],
    ['horas_vida', row['Horas de vida']],
  ] as const;
  for (const [key, value] of fields) {
    if (value?.trim()) attributes[key] = value.trim();
  }
  return attributes;
}

export function parseMasterledFeed(rawInput: string): ParsedMasterledFeed {
  const raw = rawInput.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]!;
    if (inQuotes) {
      if (character === '"') {
        if (raw[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ';') {
      current.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && raw[index + 1] === '\n') index++;
      current.push(field);
      records.push(current);
      current = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    records.push(current);
  }
  if (records.at(-1)?.every((cell) => cell.trim() === '')) records.pop();

  const headers = (records[0] ?? []).map((header) => header.trim());
  const rows = records.slice(1).map((cells) => {
    const row: MasterledCsvRow = {};
    for (let index = 0; index < headers.length; index++) {
      row[headers[index]!] = (cells[index] ?? '').trim();
    }
    return row;
  });

  return { headers, rows, validRows: rows.filter(isValidRow) };
}

export function buildMasterledProduct(
  row: MasterledCsvRow,
  storeId: string,
  observedAt: string,
): MasterledProduct {
  const productId = Number.parseInt(row['id_product']!, 10);
  const attributeId = Number.parseInt(row['id_product_attribute']!, 10);
  const variant = row['nombre variante']?.trim();
  const rawTitle = variant ? `${row['nombre']} — ${variant}` : row['nombre']!;

  return {
    store_id: storeId,
    slug: `masterled-${slugify(row['nombre']!)}-${attributeId}`,
    title: rawTitle.length > 100 ? `${rawTitle.slice(0, 97)}…` : rawTitle,
    description: stripHtml(row['descripción'] ?? ''),
    price_cents: parseMasterledPrice(row['precio']),
    currency: 'EUR',
    image_url: row['Imagen 1']!,
    source_url: `https://masterled.es/es/index.php?controller=product&id_product=${productId}&id_product_attribute=${attributeId}`,
    eco_tags: deriveEcoTags(row),
    attributes: deriveAttributes(row),
    in_stock: parseStock(row['stock']) > 0,
    last_seen_at: observedAt,
  };
}

export function isAllowedMasterledFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'masterled.es' ||
        url.hostname.endsWith('.masterled.es'))
    );
  } catch {
    return false;
  }
}
