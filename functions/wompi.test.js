const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verificarFirmaEventoWompi } = require("./wompi");

const crearEvento = (secret, overrides = {}) => {
  const event = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "txn-123",
        status: "APPROVED",
        amount_in_cents: 5000000,
      },
    },
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.amount_in_cents",
      ],
    },
    timestamp: 1782400000,
    ...overrides,
  };

  const payload = `${event.data.transaction.id}${event.data.transaction.status}${event.data.transaction.amount_in_cents}${event.timestamp}${secret}`;
  event.signature.checksum = crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");
  return event;
};

test("verificarFirmaEventoWompi accepts a valid dynamic property checksum", () => {
  const secret = "events_test_secret";
  const event = crearEvento(secret);

  assert.equal(verificarFirmaEventoWompi(event, secret), true);
});

test("verificarFirmaEventoWompi rejects tampered event data", () => {
  const secret = "events_test_secret";
  const event = crearEvento(secret);
  event.data.transaction.amount_in_cents = 1;

  assert.equal(verificarFirmaEventoWompi(event, secret), false);
});

test("verificarFirmaEventoWompi rejects missing signature metadata", () => {
  assert.equal(
    verificarFirmaEventoWompi(
      { data: {}, timestamp: 1782400000, signature: {} },
      "events_test_secret"
    ),
    false
  );
});
