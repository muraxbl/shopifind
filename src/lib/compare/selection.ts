export const MIN_COMPARE_PRODUCTS = 2;
export const MAX_COMPARE_PRODUCTS = 5;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const result: string[] = [];

  for (const candidate of value.split(',')) {
    const id = candidate.trim().toLowerCase();
    if (!UUID_PATTERN.test(id) || result.includes(id)) continue;
    result.push(id);
    if (result.length === MAX_COMPARE_PRODUCTS) break;
  }

  return result;
}

export function buildCompareHref(ids: readonly string[]): string {
  return `/compare?ids=${ids.slice(0, MAX_COMPARE_PRODUCTS).join(',')}`;
}
