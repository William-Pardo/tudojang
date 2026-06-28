const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearTicketMinimo,
  aplicarTransicionMaster,
  puedeAccederTicket,
} = require("./tickets");

const identity = {
  uid: "user-1",
  tenantId: "tenant-1",
  rol: "Admin",
};

test("ticket derives identity and tenant, storing only a redacted summary", () => {
  const ticket = crearTicketMinimo({
    identity,
    input: {
      tenantId: "tenant-attacker",
      userId: "attacker",
      summary: "Contactar ana@example.com por error en estudiantes",
      source: "local",
      category: "estudiantes",
    },
    now: new Date("2026-06-25T01:00:00Z"),
  });

  assert.deepEqual(ticket, {
    userId: "user-1",
    tenantId: "tenant-1",
    category: "estudiantes",
    summary: "Contactar [EMAIL] por error en estudiantes",
    source: "local",
    status: "open",
    createdAt: "2026-06-25T01:00:00.000Z",
    retentionUntil: "2026-09-23T01:00:00.000Z",
  });
});

test("ordinary users can access only their own tenant tickets", () => {
  assert.equal(
    puedeAccederTicket(identity, {
      userId: "user-1",
      tenantId: "tenant-1",
    }),
    true
  );
  assert.equal(
    puedeAccederTicket(identity, {
      userId: "user-2",
      tenantId: "tenant-2",
    }),
    false
  );
});

test("verified SuperAdmin can transition ticket and records audit fields", () => {
  const result = aplicarTransicionMaster({
    identity: { uid: "master-1", tenantId: "master", rol: "SuperAdmin" },
    ticket: { status: "open", tenantId: "tenant-1" },
    nextStatus: "resolved",
    now: new Date("2026-06-25T02:00:00Z"),
  });

  assert.deepEqual(result, {
    status: "resolved",
    updatedAt: "2026-06-25T02:00:00.000Z",
    lastTransition: {
      actorId: "master-1",
      from: "open",
      to: "resolved",
      at: "2026-06-25T02:00:00.000Z",
    },
  });
});

test("non-Master cannot transition ticket status", () => {
  assert.throws(
    () =>
      aplicarTransicionMaster({
        identity,
        ticket: { status: "open", tenantId: "tenant-1" },
        nextStatus: "resolved",
        now: new Date(),
      }),
    (error) => error.code === "permission-denied"
  );
});
