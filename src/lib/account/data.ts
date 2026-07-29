export const ACCOUNT_EXPORT_PAGE_SIZE = 500;
export const ACCOUNT_EXPORT_MAX_ROWS = 100_000;

type PageRead<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type AccountRowsResult<T> =
  | { success: true; data: T[] }
  | { success: false; error: "read_failed" | "too_large" };

export function isAccountDeletionConfirmation(
  value: unknown,
  accountEmail: string | null | undefined,
): boolean {
  if (typeof value !== "string" || !accountEmail) return false;
  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > 320 ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return false;
  }
  return (
    candidate.toLocaleLowerCase("en-US") ===
    accountEmail.toLocaleLowerCase("en-US")
  );
}

export function accountExportFilename(now = new Date()): string {
  const date = Number.isNaN(now.getTime())
    ? "unknown-date"
    : now.toISOString().slice(0, 10);
  return `shopifind-data-export-${date}.json`;
}

export async function readAllAccountRows<T>(
  readPage: (from: number, to: number) => PromiseLike<PageRead<T>>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<AccountRowsResult<T>> {
  const pageSize = options.pageSize ?? ACCOUNT_EXPORT_PAGE_SIZE;
  const maxRows = options.maxRows ?? ACCOUNT_EXPORT_MAX_ROWS;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer");
  }
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) return { success: false, error: "read_failed" };
    const page = result.data ?? [];
    if (rows.length + page.length > maxRows) {
      return { success: false, error: "too_large" };
    }
    rows.push(...page);
    if (page.length < pageSize) return { success: true, data: rows };
  }
}
