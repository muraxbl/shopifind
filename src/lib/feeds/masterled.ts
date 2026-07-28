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
