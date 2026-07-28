/**
 * PostgREST `.or()` accepts raw filter syntax. Quote values so commas,
 * parentheses and quotes from a user query stay data rather than operators.
 * SQL ILIKE wildcards (% and _) intentionally keep their normal semantics.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function buildProductTextOrFilter(text: string): string {
  const pattern = quotePostgrestValue(`%${text}%`);
  return `title.ilike.${pattern},description.ilike.${pattern}`;
}
