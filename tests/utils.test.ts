import assert from "node:assert/strict";
import test from "node:test";
import { formatEcoScore } from "../src/lib/utils";

test("eco score zero is explicitly unevaluated", () => {
  assert.deepEqual(formatEcoScore(0), {
    label: "Sin evaluar",
    variant: "bg-stone-100 text-stone-700",
    evaluated: false,
  });
});

test("positive eco scores remain evaluated", () => {
  assert.equal(formatEcoScore(49).evaluated, true);
  assert.equal(formatEcoScore(70).label, "Bueno");
  assert.equal(formatEcoScore(85).label, "Excelente");
});
