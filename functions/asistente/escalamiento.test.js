const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearServicioTickets,
  crearServicioTransicionTicket,
} = require("./escalamiento");

const context = {
  auth: {
    uid: "user-1",
    token: { tenantId: "tenant-1", rol: "Admin" },
  },
  app: { appId: "app-1" },
};

test("ticket service persists trusted minimal data and returns optional WhatsApp", async () => {
  let persisted;
  const service = crearServicioTickets({
    createDocument: async (ticket) => {
      persisted = ticket;
      return "ticket-123";
    },
    whatsappPhone: "573001234567",
    now: () => new Date("2026-06-25T10:00:00Z"),
  });

  const result = await service(
    {
      summary: "Ayuda para ana@example.com en estudiantes",
      category: "estudiantes",
      source: "local",
      whatsappConsent: true,
      hasSensitiveData: false,
      tenantId: "attacker",
    },
    context
  );

  assert.equal(persisted.userId, "user-1");
  assert.equal(persisted.tenantId, "tenant-1");
  assert.equal(persisted.summary.includes("ana@example.com"), false);
  assert.deepEqual(result, {
    ticketId: "ticket-123",
    source: "human",
    whatsapp: {
      allowed: true,
      url:
        "https://wa.me/573001234567?text=Ticket%20ticket-123%20-%20Categor%C3%ADa%3A%20estudiantes",
    },
  });
});

test("ticket service keeps ticket but cancels WhatsApp for sensitive data", async () => {
  const service = crearServicioTickets({
    createDocument: async () => "ticket-456",
    whatsappPhone: "573001234567",
  });

  const result = await service(
    {
      summary: "Problema con datos médicos",
      category: "estudiantes",
      source: "local",
      whatsappConsent: true,
      hasSensitiveData: true,
    },
    context
  );

  assert.deepEqual(result.whatsapp, {
    allowed: false,
    reason: "sensitive_data",
  });
});

test("transition service permits only SuperAdmin and persists audit transition", async () => {
  let changes;
  const service = crearServicioTransicionTicket({
    getDocument: async () => ({
      status: "open",
      tenantId: "tenant-1",
      userId: "user-1",
    }),
    updateDocument: async (_id, update) => {
      changes = update;
    },
    now: () => new Date("2026-06-25T11:00:00Z"),
  });

  const result = await service(
    {
      ticketId: "ticket-123",
      nextStatus: "resolved",
      stage: 4,
      videoRoomUrl: "https://meet.example.com/ticket-123",
    },
    {
      auth: {
        uid: "master-1",
        token: { tenantId: "master", rol: "SuperAdmin" },
      },
      app: { appId: "app-1" },
    }
  );

  assert.equal(changes.status, "resolved");
  assert.equal(changes.stage, 4);
  assert.equal(changes.videoRoomUrl, "https://meet.example.com/ticket-123");
  assert.equal(changes.lastTransition.actorId, "master-1");
  assert.deepEqual(result, { ticketId: "ticket-123", status: "resolved" });
});
