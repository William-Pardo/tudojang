const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarTenantParaProvision,
  validarEvidenciaPagoParaActivacion,
} = require("./onboardingSecurity");

const snapshot = (data) => ({
  exists: Boolean(data),
  data: () => data,
});

test("provision requires an existing matching pending tenant", () => {
  const tenant = snapshot({
    tenantId: "tnt-1",
    emailClub: "Admin@Test.com",
    estadoSuscripcion: "demo",
  });

  assert.equal(
    validarTenantParaProvision({
      tenant,
      tenantId: "tnt-1",
      email: "admin@test.com",
    }).tenantId,
    "tnt-1"
  );
});

test("provision rejects browser data that does not match the tenant", () => {
  assert.throws(
    () =>
      validarTenantParaProvision({
        tenant: snapshot({
          tenantId: "tnt-1",
          emailClub: "owner@test.com",
          estadoSuscripcion: "demo",
        }),
        tenantId: "tnt-1",
        email: "attacker@test.com",
      }),
    /Email no coincide/
  );
});

test("manual activation requires approved Wompi evidence stored by backend", () => {
  const tenant = snapshot({
    tenantId: "tnt-1",
    emailClub: "owner@test.com",
    ultimoPagoWompi: {
      transactionId: "txn-1",
      status: "APPROVED",
      amountInCents: 5000000,
    },
  });

  const result = validarEvidenciaPagoParaActivacion({
    tenant,
    tenantId: "tnt-1",
    email: "owner@test.com",
    transactionId: "txn-1",
  });

  assert.equal(result.pago.transactionId, "txn-1");
});

test("manual activation rejects missing or mismatched payment evidence", () => {
  assert.throws(
    () =>
      validarEvidenciaPagoParaActivacion({
        tenant: snapshot({
          tenantId: "tnt-1",
          emailClub: "owner@test.com",
        }),
        tenantId: "tnt-1",
        email: "owner@test.com",
        transactionId: "txn-1",
      }),
    /No existe evidencia/
  );

  assert.throws(
    () =>
      validarEvidenciaPagoParaActivacion({
        tenant: snapshot({
          tenantId: "tnt-1",
          emailClub: "owner@test.com",
          ultimoPagoWompi: {
            transactionId: "txn-real",
            status: "APPROVED",
          },
        }),
        tenantId: "tnt-1",
        email: "owner@test.com",
        transactionId: "txn-attacker",
      }),
    /transacci.n no coincide/i
  );
});
