const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { firmarIntegridadCheckoutWompi } = require("./wompiIntegrity");

test("firma checkout Wompi con referencia, monto, moneda y secreto de integridad", () => {
  const payload = {
    reference: "SUSC_tnt-123_starter_1780000000000",
    amountInCents: 16000000,
    currency: "COP",
  };
  const secret = "integrity_test_secret";

  const signature = firmarIntegridadCheckoutWompi(payload, secret);

  assert.equal(
    signature,
    crypto
      .createHash("sha256")
      .update(`${payload.reference}${payload.amountInCents}${payload.currency}${secret}`)
      .digest("hex")
  );
});

test("rechaza datos incompletos antes de firmar", () => {
  assert.throws(
    () =>
      firmarIntegridadCheckoutWompi(
        { reference: "", amountInCents: 16000000, currency: "COP" },
        "integrity_test_secret"
      ),
    /reference/
  );
  assert.throws(
    () =>
      firmarIntegridadCheckoutWompi(
        { reference: "SUSC_1", amountInCents: 0, currency: "COP" },
        "integrity_test_secret"
      ),
    /amountInCents/
  );
  assert.throws(
    () =>
      firmarIntegridadCheckoutWompi(
        { reference: "SUSC_1", amountInCents: 16000000, currency: "USD" },
        "integrity_test_secret"
      ),
    /currency/
  );
  assert.throws(
    () =>
      firmarIntegridadCheckoutWompi(
        { reference: "SUSC_1", amountInCents: 16000000, currency: "COP" },
        ""
      ),
    /secret/
  );
});
