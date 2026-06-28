const test = require("node:test");
const assert = require("node:assert/strict");
const { crearEscalamientoWhatsapp } = require("./whatsapp");

test("WhatsApp transmits only ticket id and category after consent", () => {
  assert.deepEqual(
    crearEscalamientoWhatsapp({
      available: true,
      consent: true,
      hasSensitiveData: false,
      phone: "573001234567",
      ticketId: "TK-123",
      category: "estudiantes",
    }),
    {
      allowed: true,
      url:
        "https://wa.me/573001234567?text=Ticket%20TK-123%20-%20Categor%C3%ADa%3A%20estudiantes",
    }
  );
});

test("WhatsApp is cancelled without consent", () => {
  assert.deepEqual(
    crearEscalamientoWhatsapp({
      available: true,
      consent: false,
      hasSensitiveData: false,
      phone: "573001234567",
      ticketId: "TK-123",
      category: "estudiantes",
    }),
    { allowed: false, reason: "consent_required" }
  );
});

test("WhatsApp is cancelled when sensitive data is present", () => {
  assert.deepEqual(
    crearEscalamientoWhatsapp({
      available: true,
      consent: true,
      hasSensitiveData: true,
      phone: "573001234567",
      ticketId: "TK-123",
      category: "estudiantes",
    }),
    { allowed: false, reason: "sensitive_data" }
  );
});
