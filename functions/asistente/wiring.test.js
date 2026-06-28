const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("assistant callable binds GEMINI_API_KEY only on the backend", () => {
  assert.match(
    source,
    /const assistantFunctions = functionsV1\.runWith\(\{[\s\S]*secrets:\s*\["GEMINI_API_KEY"\],[\s\S]*enforceAppCheck:\s*true,[\s\S]*\}\);/
  );
  assert.match(
    source,
    /exports\.consultarAsistenteIa = assistantFunctions\.https\.onCall\(/
  );
});

test("assistant and ticket callables enforce App Check", () => {
  assert.match(source, /enforceAppCheck:\s*true/);
  assert.match(
    source,
    /exports\.crearTicketSoporteSeguro = functionsV1[\s\S]*runWith\(\{\s*enforceAppCheck:\s*true\s*\}\)/
  );
  assert.match(
    source,
    /exports\.actualizarTicketSoporteSeguro = functionsV1[\s\S]*runWith\(\{\s*enforceAppCheck:\s*true\s*\}\)/
  );
});

test("assistant runtime uses the disabled-by-default feature flag", () => {
  assert.match(source, /enabled:\s*estaIaHabilitada\(\)/);
  assert.doesNotMatch(source, /ASSISTANT_AI_ENABLED\s*=\s*["']true["']/);
});

test("assistant production quotas are explicit and bounded", () => {
  assert.match(
    source,
    /const LIMITES_IA = \{[\s\S]*user:\s*50_000,[\s\S]*tenant:\s*200_000,[\s\S]*global:\s*8_000_000,[\s\S]*\};/
  );
  assert.match(
    source,
    /const RESERVA_IA_MICROS = estimarReservaMicros\([\s\S]*maxInputTokens:\s*1_200,[\s\S]*maxOutputTokens:\s*300[\s\S]*PRECIOS_IA,[\s\S]*4[\s\S]*\);/
  );
  assert.match(
    source,
    /reserveQuota:\s*async \(\{ uid, tenantId \}\) => \{[\s\S]*reservarCuota\(almacenCuotasIa,[\s\S]*limits:\s*LIMITES_IA,[\s\S]*\}\);/
  );
});

test("assistant callable records operational telemetry through Admin Firestore", () => {
  assert.match(
    source,
    /const registrarTelemetriaAsistente = async \(event\) => \{[\s\S]*collection\("asistente_telemetria"\)[\s\S]*crearEventoTelemetria\(event\)/
  );
  assert.match(
    source,
    /recordTelemetry:\s*registrarTelemetriaAsistente/
  );
});
