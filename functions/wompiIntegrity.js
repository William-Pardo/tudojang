const crypto = require("node:crypto");

const crearError = (code, message) => Object.assign(new Error(message), { code });

const firmarIntegridadCheckoutWompi = (
  { reference, amountInCents, currency },
  integritySecret
) => {
  if (!reference || typeof reference !== "string") {
    throw crearError("invalid-argument", "reference es obligatorio");
  }
  if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    throw crearError("invalid-argument", "amountInCents debe ser un entero positivo");
  }
  if (currency !== "COP") {
    throw crearError("invalid-argument", "currency debe ser COP");
  }
  if (!integritySecret) {
    throw crearError("failed-precondition", "secret de integridad Wompi no configurado");
  }

  return crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}${currency}${integritySecret}`)
    .digest("hex");
};

const crearServicioFirmaCheckoutWompi =
  ({ integritySecret }) =>
  async (data) => ({
    signature: firmarIntegridadCheckoutWompi(
      {
        reference: data?.reference,
        amountInCents: data?.amountInCents,
        currency: data?.currency,
      },
      integritySecret()
    ),
  });

module.exports = {
  crearServicioFirmaCheckoutWompi,
  firmarIntegridadCheckoutWompi,
};
