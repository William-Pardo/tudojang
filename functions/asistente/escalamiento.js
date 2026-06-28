const { obtenerIdentidadConfiable } = require("./autorizacion");
const {
  crearTicketMinimo,
  aplicarTransicionMaster,
} = require("./tickets");
const { crearEscalamientoWhatsapp } = require("./whatsapp");

const crearServicioTickets = ({
  createDocument,
  whatsappPhone,
  now = () => new Date(),
}) => async (data, context) => {
  const identity = obtenerIdentidadConfiable(context);
  const ticket = crearTicketMinimo({
    identity,
    input: data,
    now: now(),
  });
  const ticketId = await createDocument(ticket);
  const whatsapp = crearEscalamientoWhatsapp({
    available: Boolean(whatsappPhone),
    consent: data?.whatsappConsent === true,
    hasSensitiveData: data?.hasSensitiveData === true,
    phone: whatsappPhone,
    ticketId,
    category: ticket.category,
  });

  return { ticketId, source: "human", whatsapp };
};

const crearServicioTransicionTicket = ({
  getDocument,
  updateDocument,
  now = () => new Date(),
}) => async (data, context) => {
  const identity = obtenerIdentidadConfiable(context);
  const ticketId = String(data?.ticketId ?? "").trim();
  if (!ticketId) {
    throw Object.assign(new Error("ticketId es obligatorio"), {
      code: "invalid-argument",
    });
  }
  const ticket = await getDocument(ticketId);
  if (!ticket) {
    throw Object.assign(new Error("Ticket no encontrado"), {
      code: "not-found",
    });
  }

  const changes = aplicarTransicionMaster({
    identity,
    ticket,
    nextStatus: data?.nextStatus,
    now: now(),
  });
  if (data?.stage !== undefined) {
    if (!Number.isInteger(data.stage) || data.stage < 1 || data.stage > 4) {
      throw Object.assign(new Error("Etapa no permitida"), {
        code: "invalid-argument",
      });
    }
    changes.stage = data.stage;
  }
  if (data?.videoRoomUrl) {
    try {
      const url = new URL(data.videoRoomUrl);
      if (url.protocol !== "https:") throw new Error();
      changes.videoRoomUrl = url.toString();
    } catch {
      throw Object.assign(new Error("URL de sala no permitida"), {
        code: "invalid-argument",
      });
    }
  }
  await updateDocument(ticketId, changes);
  return { ticketId, status: changes.status };
};

module.exports = {
  crearServicioTickets,
  crearServicioTransicionTicket,
};
