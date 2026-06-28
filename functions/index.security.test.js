const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

const excludedDirectories = new Set(["node_modules", "coverage"]);

const listProductionJavaScript = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name)
        ? []
        : listProductionJavaScript(entryPath);
    }
    return entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")
      ? [entryPath]
      : [];
  });

const productionJavaScriptFiles = listProductionJavaScript(__dirname);

test("Resend credentials are never hardcoded in Functions source", () => {
  for (const file of productionJavaScriptFiles) {
    const fileSource = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      fileSource,
      /\bre_[A-Za-z0-9_-]{20,}\b/,
      `Resend credential found in ${path.relative(__dirname, file)}`
    );
  }
});

test("email-capable Functions bind RESEND_API_KEY from Secret Manager", () => {
  assert.match(
    source,
    /const emailFunctions = functionsV1\.runWith\(\{\s*secrets:\s*\["RESEND_API_KEY"\]\s*\}\);/
  );

  const expectedFunctions = [
    "provisionarUsuarioOnboarding",
    "enviarBienvenidaTudojang",
  ];

  for (const functionName of expectedFunctions) {
    assert.match(
      source,
      new RegExp(
        `exports\\.${functionName} = emailFunctions\\.https\\.onRequest`
      ),
      `${functionName} must bind RESEND_API_KEY`
    );
  }

  assert.match(
    source,
    /exports\.notificarMasterMisionKicho = emailFunctions\.firestore/
  );
  assert.match(
    source,
    /exports\.notificarMasterSolicitudCarnets = emailFunctions\.firestore/
  );
  assert.match(
    source,
    /const paymentFunctions = functionsV1\.runWith\(\{\s*secrets:\s*\["RESEND_API_KEY", "WOMPI_EVENTS_SECRET", "WOMPI_INTEGRITY_SECRET"\]/
  );
  assert.match(
    source,
    /exports\.webhookWompi = paymentFunctions\.https\.onRequest/
  );
  assert.match(
    source,
    /exports\.firmarCheckoutWompi = paymentFunctions\.https\.onCall/
  );
});

test("Resend is initialized lazily from the bound environment secret", () => {
  assert.match(
    source,
    /const getResend = \(\) => new Resend\(process\.env\.RESEND_API_KEY\);/
  );
  assert.doesNotMatch(source, /\bresend\.emails\.send/);
});

test("production does not expose an unauthenticated Resend test endpoint", () => {
  assert.doesNotMatch(source, /exports\.testEmailResend\s*=/);
});

test("Gemini credentials are bound through Secret Manager, not legacy runtime config", () => {
  assert.match(
    source,
    /const geminiFunctions = functionsV1\.runWith\(\{[\s\S]*secrets:\s*\["GEMINI_API_KEY"\][\s\S]*\}\);/
  );
  assert.match(
    source,
    /exports\.analizarComprobanteEstudiante = geminiFunctions\.firestore/
  );
  assert.doesNotMatch(source, /functions\.config\(\)\.gemini/);
});

test("onboarding activation trusts backend payment evidence, not browser data alone", () => {
  assert.match(source, /validarTenantParaProvision\(\{\s*tenant:\s*tenantSnap,\s*tenantId,\s*email\s*\}\)/);
  assert.match(source, /validarEvidenciaPagoParaActivacion\(\{[\s\S]*tenant:\s*tenantSnap,[\s\S]*transactionId,[\s\S]*\}\)/);
  assert.match(source, /ultimoPagoWompi:\s*\{[\s\S]*transactionId:\s*data\.transaction\.id,[\s\S]*status:\s*data\.transaction\.status/);
});

test("production does not expose unused public email endpoints", () => {
  for (const functionName of [
    "enviarConfirmacionPago",
    "enviarRecuperacionPassword",
    "notificarCambioPassword",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`exports\\.${functionName}\\s*=`),
      `${functionName} must not be exposed as a public HTTP endpoint`
    );
  }
});
