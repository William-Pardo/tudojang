const test = require("node:test");
const assert = require("node:assert/strict");
const { enviarCorreo } = require("./email");

test("enviarCorreo returns the Resend message id", async () => {
  const resend = {
    emails: {
      send: async () => ({ data: { id: "email_123" }, error: null }),
    },
  };

  assert.equal(await enviarCorreo(resend, { to: ["test@example.com"] }), "email_123");
});

test("enviarCorreo throws when Resend rejects the message", async () => {
  const resend = {
    emails: {
      send: async () => ({
        data: null,
        error: { message: "Domain is not verified", name: "validation_error" },
      }),
    },
  };

  await assert.rejects(
    () => enviarCorreo(resend, { to: ["test@example.com"] }),
    /Domain is not verified/
  );
});
