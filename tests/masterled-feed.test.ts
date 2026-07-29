import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMasterledProduct,
  curateMasterledFeed,
  isAllowedMasterledFeedUrl,
  isProtectedMasterledRow,
  MASTERLED_MAX_CURATED_PRODUCTS,
  parseMasterledFeed,
  parseMasterledPrice,
} from '../src/lib/feeds/masterled';

const FEED = `\uFEFFid_product;id_product_attribute;nombre;"nombre variante";descripción;precio;stock;"Imagen 1";Potencia;Material;"Horas de vida";Certificaciones;"Tipo Casquillo"\n42;7;Bombilla Ámbar;2700K;"LED; regulable &amp; eficiente";5,49;3;https://masterled.es/img/42.jpg;5W;Aluminio;30000h;"CE + RoHS";GU10\n`;

test('masterled parser handles BOM, quoted semicolons and mapping', () => {
  const parsed = parseMasterledFeed(FEED);
  assert.equal(parsed.validRows.length, 1);
  const product = buildMasterledProduct(
    parsed.validRows[0]!,
    '550e8400-e29b-41d4-a716-446655440000',
    '2026-07-28T20:00:00.000Z',
  );
  assert.equal(product.slug, 'masterled-bombilla-ambar-7');
  assert.equal(product.price_cents, 549);
  assert.equal(product.in_stock, true);
  assert.equal(product.description, 'LED; regulable & eficiente');
  assert.deepEqual(product.eco_tags, [
    'certified',
    'eu-made',
    'led',
    'long-lifespan',
    'low-energy',
    'recyclable',
  ]);
  assert.equal(product.attributes.casquillo, 'GU10');
});

test('masterled price and feed URL validation fail closed', () => {
  assert.equal(parseMasterledPrice('€ 19.95'), 1995);
  assert.equal(parseMasterledPrice('not-a-price'), 0);
  assert.equal(
    parseMasterledFeed(FEED.replace('5,49', 'not-a-price')).validRows.length,
    0,
  );
  assert.equal(
    isAllowedMasterledFeedUrl(
      'https://masterled.es/module/mlexportproducts/export?token=secret',
    ),
    true,
  );
  assert.equal(
    isAllowedMasterledFeedUrl('https://masterled.es.attacker.test/feed'),
    false,
  );
  assert.equal(isAllowedMasterledFeedUrl('http://masterled.es/feed'), false);
});

function curatedRow(input: {
  attributeId: string;
  title: string;
  categories?: string;
  stock?: string;
}) {
  return {
    id_product: input.attributeId,
    id_product_attribute: input.attributeId,
    nombre: input.title,
    Categorías: input.categories ?? 'Productos LED',
    stock: input.stock ?? '10',
  };
}

test('masterled curation always preserves ceiling fans and sliding track modules', () => {
  const fan = curatedRow({
    attributeId: 'future-fan',
    title: 'Ventilador de techo silencioso',
  });
  const trackModule = curatedRow({
    attributeId: 'future-track-module',
    title: 'Nuevo módulo USB',
    categories: 'Mecanismos Eléctricos, Carril Enchufes Deslizantes',
  });
  const preferred = curatedRow({
    attributeId: '789',
    title: 'Bombilla G4 1.5W bi-pin',
  });
  const unrelated = curatedRow({
    attributeId: 'not-curated',
    title: 'Bombilla repetida',
  });

  const result = curateMasterledFeed(
    [unrelated, preferred, fan, trackModule],
    3,
  );
  assert.equal(isProtectedMasterledRow(fan), true);
  assert.equal(isProtectedMasterledRow(trackModule), true);
  assert.deepEqual(
    result.rows.map((row) => row.id_product_attribute),
    ['future-fan', 'future-track-module', '789'],
  );
});

test('masterled curation never exceeds 50 and skips unavailable optional rows', () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    curatedRow({
      attributeId: String(index === 0 ? 789 : 10_000 + index),
      title: `Optional ${index}`,
      stock: index === 0 ? '0' : '10',
    }),
  );
  const result = curateMasterledFeed(rows);
  assert.ok(result.rows.length <= MASTERLED_MAX_CURATED_PRODUCTS);
  assert.deepEqual(result.unavailablePreferredIds, ['789']);
  assert.throws(() => curateMasterledFeed(rows, 51));
});
