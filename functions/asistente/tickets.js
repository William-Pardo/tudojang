const { redactarTexto } = require("./redaccion");

const RETENTION_DAYS = 90;
const ALLOWED_SOURCES = new Set(["local", "ai", "human"]);
const ALLOWED_STATUSES = new Set(["open", "in_progress", "resolved"]);

const crearError = (code, message) => Object.assign(new Error(message), { code });

const crearTicketMinimo = ({ identity, input, now = new Date() }) => {
  const category = String(input?.category ?? "").trim().slice(0, 50);
  const summary = redactarTexto(String(input?.summary ?? "").trim()).slice(0, 500);
  const source = ALLOWED_SOURCES.has(input?.source) ? input.source : "local";

  if (!category || !summary) {
    throw crearError("invalid-argument", "Categoría y resumen son obligatorios");
  }

  return {
    userId: identity.uid,
    tenantId: identity.tenantId,
    category,
    summary,
    source,
    status: "open",
    createdAt: now.toISOString(),
    retentionUntil: new Date(
      now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
  };
};

const puedeAccederTicket = (identity, ticket) =>
  identity.rol === "SuperAdmin" ||
  (identity.uid === ticket.userId && identity.tenantId === ticket.tenantId);

const aplicarTransicionMaster = ({
  identity,
  ticket,
  nextStatus,
  now = new Date(),
}) => {
  if (identity.rol !== "SuperAdmin") {
    throw crearError("permission-denied", "Se requiere rol SuperAdmin");
  }
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw crearError("invalid-argument", "Estado no permitido");
  }

  const at = now.toISOString();
  return {
    status: nextStatus,
    updatedAt: at,
    lastTransition: {
      actorId: identity.uid,
      from: ticket.status,
      to: nextStatus,
      at,
    },
  };
};

module.exports = {
  crearTicketMinimo,
  puedeAccederTicket,
  aplicarTransicionMaster,
};
