const PLAUSIBLE_SCRIPT_PATTERN =
  /^https:\/\/plausible\.io\/js\/pa-[A-Za-z0-9_-]+\.js$/;

export function normalizePlausibleScriptSrc(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  return value && PLAUSIBLE_SCRIPT_PATTERN.test(value) ? value : null;
}
