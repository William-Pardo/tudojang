const crypto = require("node:crypto");

const obtenerValor = (data, propertyPath) =>
  propertyPath.split(".").reduce((value, key) => value?.[key], data);

const verificarFirmaEventoWompi = (event, secret) => {
  const properties = event?.signature?.properties;
  const receivedChecksum = event?.signature?.checksum;
  if (
    !secret ||
    !Array.isArray(properties) ||
    properties.length === 0 ||
    !receivedChecksum ||
    event?.timestamp === undefined
  ) {
    return false;
  }

  const values = properties.map((property) =>
    obtenerValor(event.data, property)
  );
  if (values.some((value) => value === undefined || value === null)) {
    return false;
  }

  const payload = `${values.join("")}${event.timestamp}${secret}`;
  const expectedChecksum = crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");

  const expected = Buffer.from(expectedChecksum.toLowerCase());
  const received = Buffer.from(String(receivedChecksum).toLowerCase());
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};

module.exports = { verificarFirmaEventoWompi };
