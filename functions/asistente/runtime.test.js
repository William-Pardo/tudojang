const test = require("node:test");
const assert = require("node:assert/strict");
const { estaIaHabilitada, obtenerPeriodoMensual } = require("./runtime");

test("AI is disabled unless explicitly enabled", () => {
  assert.equal(estaIaHabilitada({}), false);
  assert.equal(estaIaHabilitada({ ASSISTANT_AI_ENABLED: "false" }), false);
});

test("AI can only be enabled with the exact true flag and provider secret", () => {
  assert.equal(estaIaHabilitada({ ASSISTANT_AI_ENABLED: "true" }), false);
  assert.equal(
    estaIaHabilitada({
      ASSISTANT_AI_ENABLED: "true",
      GEMINI_API_KEY: "test-secret",
    }),
    true
  );
});

test("monthly period is deterministic in UTC", () => {
  assert.equal(
    obtenerPeriodoMensual(new Date("2026-06-30T23:59:59Z")),
    "2026-06"
  );
});
