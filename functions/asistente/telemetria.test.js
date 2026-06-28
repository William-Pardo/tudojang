const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearEventoTelemetria,
  hashIdentifier,
  calcularNivelAlertaCosto,
} = require("./telemetria");

test("telemetry stores hashed identifiers and operational metrics only", () => {
  const event = crearEventoTelemetria({
    uid: "user-1",
    tenantId: "tenant-1",
    intentId: "students.manage",
    source: "ai",
    latencyMs: 450,
    inputTokens: 120,
    outputTokens: 25,
    costMicros: 22,
    quotaOutcome: "allowed",
    escalationReason: null,
    prompt: "must not be stored",
    transcript: ["must not be stored"],
    now: new Date("2026-06-25T12:00:00Z"),
  });

  assert.equal(event.uidHash, hashIdentifier("user-1"));
  assert.equal(event.tenantHash, hashIdentifier("tenant-1"));
  assert.equal("uid" in event, false);
  assert.equal("tenantId" in event, false);
  assert.equal("prompt" in event, false);
  assert.equal("transcript" in event, false);
  assert.equal(event.createdAt, "2026-06-25T12:00:00.000Z");
  assert.equal(event.retentionUntil, "2026-07-25T12:00:00.000Z");
});

test("telemetry rejects negative costs or token usage", () => {
  assert.throws(
    () =>
      crearEventoTelemetria({
        uid: "user-1",
        tenantId: "tenant-1",
        source: "ai",
        latencyMs: 10,
        inputTokens: -1,
        outputTokens: 2,
        costMicros: 1,
        quotaOutcome: "allowed",
      }),
    /no negativo/
  );
});

test("telemetry stores quota remaining without raw identifiers", () => {
  const event = crearEventoTelemetria({
    uid: "user-1",
    tenantId: "tenant-1",
    source: "ai",
    latencyMs: 10,
    inputTokens: 12,
    outputTokens: 3,
    costMicros: 2,
    quotaOutcome: "allowed",
    remaining: { user: 9, tenant: 99, global: 999 },
  });

  assert.deepEqual(event.remaining, { user: 9, tenant: 99, global: 999 });
  assert.equal("uid" in event.remaining, false);
  assert.equal("tenantId" in event.remaining, false);
});

test("telemetry rejects negative quota remaining", () => {
  assert.throws(
    () =>
      crearEventoTelemetria({
        uid: "user-1",
        tenantId: "tenant-1",
        source: "ai",
        latencyMs: 10,
        inputTokens: 12,
        outputTokens: 3,
        costMicros: 2,
        quotaOutcome: "allowed",
        remaining: { user: -1, tenant: 99, global: 999 },
      }),
    /remaining\.user/
  );
});

test("cost alert levels activate at 50, 75, 90 and 100 percent", () => {
  assert.equal(calcularNivelAlertaCosto(4_999, 10_000), null);
  assert.equal(calcularNivelAlertaCosto(5_000, 10_000), 50);
  assert.equal(calcularNivelAlertaCosto(7_500, 10_000), 75);
  assert.equal(calcularNivelAlertaCosto(9_000, 10_000), 90);
  assert.equal(calcularNivelAlertaCosto(10_000, 10_000), 100);
  assert.equal(calcularNivelAlertaCosto(12_000, 10_000), 100);
});

test("telemetry event contains no prompt or transcript fields when serialized", () => {
  const serialized = JSON.stringify(
    crearEventoTelemetria({
      uid: "user-1",
      tenantId: "tenant-1",
      source: "local",
      latencyMs: 12,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      quotaOutcome: "not_applicable",
    })
  );

  assert.doesNotMatch(serialized, /prompt|transcript|conversation|question/i);
});
