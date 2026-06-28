const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularCostoMicros, estimarReservaMicros } = require("./costos");

test("calcularCostoMicros calculates input and output costs separately", () => {
  assert.equal(
    calcularCostoMicros(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 }
    ),
    500_000
  );
});

test("calcularCostoMicros rounds fractional microdollars upward", () => {
  assert.equal(
    calcularCostoMicros(
      { inputTokens: 1, outputTokens: 1 },
      { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 }
    ),
    1
  );
});

test("estimarReservaMicros applies the configured safety multiplier", () => {
  assert.equal(
    estimarReservaMicros(
      { maxInputTokens: 1_200, maxOutputTokens: 300 },
      { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
      4
    ),
    960
  );
});

test("cost calculations reject negative token counts", () => {
  assert.throws(
    () =>
      calcularCostoMicros(
        { inputTokens: -1, outputTokens: 3 },
        { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 }
      ),
    /tokens/
  );
});
