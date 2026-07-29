import assert from "node:assert/strict";
import test from "node:test";
import {
  accountExportFilename,
  isAccountDeletionConfirmation,
  readAllAccountRows,
} from "../src/lib/account/data";

test("account deletion requires the authenticated email", () => {
  assert.equal(
    isAccountDeletionConfirmation("  User@Example.com ", "user@example.com"),
    true,
  );
  assert.equal(
    isAccountDeletionConfirmation("another@example.com", "user@example.com"),
    false,
  );
  assert.equal(isAccountDeletionConfirmation(null, "user@example.com"), false);
  assert.equal(isAccountDeletionConfirmation("user@example.com", null), false);
  assert.equal(
    isAccountDeletionConfirmation("user@example.com\n", "user@example.com"),
    true,
  );
  assert.equal(
    isAccountDeletionConfirmation("user\n@example.com", "user@example.com"),
    false,
  );
});

test("account export filename is deterministic and contains no identity data", () => {
  assert.equal(
    accountExportFilename(new Date("2026-07-29T12:34:56Z")),
    "shopifind-data-export-2026-07-29.json",
  );
  assert.equal(
    accountExportFilename(new Date(Number.NaN)),
    "shopifind-data-export-unknown-date.json",
  );
});

test("account export pagination reads every row in stable ranges", async () => {
  const source = [1, 2, 3, 4, 5];
  const ranges: Array<[number, number]> = [];
  const result = await readAllAccountRows(
    async (from, to) => {
      ranges.push([from, to]);
      return { data: source.slice(from, to + 1), error: null };
    },
    { pageSize: 2, maxRows: 10 },
  );

  assert.deepEqual(result, { success: true, data: source });
  assert.deepEqual(ranges, [
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
});

test("account export pagination fails closed on reads and oversized exports", async () => {
  assert.deepEqual(
    await readAllAccountRows(async () => ({
      data: null,
      error: { message: "db unavailable" },
    })),
    { success: false, error: "read_failed" },
  );

  assert.deepEqual(
    await readAllAccountRows(
      async (from, to) => ({
        data: [1, 2, 3, 4].slice(from, to + 1),
        error: null,
      }),
      { pageSize: 2, maxRows: 3 },
    ),
    { success: false, error: "too_large" },
  );
});
