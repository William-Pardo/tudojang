const functions = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const { manejarRequest } = require("./http");
const { enviarCorreo } = require("./email");
const { verificarFirmaEventoWompi } = require("./wompi");
const { crearServicioFirmaCheckoutWompi } = require("./wompiIntegrity");
const { construirAdvertenciaReferenciaDuplicada } = require("./deteccionDuplicadosPago");
const {
  crearServicioCrearFuentePagoWompi,
  crearServicioCobroAutomaticoMensual,
  crearListadoTenantsPendientesDeCobroFirestore,
  crearLectorWompiPaymentSourceIdFirestore,
  crearContadorEstudiantesFacturablesFirestore,
  crearTransaccionRecurrenteWompi,
} = require("./wompiCobroAutomatico");
// SDD pricing-cupo-real (Bloque 3b, D5 "Growth guardrail placement"): guardrail de
// crecimiento/caida anomala de matricula, notify-only. `crearContadorEstudiantesFacturablesFirestore`
// se renombra al importar -- este modulo define su PROPIA copia independiente de esa misma
// query (ver comentario en vigilanciaFacturacion.js), y ambos exports comparten nombre.
const {
  crearServicioVigilarCrecimientoFacturable,
  crearListadoTenantsFirestore,
  crearContadorEstudiantesFacturablesFirestore: crearContadorFacturablesVigilanciaFirestore,
  crearLectorHistorialVigilanciaFirestore,
  crearGuardadorHistorialVigilanciaFirestore,
} = require("./vigilanciaFacturacion");
const {
  validarTenantParaProvision,
  validarEvidenciaPagoParaActivacion,
} = require("./onboardingSecurity");
const catalogoSoporte = require("./generated/soporte/catalogo.v1.json");
const {
  crearServicioAsistente,
  crearHandlerCallable,
} = require("./asistente/callable");
const { crearProveedorGemini } = require("./asistente/proveedor");
const {
  crearAlmacenCuotasFirestore,
  reservarCuota,
  reconciliarCuota,
} = require("./asistente/cuotas");
const {
  calcularCostoMicros,
  estimarReservaMicros,
} = require("./asistente/costos");
const {
  estaIaHabilitada,
  obtenerPeriodoMensual,
} = require("./asistente/runtime");
const {
  crearServicioTickets,
  crearServicioTransicionTicket,
} = require("./asistente/escalamiento");
const { crearEventoTelemetria } = require("./asistente/telemetria");
const {
  crearServicioInviteUser,
  crearServicioAcceptInvitation,
} = require("./academico/invitaciones");
const {
  crearServicioConnectDrive,
  crearServicioDriveOAuthCallback,
  crearServicioListDriveFolder,
  crearServicioDisconnectDrive,
  crearServicioGetDriveConnection,
  crearServicioSetDriveFolder,
  crearServicioGetTemporaryFileUrl,
  crearServicioGetTemporaryFileUrlRecurso,
  crearServicioProxyDriveMedia,
  crearServicioSyncDriveMetadata,
} = require("./academico/drive");
const {
  crearServicioPublishAsignacion,
  crearServicioPublishAsignacionesBatch,
} = require("./academico/asignaciones");
const {
  crearServicioRegistrarAsistencia,
  debugPerteneceAEjecucion,
} = require("./academico/asistencia");
const {
  crearServicioVencerAsignaciones,
  crearListadoAsignacionesFirestore,
} = require("./academico/asignacionesScheduler");
const {
  crearServicioConsolidateProgress,
  crearAdaptadorConsolidateProgressFirestore,
} = require("./academico/progreso");
const {
  crearServicioActualizarUsuarioStaff,
} = require("./academico/usuarios");
const {
  crearServicioCreateSede,
  crearServicioUpdateSede,
  crearServicioDeleteSede,
} = require("./academico/sedes");
const {
  crearServicioRepararSedesEjecucionPrograma,
} = require("./academico/repararSedes");
const {
  crearServicioCrearEstudiante,
} = require("./academico/estudiantes");
const {
  crearServicioSolicitudCarnets,
  crearServicioActualizarEstadoSolicitudCarnets,
} = require("./academico/carnets");
const {
  crearServicioResolverTenantPublico,
} = require("./academico/tenantPublico");
const {
  crearServicioActualizarExtrasContratados,
} = require("./academico/capacidad");
const {
  crearServicioIniciarJornadasPorHorario,
  crearListadoJornadasConfirmadasFirestore,
} = require("./academico/jornadasScheduler");
const {
  crearServicioAvisarRecogidaProxima,
  crearDepsRecogidaFirestore,
} = require("./academico/recogidaScheduler");
const {
  crearServicioRecordatoriosPago,
} = require("./academico/recordatoriosPago");
const {
  crearServicioRecordatoriosEstudio,
} = require("./academico/recordatoriosEstudio");
const { aplicaAlEstudiante } = require("./academico/destinatarioAsignacion");
const {
  crearServicioNotificarEventoNuevo,
} = require("./academico/notificarEvento");
const {
  crearServicioSendPasswordReset,
} = require("./academico/passwordReset");
const {
  crearServicioGenerarDatosDemoProgreso,
  crearServicioLimpiarDatosDemoProgreso,
} = require("./academico/datosDemoProgreso");
const { construirHtmlPagoExitoso } = require("./academico/pagoExitosoEmail");

admin.initializeApp();

const emailFunctions = functionsV1.runWith({ secrets: ["RESEND_API_KEY"] });
const paymentFunctions = functionsV1.runWith({
  secrets: [
    "RESEND_API_KEY",
    "WOMPI_EVENTS_SECRET",
    "WOMPI_INTEGRITY_SECRET",
    "WOMPI_PRIVATE_KEY",
  ],
});
const assistantFunctions = functionsV1.runWith({
  secrets: ["GEMINI_API_KEY"],
  enforceAppCheck: true,
});
const geminiFunctions = functionsV1.runWith({
  secrets: ["GEMINI_API_KEY"],
});
const driveFunctions = functionsV1.runWith({
  secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
});
const getResend = () => new Resend(process.env.RESEND_API_KEY);

const PRECIOS_IA = {
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.4,
};
const LIMITES_IA = {
  user: 50_000,
  tenant: 200_000,
  global: 8_000_000,
};
const RESERVA_IA_MICROS = estimarReservaMicros(
  { maxInputTokens: 1_200, maxOutputTokens: 300 },
  PRECIOS_IA,
  4
);
const almacenCuotasIa = crearAlmacenCuotasFirestore(admin.firestore());
const registrarTelemetriaAsistente = async (event) => {
  try {
    await admin
      .firestore()
      .collection("asistente_telemetria")
      .add(crearEventoTelemetria(event));
  } catch (error) {
    console.error("No fue posible registrar telemetria del asistente:", error);
  }
};

const servicioAsistenteIa = crearServicioAsistente({
  enabled: estaIaHabilitada(),
  catalog: catalogoSoporte,
  provider: async (request) => {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    return crearProveedorGemini({ model })(request);
  },
  reserveQuota: async ({ uid, tenantId }) => {
    const reservation = await reservarCuota(almacenCuotasIa, {
      uid,
      tenantId,
      period: obtenerPeriodoMensual(),
      estimatedMicros: RESERVA_IA_MICROS,
      limits: LIMITES_IA,
    });
    return { reservation, remaining: reservation.remaining };
  },
  reconcileQuota: (reservation, actualMicros) =>
    reconciliarCuota(almacenCuotasIa, reservation, actualMicros),
  calculateActualCost: (usage) => calcularCostoMicros(usage, PRECIOS_IA),
  recordTelemetry: registrarTelemetriaAsistente,
});

exports.consultarAsistenteIa = assistantFunctions.https.onCall(
  crearHandlerCallable(servicioAsistenteIa)
);

const registrarTelemetriaEscalamiento = async ({
  uid,
  tenantId,
  escalationReason,
}) =>
  admin.firestore().collection("asistente_telemetria").add(
    crearEventoTelemetria({
      uid,
      tenantId,
      source: "human",
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      quotaOutcome: "not_applicable",
      escalationReason,
    })
  );

const servicioCrearTicket = crearServicioTickets({
  createDocument: async (ticket) => {
    const document = await admin
      .firestore()
      .collection("tickets_soporte")
      .add(ticket);
    await registrarTelemetriaEscalamiento({
      uid: ticket.userId,
      tenantId: ticket.tenantId,
      escalationReason: "ticket_created",
    });
    return document.id;
  },
  whatsappPhone: process.env.SUPPORT_WHATSAPP_PHONE || "",
});

const servicioActualizarTicket = crearServicioTransicionTicket({
  getDocument: async (ticketId) => {
    const snapshot = await admin
      .firestore()
      .collection("tickets_soporte")
      .doc(ticketId)
      .get();
    return snapshot.exists ? snapshot.data() : null;
  },
  updateDocument: async (ticketId, changes) => {
    await admin
      .firestore()
      .collection("tickets_soporte")
      .doc(ticketId)
      .update(changes);
    await registrarTelemetriaEscalamiento({
      uid: changes.lastTransition.actorId,
      tenantId: "master",
      escalationReason: `ticket_${changes.status}`,
    });
  },
});

exports.crearTicketSoporteSeguro = functionsV1
  .runWith({ enforceAppCheck: true })
  .https.onCall(
  crearHandlerCallable(servicioCrearTicket)
);
exports.actualizarTicketSoporteSeguro = functionsV1
  .runWith({ enforceAppCheck: true })
  .https.onCall(
  crearHandlerCallable(servicioActualizarTicket)
);

// Servicios Académicos
const servicioInviteUser = crearServicioInviteUser({
  auth: admin.auth(),
  firestore: admin.firestore(),
  enviarCorreo,
  resend: getResend,
  appUrl: process.env.APP_URL || "https://tudojang.com"
});

const servicioAcceptInvitation = crearServicioAcceptInvitation({
  auth: admin.auth(),
  firestore: admin.firestore()
});

// Fix UX de restablecimiento de clave (2026-07-15): reemplaza sendPasswordResetEmail() del
// SDK cliente (correo/paginas genericas de Firebase) por un flujo propio con la plantilla
// HTML del proyecto y redirect a /restablecer-clave en el dominio real.
const servicioSendPasswordReset = crearServicioSendPasswordReset({
  auth: admin.auth(),
  enviarCorreo,
  resend: getResend,
  appUrl: process.env.APP_URL || "https://tudojang.com",
  // Fix 2026-07-15: el nombre real vive en Firestore (estudiante/tutor), no en
  // displayName de Auth (casi nunca seteado -- el correo salía con el prefijo del email).
  // Orden: 1) Estudiante por su propio correo, 2) Tutor vinculado por su correo,
  // 3) usuarios/{uid} para staff (Admin/Editor/Asistente/Maestro).
  resolverNombreReal: async (email, uid) => {
    const fs = admin.firestore();

    let snap = await fs.collection("estudiantes").where("correo", "==", email).limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0].data();
      const nombre = [d.nombres, d.apellidos].filter(Boolean).join(" ").trim();
      if (nombre) return nombre;
    }

    snap = await fs.collection("estudiantes").where("tutor.correo", "==", email).limit(1).get();
    if (!snap.empty) {
      const t = snap.docs[0].data().tutor || {};
      const nombre = [t.nombres, t.apellidos].filter(Boolean).join(" ").trim();
      if (nombre) return nombre;
    }

    const usuarioDoc = await fs.collection("usuarios").doc(uid).get();
    if (usuarioDoc.exists) {
      const u = usuarioDoc.data();
      const nombre = (u.nombreUsuario || [u.nombres, u.apellidos].filter(Boolean).join(" ")).trim();
      if (nombre) return nombre;
    }

    return null;
  },
});

const googleDriveConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
};

const servicioConnectDrive = crearServicioConnectDrive({
  googleDriveConfig
});

const servicioDriveOAuthCallback = crearServicioDriveOAuthCallback({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioListDriveFolder = crearServicioListDriveFolder({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioDisconnectDrive = crearServicioDisconnectDrive({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioGetDriveConnection = crearServicioGetDriveConnection({
  firestore: admin.firestore()
});

const servicioSetDriveFolder = crearServicioSetDriveFolder({
  firestore: admin.firestore()
});

const servicioGetTemporaryFileUrl = crearServicioGetTemporaryFileUrl({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioGetTemporaryFileUrlRecurso = crearServicioGetTemporaryFileUrlRecurso({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioProxyDriveMedia = crearServicioProxyDriveMedia({
  googleDriveConfig,
  firestore: admin.firestore(),
  auth: admin.auth()
});

const servicioSyncDriveMetadata = crearServicioSyncDriveMetadata({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioPublishAsignacion = crearServicioPublishAsignacion({
  firestore: admin.firestore()
});

const servicioPublishAsignacionesBatch = crearServicioPublishAsignacionesBatch({
  firestore: admin.firestore()
});

const servicioRegistrarAsistencia = crearServicioRegistrarAsistencia({
  firestore: admin.firestore()
});

const servicioActualizarUsuarioStaff = crearServicioActualizarUsuarioStaff({
  firestore: admin.firestore()
});

const servicioCreateSede = crearServicioCreateSede({
  firestore: admin.firestore()
});

const servicioUpdateSede = crearServicioUpdateSede({
  firestore: admin.firestore()
});

const servicioDeleteSede = crearServicioDeleteSede({
  firestore: admin.firestore()
});

const servicioRepararSedesEjecucionPrograma = crearServicioRepararSedesEjecucionPrograma({
  firestore: admin.firestore()
});

const servicioCrearEstudiante = crearServicioCrearEstudiante({
  firestore: admin.firestore()
});

const servicioSolicitudCarnets = crearServicioSolicitudCarnets({
  firestore: admin.firestore()
});

const servicioActualizarEstadoSolicitudCarnets = crearServicioActualizarEstadoSolicitudCarnets({
  firestore: admin.firestore()
});

const servicioResolverTenantPublico = crearServicioResolverTenantPublico({
  firestore: admin.firestore()
});

const servicioActualizarExtrasContratados = crearServicioActualizarExtrasContratados({
  firestore: admin.firestore()
});

const servicioGenerarDatosDemoProgreso = crearServicioGenerarDatosDemoProgreso({
  firestore: admin.firestore()
});
const servicioLimpiarDatosDemoProgreso = crearServicioLimpiarDatosDemoProgreso({
  firestore: admin.firestore()
});

const servicioIniciarJornadasPorHorario = crearServicioIniciarJornadasPorHorario({
  listarJornadasConfirmadas: crearListadoJornadasConfirmadasFirestore(admin.firestore())
});

const servicioAvisarRecogidaProxima = crearServicioAvisarRecogidaProxima(
  crearDepsRecogidaFirestore(admin.firestore())
);

// Compartida entre vencerAsignaciones y recordatoriosEstudio (mismo collectionGroup query).
const listarAsignacionesPublicadasFirestore = crearListadoAsignacionesFirestore(admin.firestore());

const servicioVencerAsignaciones = crearServicioVencerAsignaciones({
  listarAsignacionesPublicadas: listarAsignacionesPublicadasFirestore,
});

const servicioCrearFuentePagoWompi = crearServicioCrearFuentePagoWompi({
  firestore: admin.firestore(),
  wompiPrivateKey: () => process.env.WOMPI_PRIVATE_KEY,
});

// Plan B #1: recordatorios de pago automáticos al buzón (fix tutor-role-end-to-end).
const servicioRecordatoriosPago = crearServicioRecordatoriosPago({
  // Estudiantes con saldo pendiente (single-field range query, auto-indexado).
  listarEstudiantesConSaldo: async () => {
    const snap = await admin.firestore().collection("estudiantes").where("saldoDeudor", ">", 0).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  // Dedup mensual: los recordatorios creados por este cron llevan `periodo` YYYY-MM
  // (single-field, auto-indexado). Devolvemos el set de estudianteId ya notificados.
  estudiantesYaNotificadosEnPeriodo: async (periodo) => {
    const snap = await admin.firestore().collection("historialNotificaciones").where("periodo", "==", periodo).get();
    return new Set(snap.docs.map((d) => d.data().estudianteId).filter(Boolean));
  },
  crearNotificacion: async (n) => {
    await admin.firestore().collection("historialNotificaciones").add(n);
  },
});

// Recordatorios de estudio: nudges a estudiantes/tutores cuando una asignacion esta por
// vencer sin terminar, recien se publico, o el estudiante lleva mucho sin actividad (ver
// functions/academico/recordatoriosEstudio.js). Reusa listarAsignacionesPublicadasFirestore
// (mismo collectionGroup('asignaciones') que ya usa vencerAsignaciones mas abajo) en vez de
// inventar una query nueva. Historial de recordatorios previos: una sola query por
// estudiante (single-field, auto-indexado), filtrando tipo/situacion/asignacion en memoria
// -- mismo criterio que el resto de este archivo, para no depender de indices compuestos.
async function buscarUltimoRecordatorioEstudio(estudianteId, asignacionId, situacion) {
  const snap = await admin.firestore()
    .collection("historialNotificaciones")
    .where("estudianteId", "==", estudianteId)
    .get();

  let masReciente = null;
  for (const doc of snap.docs) {
    const n = doc.data();
    if (n.tipo !== "RecordatorioEstudio") continue;
    if (n.situacion !== situacion) continue;
    if ((n.asignacionId || null) !== (asignacionId || null)) continue;
    if (!masReciente || n.fecha > masReciente.fecha) masReciente = n;
  }
  return masReciente;
}

const servicioRecordatoriosEstudio = crearServicioRecordatoriosEstudio({
  listarAsignacionesVigentes: async () => {
    const snaps = await listarAsignacionesPublicadasFirestore();
    return snaps.map((s) => ({ id: s.id, ...s.data() }));
  },
  listarEstudiantesActivos: async () => {
    const snap = await admin.firestore().collection("estudiantes").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  obtenerAvancePorAsignacion: async (tenantId, estudianteId) => {
    const doc = await admin.firestore()
      .collection("tenants").doc(tenantId)
      .collection("metricasEstudiante").doc(estudianteId)
      .get();
    return doc.exists ? (doc.data().avancePorAsignacion || []) : [];
  },
  obtenerFechaUltimoRecordatorio: async (estudianteId, asignacionId, situacion) => {
    const n = await buscarUltimoRecordatorioEstudio(estudianteId, asignacionId, situacion);
    return n ? n.fecha : undefined;
  },
  obtenerUltimoComentario: async (situacion, estudianteId, asignacionId) => {
    const n = await buscarUltimoRecordatorioEstudio(estudianteId, asignacionId, situacion);
    return n ? n.mensaje : undefined;
  },
  crearNotificacion: async (n) => {
    await admin.firestore().collection("historialNotificaciones").add(n);
  },
  aplicaAlEstudiante,
});

// Plan B #3: al crear un evento, notificar a los estudiantes del tenant (fix tutor-role-end-to-end).
const servicioNotificarEventoNuevo = crearServicioNotificarEventoNuevo({
  listarEstudiantesDelTenant: async (tenantId) => {
    const snap = await admin.firestore().collection("estudiantes").where("tenantId", "==", tenantId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  // Dedup por evento: las notificaciones de este cron llevan `eventoId` (single-field,
  // auto-indexado). Set de estudianteId ya avisados de ese evento.
  estudiantesYaNotificadosDelEvento: async (eventoId) => {
    const snap = await admin.firestore().collection("historialNotificaciones").where("eventoId", "==", eventoId).get();
    return new Set(snap.docs.map((d) => d.data().estudianteId).filter(Boolean));
  },
  crearNotificacion: async (n) => {
    await admin.firestore().collection("historialNotificaciones").add(n);
  },
});

const servicioConsolidateProgress = crearServicioConsolidateProgress({
  ...crearAdaptadorConsolidateProgressFirestore(admin.firestore()),
  // Plan B #2 (fix tutor-role-end-to-end): al completar un material, notificar al buzón.
  // El progreso se llavea por el Auth UID del visor; lo mapeamos a su estudiante por email
  // (correo del estudiante si él vio; tutor.correo si vio el padre). Dedup por material.
  notificarAvance: async ({ tenantId, uid, asignacion, asignacionId }) => {
    try {
      const fs = admin.firestore();
      const user = await admin.auth().getUser(uid).catch(() => null);
      const email = (user && user.email ? user.email : "").toLowerCase().trim();
      if (!email) return;

      let snap = await fs.collection("estudiantes").where("correo", "==", email).get();
      if (snap.empty) snap = await fs.collection("estudiantes").where("tutor.correo", "==", email).get();
      if (snap.empty) return;

      const titulo = asignacion && asignacion.titulo ? asignacion.titulo : "un material";
      // Notificaciones de avance ya creadas para este material (asignacionId es exclusivo de
      // estas; single-field auto-indexado). Dedup por estudianteId en cliente.
      const previas = await fs.collection("historialNotificaciones").where("asignacionId", "==", asignacionId).get();
      const yaNotificados = new Set(previas.docs.map((d) => d.data().estudianteId));

      for (const estDoc of snap.docs) {
        const est = estDoc.data();
        const estudianteId = estDoc.id;
        if (est.tenantId && est.tenantId !== tenantId) continue;
        if (yaNotificados.has(estudianteId)) continue;
        await fs.collection("historialNotificaciones").add({
          // ERR-0011: tenantId requerido por firestore.rules para aislar historialNotificaciones por tenant.
          tenantId,
          estudianteId,
          estudianteNombre: [est.nombres, est.apellidos].filter(Boolean).join(" "),
          tutorNombre: est.tutor ? [est.tutor.nombres, est.tutor.apellidos].filter(Boolean).join(" ") : "",
          destinatario: (est.tutor && est.tutor.correo) || est.correo || "",
          canal: "Email",
          tipo: "AvanceAcademico",
          asignacionId,
          mensaje: `Avance académico: ${est.nombres || "el estudiante"} completó "${titulo}".`,
          leida: false,
          fecha: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("[notificarAvance] no se pudo crear la notificación de avance:", err);
    }
  },
});

exports.inviteUser = emailFunctions.https.onCall(
  crearHandlerCallable(servicioInviteUser)
);

exports.acceptInvitation = functionsV1.https.onCall(
  crearHandlerCallable(servicioAcceptInvitation)
);

// Fix UX de restablecimiento de clave (2026-07-15): NO requiere auth (quien olvido su clave
// no esta logueado). Usa emailFunctions (mismo patron que inviteUser) por el secret de Resend.
exports.sendPasswordReset = emailFunctions.https.onCall(
  crearHandlerCallable(servicioSendPasswordReset)
);

exports.connectDrive = driveFunctions.https.onCall(
  crearHandlerCallable(servicioConnectDrive)
);

exports.driveOAuthCallback = driveFunctions.https.onCall(
  crearHandlerCallable(servicioDriveOAuthCallback)
);

exports.listDriveFolder = driveFunctions.https.onCall(
  crearHandlerCallable(servicioListDriveFolder)
);

exports.disconnectDrive = driveFunctions.https.onCall(
  crearHandlerCallable(servicioDisconnectDrive)
);

exports.getDriveConnection = driveFunctions.https.onCall(
  crearHandlerCallable(servicioGetDriveConnection)
);

exports.setDriveFolder = driveFunctions.https.onCall(
  crearHandlerCallable(servicioSetDriveFolder)
);

exports.getTemporaryFileUrl = driveFunctions.https.onCall(
  crearHandlerCallable(servicioGetTemporaryFileUrl)
);

exports.getTemporaryFileUrlRecurso = driveFunctions.https.onCall(
  crearHandlerCallable(servicioGetTemporaryFileUrlRecurso)
);

exports.proxyDriveMedia = driveFunctions.https.onRequest(servicioProxyDriveMedia);

exports.syncDriveMetadata = driveFunctions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      await servicioSyncDriveMetadata(req, res);
    } catch (err) {
      console.error("Error in syncDriveMetadata:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

exports.publishAsignacion = functionsV1.https.onCall(
  crearHandlerCallable(servicioPublishAsignacion)
);

exports.publishAsignacionesBatch = functionsV1.https.onCall(
  crearHandlerCallable(servicioPublishAsignacionesBatch)
);

exports.registrarAsistenciaJornada = functionsV1.https.onCall(
  crearHandlerCallable(servicioRegistrarAsistencia)
);

exports.debugValidacionAsistencia = functionsV1.https.onCall(
  async (data, context) => {
    if (!context?.auth?.uid) {
      throw new Error('Unauthorized');
    }
    const tenantId = data?.tenantId;
    const jornadaId = data?.jornadaId;
    const estudianteId = data?.estudianteId;
    if (!tenantId || !jornadaId || !estudianteId) {
      throw new Error('tenantId, jornadaId, estudianteId son requeridos');
    }
    const tenant = admin.firestore().collection('tenants').doc(tenantId);
    return debugPerteneceAEjecucion({ firestore: admin.firestore(), tenant, tenantId, jornadaId, estudianteId });
  }
);

exports.actualizarUsuarioStaff = functionsV1.https.onCall(
  crearHandlerCallable(servicioActualizarUsuarioStaff)
);

// Alta/edicion/baja de sedes -- movido a Cloud Function (bug real 2026-07-16: el limite
// de sedes del plan y la unicidad de nombre solo se chequeaban del lado del cliente,
// sin ninguna barrera server-side. Ver academico/sedes.js para el detalle completo).
exports.createSede = functionsV1.https.onCall(
  crearHandlerCallable(servicioCreateSede)
);
exports.updateSede = functionsV1.https.onCall(
  crearHandlerCallable(servicioUpdateSede)
);
exports.deleteSede = functionsV1.https.onCall(
  crearHandlerCallable(servicioDeleteSede)
);

// Reparacion de datos legados (causa raiz real del bug "William Roa no puede hacer
// check-in en Clase en Vivo", sesion 2026-07-28): repara EjecucionPrograma.sedeId que
// quedaron guardados como slug del nombre de la sede en vez del id real -- ver
// academico/repararSedes.js para el detalle completo. Callable de mantenimiento, gateada
// a Admin/SuperAdmin como el resto de operaciones de sedes.
exports.repararSedesEjecucionPrograma = functionsV1.https.onCall(
  crearHandlerCallable(servicioRepararSedesEjecucionPrograma)
);

// Alta segura de estudiantes -- movido a Cloud Function (mismo patron de bug real que
// sedes: el limite del plan, `tenant.limiteEstudiantes` -- que ya incluye plan base +
// addons comprados -- solo se validaba en el boton de la UI, nunca en el servidor. Ver
// academico/estudiantes.js para el detalle completo). `update`/`delete` de estudiantes NO
// cambian: siguen gateados por isInstructor() en firestore.rules, sin pasar por Cloud
// Function (uso mucho mas frecuente que sedes, fuera de alcance de este fix puntual).
exports.crearEstudiante = functionsV1.https.onCall(
  crearHandlerCallable(servicioCrearEstudiante)
);

// La cantidad y el lote de estudiantes se recalculan server-side (nunca se confía en lo que
// mande el cliente) -- ver academico/carnets.js para el detalle completo. `create` en
// `solicitudes_carnets` queda bloqueado en firestore.rules, mismo criterio ya usado para
// `estudiantes`/`sedes`.
exports.solicitarFabricacionCarnets = functionsV1.https.onCall(
  crearHandlerCallable(servicioSolicitudCarnets)
);

// Avanza/rechaza una solicitud existente (solo Master). `solicitudes_carnets` nunca se borra
// -- si se rechaza, revierte `carnetGenerado` en los estudiantes del lote en la MISMA
// transacción para que puedan volver a solicitarse. `update` en `solicitudes_carnets` queda
// bloqueado en firestore.rules: este callable es el único camino de escritura después de
// creada la solicitud.
exports.actualizarEstadoSolicitudCarnets = functionsV1.https.onCall(
  crearHandlerCallable(servicioActualizarEstadoSolicitudCarnets)
);

// Resolucion PUBLICA de tenant por slug (SIN auth) -- ver academico/tenantPublico.js para el
// detalle completo del bug real que esto cierra (visitante anonimo veia "Escuela No
// Encontrada" en vez del formulario/evento publico). A diferencia de crearEstudiante/sedes,
// esta funcion es intencionalmente accesible sin login: es justamente lo que un prospecto sin
// cuenta necesita para llegar al formulario.
exports.resolverTenantPublico = functionsV1.https.onCall(
  crearHandlerCallable(servicioResolverTenantPublico)
);

// SDD pricing-cupo-real (D7, design.md): unico writer de sedesExtraContratadas/
// equipoTecnicoExtraContratado en tenants/{tenantId} -- antes un updateDoc(increment(...))
// directo del cliente (servicios/configuracionApi.ts::actualizarCapacidadClub), ahora
// bloqueado sin excepcion por firestore.rules (camposFacturacionInmutables()). Ver
// academico/capacidad.js para el detalle completo.
exports.actualizarExtrasContratados = functionsV1.https.onCall(
  crearHandlerCallable(servicioActualizarExtrasContratados)
);

// Sembrado/limpieza de datos DEMO para el panel "Progreso por Estudiante" (pedido
// puntual 2026-07-15 para la presentación a padres de Gajog). Ver
// academico/datosDemoProgreso.js para el detalle y el porqué de que viva en una
// Cloud Function (las reglas de Firestore no permiten escribir metricasEstudiante
// de otro estudiante desde el cliente, ni siquiera como Admin).
exports.generarDatosDemoProgreso = functionsV1.https.onCall(
  crearHandlerCallable(servicioGenerarDatosDemoProgreso)
);
exports.limpiarDatosDemoProgreso = functionsV1.https.onCall(
  crearHandlerCallable(servicioLimpiarDatosDemoProgreso)
);

exports.vencerAsignacionesAcademicas = functionsV1.pubsub
  .schedule("every day 02:00")
  .timeZone("America/Bogota")
  .onRun(async () => servicioVencerAsignaciones(new Date()));

// Auto-transicion confirmada -> en_curso por horario (decision 2026-07-11, pedido
// explicito del usuario). Cada 5 min, solo entre 7am y 9pm hora Bogota (fuera de ese
// rango no hay clases programadas segun la grilla de Agenda, no vale la pena invocar).
exports.iniciarJornadasPorHorario = functionsV1.pubsub
  .schedule("*/5 7-21 * * *")
  .timeZone("America/Bogota")
  .onRun(async () => servicioIniciarJornadasPorHorario(new Date()));

// WS-3b (Clase en Vivo §8): avisa a los acudientes de los chicos de RECOGIDA que la clase
// esta por terminar (a horaFin-15), para que lleguen a tiempo. Misma cadencia/ventana horaria
// que el inicio automatico (cada 5 min, 7am-9pm Bogota). Idempotente por jornada. Los de ruta
// de bus se avisan en el check-out (WS-3a), no aca.
exports.avisarRecogidaProxima = functionsV1.pubsub
  .schedule("*/5 7-21 * * *")
  .timeZone("America/Bogota")
  .onRun(async () => servicioAvisarRecogidaProxima(new Date()));

// Plan B #1 (fix tutor-role-end-to-end): recordatorios de pago diarios al buzón del consultor.
// Una vez al día (8am Bogota); crea UNA notificación por estudiante con saldo pendiente por mes.
exports.recordatoriosPagoDiarios = functionsV1.pubsub
  .schedule("every day 08:00")
  .timeZone("America/Bogota")
  .onRun(async () => servicioRecordatoriosPago(new Date()));

// Recordatorios de estudio diarios al buzón de estudiantes/tutores (ver
// functions/academico/recordatoriosEstudio.js). Misma cadencia que recordatoriosPagoDiarios;
// el cooldown por situacion (24h/una vez/7 dias) evita que se repita el mismo aviso a diario.
exports.recordatoriosEstudioDiarios = functionsV1.pubsub
  .schedule("every day 08:00")
  .timeZone("America/Bogota")
  .onRun(async () => servicioRecordatoriosEstudio(new Date()));

// Plan B #3 (fix tutor-role-end-to-end): trigger al crear un evento -> notifica al buzón de los
// estudiantes del tenant (con inscripción abierta). Try/catch para no fallar la creación del evento.
exports.notificarEventoNuevo = functionsV1.firestore
  .document("eventos/{eventoId}")
  .onCreate(async (snap, context) => {
    try {
      return await servicioNotificarEventoNuevo(snap.data(), context.params.eventoId, new Date());
    } catch (err) {
      console.error("[notificarEventoNuevo] error:", err);
      return null;
    }
  });

exports.consolidateProgress = functionsV1.https.onCall(
  crearHandlerCallable(servicioConsolidateProgress)
);

exports.firmarCheckoutWompi = paymentFunctions.https.onCall(
  crearHandlerCallable(
    crearServicioFirmaCheckoutWompi({
      integritySecret: () => process.env.WOMPI_INTEGRITY_SECRET,
    })
  )
);

// Crea un payment_source reutilizable en Wompi a partir de un token de tarjeta ya
// tokenizado en el frontend, y deja al tenant listo para el cobro automático mensual
// (cobroAutomaticoMensual, más abajo). Ver functions/wompiCobroAutomatico.js.
exports.crearFuentePagoWompi = paymentFunctions.https.onCall(
  crearHandlerCallable(servicioCrearFuentePagoWompi)
);

const cors = require("cors")({ origin: true });

const verificarDestinatario = async (email) => {
  if (!email) return false;
  const emailLimpio = email.toLowerCase().trim();

  // Whitelist de SuperAdmins (Control Maestro)
  const superAdmins = ['aliantlab@gmail.com', 'gengepardo@gmail.com'];
  if (superAdmins.includes(emailLimpio)) return true;

  // 1. Verificar en Usuarios (Tenants y Staff - Admin, Editor, Asistente)
  const userSnap = await admin.firestore().collection('usuarios')
    .where('email', '==', emailLimpio)
    .limit(1).get();
  if (!userSnap.empty) return true;

  return false;
};

const MASTER_EMAIL = 'aliantlab@gmail.com';

/**
 * Estilos comunes para plantillas Premium
 */
const ESTILOS_EMAIL = `
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid #eef2f6;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
`;

const HEADER_HTML = (titulo) => `
  <div style="background: linear-gradient(135deg, #0047A0 0%, #002D62 100%); padding: 40px 20px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">🥋 Tudojang</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 2px;">${titulo}</p>
  </div>
`;

const FOOTER_HTML = `
  <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Soporte Prioritario: info@tudojang.com</p>
    <p style="margin: 10px 0 0 0; font-size: 11px; color: #94a3b8;">&copy; 2026 Tudojang SaaS Core v4.5 • Aliant Lab Architecture</p>
  </div>
`;

exports.provisionarUsuarioOnboarding = emailFunctions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { tenantId, email, password, nombreClub } = data;
    if (!email || !password || !tenantId) throw new Error('Faltan parámetros');

    const tenantSnap = await admin.firestore().collection('tenants').doc(tenantId).get();
    validarTenantParaProvision({ tenant: tenantSnap, tenantId, email });

    console.log(`Provisionando usuario: ${email}`);
    let user;
    try {
      user = await admin.auth().createUser({
        uid: tenantId,
        email: email,
        password: password,
        displayName: nombreClub
      });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        user = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(user.uid, { password: password });
      } else { throw e; }
    }

    await admin.firestore().collection('usuarios').doc(user.uid).set({
      id: user.uid,
      email: email,
      nombreUsuario: nombreClub,
      rol: 'Admin',
      tenantId: tenantId,
      estadoContrato: 'Pendiente de Pago',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notificar a Master sobre nuevo Tenant
    await enviarCorreo(getResend(), {
      from: "Tudojang System <sistema@tudojang.com>",
      to: [MASTER_EMAIL],
      subject: `🚨 NUEVO TENANT: ${nombreClub}`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Alerta Master Control')}
          <div style="padding: 30px;">
            <p>Se ha registrado una nueva academia:</p>
            <ul>
              <li><strong>Nombre:</strong> ${nombreClub}</li>
              <li><strong>Email Admin:</strong> ${email}</li>
              <li><strong>Tenant ID:</strong> ${tenantId}</li>
            </ul>
          </div>
        </div>
      `
    });

    return { success: true, uid: user.uid };
  });
});

exports.activarSuscripcionManual = functionsV1.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { tenantId, email, transactionId } = data;
    console.log(`Activación manual para: ${tenantId}`);

    const tenantRef = admin.firestore().collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    validarEvidenciaPagoParaActivacion({
      tenant: tenantSnap,
      tenantId,
      email,
      transactionId,
    });

    // No se recalcula fechaVencimiento acá: la fuente de verdad es el webhook de Wompi
    // (webhookWompi), que ya corrió antes de llegar a este punto (lo exige la validación
    // de arriba) y ya dejó fechaVencimiento correctamente calculada según el período real
    // de la compra (mensual/anual).
    await tenantRef.update({
      estadoSuscripcion: 'activo'
    });

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.firestore().collection('usuarios').doc(userRecord.uid).update({
      estadoContrato: 'Activo'
    });

    return { success: true };
  });
});

exports.enviarBienvenidaTudojang = emailFunctions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub, passwordTemporal } = data;

    if (!(await verificarDestinatario(email))) {
      throw new Error(`Acceso restringido: El destinatario ${email} no es un usuario o estudiante registrado.`);
    }

    await enviarCorreo(getResend(), {
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: `🥋 ¡Bienvenido a la Élite, ${nombreClub}!`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Acceso Activado')}
          <div style="padding: 40px 30px;">
            <h2 style="color: #0047A0; margin-top: 0;">¡Hola, Sabonim!</h2>
            <p>Es un honor darte la bienvenida a <b>Tudojang</b>. Tu academia <b>${nombreClub}</b> ya tiene su centro de mando digital listo para operar.</p>
            <div style="background: #f1f5f9; padding: 25px; border-radius: 16px; margin: 30px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Credenciales de Acceso</p>
              <p style="margin: 0; font-size: 16px;"><strong>Usuario:</strong> ${email}</p>
              <p style="margin: 5px 0 0 0; font-size: 16px;"><strong>Clave Temporal:</strong> <code style="background: #ffffff; padding: 4px 8px; border-radius: 6px; color: #CD2E3A; border: 1px solid #cbd5e1;">${passwordTemporal}</code></p>
            </div>
            <p>Te recomendamos cambiar tu contraseña en el primer inicio de sesión.</p>
            <div style="text-align: center; margin-top: 40px;">
              <a href="https://tudojang.com/#/login" style="background: #0047A0; color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 14px; text-transform: uppercase; display: inline-block; transition: all 0.3s ease;">Entrar al Dojang</a>
            </div>
          </div>
          ${FOOTER_HTML}
        </div>
      `
    });
    return { success: true };
  });
});

exports.webhookWompi = paymentFunctions.https.onRequest(async (req, res) => {
  const { event, data } = req.body;
  console.log("Webhook recibido:", event);

  if (!verificarFirmaEventoWompi(req.body, process.env.WOMPI_EVENTS_SECRET)) {
    return res.status(401).json({ error: "Firma de evento inválida" });
  }

  if (event === 'transaction.updated' && data.transaction.status === 'APPROVED') {
    const ref = data.transaction.reference;
    const monto = data.transaction.amount_in_cents;
    const montoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(monto / 100);

    // Notificar a Master sobre pago recibido
    await enviarCorreo(getResend(), {
      from: "Tudojang Finanzas <pagos@tudojang.com>",
      to: [MASTER_EMAIL],
      subject: `💰 PAGO RECIBIDO (${montoFormateado}): ${ref}`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Notificación de Ingreso')}
          <div style="padding: 30px;">
            <h2>Pago Aprobado en Wompi</h2>
            <p><strong>Referencia:</strong> ${ref}</p>
            <p><strong>Monto:</strong> ${montoFormateado}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    });

    if (ref && (ref.startsWith('SUSC_') || ref.startsWith('tnt-'))) {
      // Fix inconsistencia de referencia (2026-07-15): con el checkout unificado el reference
      // tiene el formato SUSC_<tenantId>_<itemType>_<itemId>_<periodo>_<timestamp>, pero
      // formatos viejos/desconocidos podían tener otra cantidad de segmentos. El tenantId
      // SIEMPRE tiene forma tnt-<dígitos> (nunca contiene "_"), así que se extrae por patrón
      // en vez de por índice fijo de split (que solo funcionaba para el formato legacy).
      const tenantIdMatch = ref.match(/tnt-\d+/);
      const tId = tenantIdMatch ? tenantIdMatch[0] : ref;
      const segmentosRef = ref.split('_');
      const periodoRef = segmentosRef.includes('anual')
        ? 'anual'
        : (segmentosRef.includes('mensual') ? 'mensual' : null);

      try {
        const tSnap = await admin.firestore().collection('tenants').doc(tId).get();
        if (tSnap.exists) {
          const tenantData = tSnap.data();

          // La fecha de vencimiento depende del período real comprado (antes eran siempre
          // "hoy + 31 días" fijos sin importar mensual/anual). Un pago anual debe cubrir 12
          // meses calendario; si el período no se puede determinar (referencia en formato
          // viejo/desconocido) se asume mensual.
          const hoy = new Date();
          const fechaVencimiento = periodoRef === 'anual'
            ? new Date(hoy.getFullYear(), hoy.getMonth() + 12, hoy.getDate())
            : new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());

          // 1. Activar Suscripción
          await admin.firestore().collection('tenants').doc(tId).update({
            estadoSuscripcion: 'activo',
            fechaVencimiento: admin.firestore.Timestamp.fromDate(fechaVencimiento),
            // Resetea el contador de fallos de cobro automático en CUALQUIER pago exitoso
            // reconciliado por este webhook (manual o del cron cobroAutomaticoMensual) --
            // inofensivo si el tenant no usa cobro automático (queda en 0 sin efecto).
            cobroAutomaticoIntentosFallidos: 0,
            ultimoPagoWompi: {
              transactionId: data.transaction.id,
              status: data.transaction.status,
              reference: ref,
              amountInCents: monto,
              verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            }
          });

          // 2. Activar Usuario Admin
          const uSnap = await admin.firestore().collection('usuarios').where('tenantId', '==', tId).limit(1).get();
          let adminData = null;
          if (!uSnap.empty) {
            adminData = uSnap.docs[0].data();
            await uSnap.docs[0].ref.update({ estadoContrato: 'Activo' });
          }

          // 3. ENVIAR EMAIL DE PAGO EXITOSO (comprobante + bienvenida)
          if (tenantData.emailClub && tenantData.passwordTemporal) {
            console.log(`Enviando email de pago exitoso desde Webhook a: ${tenantData.emailClub}`);
            try {
              await enviarCorreo(getResend(), {
                from: "Tudojang Academia <info@tudojang.com>",
                to: [tenantData.emailClub],
                subject: `🥋 ¡Pago Confirmado: ${tenantData.nombreClub}!`,
                html: construirHtmlPagoExitoso({
                  nombreUsuario: (adminData && adminData.nombreUsuario) || tenantData.emailClub,
                  nombreAcademia: tenantData.nombreClub,
                  montoPagado: montoFormateado.replace(/\s/g, ''),
                  fechaPago: hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
                })
              });
            } catch (emailErr) {
              console.error("Error enviando email desde webhook:", emailErr);
            }
          }
          console.log("Activado y notificado via Webhook exitosamente");
        }
      } catch (err) { console.error("Error en webhook:", err); }
    }
  }
  res.status(200).send('OK');
});

// HTML del email de aviso al tenant cuando el cobro automático falla 3 veces seguidas y
// se suspende la suscripción. Reusa ESTILOS_EMAIL/HEADER_HTML/FOOTER_HTML ya definidos
// arriba (mismos helpers que provisionarUsuarioOnboarding/enviarBienvenidaTudojang).
const construirHtmlFalloCobroAutomatico = (nombreClub) => `
  <div style="${ESTILOS_EMAIL}">
    ${HEADER_HTML('Cobro Automático Fallido')}
    <div style="padding: 30px;">
      <h2 style="color: #CD2E3A; margin-top: 0;">No pudimos procesar tu pago</h2>
      <p>Intentamos cobrar automáticamente la suscripción de <b>${nombreClub || 'tu academia'}</b> en Tudojang 3 veces y no fue posible completar el pago.</p>
      <p>Tu suscripción quedó <b>suspendida</b>. Por favor actualizá tu método de pago o contactá a soporte para reactivarla.</p>
      <p style="margin-top: 30px;">Soporte: <a href="mailto:info@tudojang.com">info@tudojang.com</a></p>
    </div>
  </div>
`;

// HTML del email de alerta del guardrail de crecimiento/caida anomala de matricula (D5,
// design.md) -- SOLO para el rol SuperAdmin (MASTER_EMAIL), nunca para el tenant. Reusa
// ESTILOS_EMAIL/HEADER_HTML/FOOTER_HTML igual que construirHtmlFalloCobroAutomatico arriba.
const NOMBRES_SENALES = {
  s1: 'Crecimiento acelerado (duplicación sobre una base no trivial)',
  s2: 'Salto de un solo día (+100 o más)',
  s3: 'Caída sospechosa cerca del corte de facturación',
};

const construirHtmlAlertaVigilanciaFacturacion = ({ tenantId, tenant, nHoy, nAyer, nHace7d, diasHastaCorte, senales }) => {
  const senalesDisparadas = Object.entries(senales)
    .filter(([clave, valor]) => valor === true && NOMBRES_SENALES[clave])
    .map(([clave]) => NOMBRES_SENALES[clave]);

  return `
    <div style="${ESTILOS_EMAIL}">
      ${HEADER_HTML('Vigilancia de Facturación')}
      <div style="padding: 30px;">
        <h2 style="color: #CD2E3A; margin-top: 0;">Crecimiento/caída anómala detectada</h2>
        <p><b>Tenant:</b> ${tenant?.nombreClub || tenantId} (${tenantId})</p>
        <ul>
          ${senalesDisparadas.map((s) => `<li>${s}</li>`).join('')}
        </ul>
        <p><b>Estudiantes facturables hoy:</b> ${nHoy}</p>
        <p><b>Ayer:</b> ${nAyer ?? 'sin dato'} · <b>Hace 7 días:</b> ${nHace7d ?? 'sin dato'}</p>
        <p><b>Días hasta el corte de facturación:</b> ${diasHastaCorte ?? 'sin fecha de vencimiento'}</p>
        <p style="margin-top: 20px; font-size: 13px; color: #64748b;">Esto es solo informativo -- el club NO fue notificado ni bloqueado. Revisión manual recomendada.</p>
      </div>
    </div>
  `;
};

// Cron de cobro automático mensual (mecanismo de suscripción recurrente sobre Wompi
// Colombia, que no tiene suscripciones nativas -- ver functions/wompiCobroAutomatico.js).
// Corre una vez al día: entre corridas, cualquier tenant con fechaVencimiento vencida
// sigue vencido hasta un cobro exitoso, así que basta una pasada diaria (mismo criterio
// de frecuencia que vencerAsignacionesAcademicas/recordatoriosPagoDiarios arriba).
const listarTenantsPendientesDeCobroFirestore = crearListadoTenantsPendientesDeCobroFirestore(
  admin.firestore()
);
const obtenerWompiPaymentSourceIdFirestore = crearLectorWompiPaymentSourceIdFirestore(
  admin.firestore()
);
// SDD pricing-cupo-real (Bloque 3b, facturacion-metered): agregación .count() (no un .get()
// completo -- ver functions/wompiCobroAutomatico.js) sobre estudiantes activos del tenant.
const contarEstudiantesFacturablesFirestore = crearContadorEstudiantesFacturablesFirestore(
  admin.firestore()
);
const servicioCobroAutomaticoMensual = crearServicioCobroAutomaticoMensual({
  // listarTenantsPendientesDeCobroFirestore ya filtra en memoria por fechaVencimiento
  // (normalizarFecha soporta tanto Timestamp -- como la escribe webhookWompi -- como
  // string 'YYYY-MM-DD' -- como la escribe el frontend al crear el tenant -- así que le
  // pasamos `ahora` tal cual, sin envolverlo en Timestamp).
  listarTenantsPendientesDeCobro: (ahora) => listarTenantsPendientesDeCobroFirestore(ahora),
  // wompiPaymentSourceId ya no vive en tenants/{tenantId} raíz (fix seguridad 2026-07-18) --
  // se lee del subdocumento privado tenants/{tenantId}/privado/facturacion.
  obtenerWompiPaymentSourceId: (tenantId) => obtenerWompiPaymentSourceIdFirestore(tenantId),
  // Fix facturacion-periodo-vs-snapshot: se le pasa la propia fechaVencimiento del tenant --
  // es el input que contarEstudiantesFacturablesFirestore necesita para calcular el inicio
  // del período actual (ya no es solo una foto puntual del momento del corte).
  contarEstudiantesFacturables: (tenantId, fechaVencimiento) =>
    contarEstudiantesFacturablesFirestore(tenantId, fechaVencimiento),
  crearTransaccionWompi: (args) =>
    crearTransaccionRecurrenteWompi({ ...args, wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY }),
  actualizarTenant: (tenantId, datos) =>
    admin.firestore().collection('tenants').doc(tenantId).update(datos),
  incrementarUno: () => admin.firestore.FieldValue.increment(1),
  enviarCorreoFalloPago: async (tenant) => {
    if (!tenant?.emailClub) return;
    await enviarCorreo(getResend(), {
      from: "Tudojang Academia <info@tudojang.com>",
      to: [tenant.emailClub],
      subject: `⚠️ Suscripción suspendida: no pudimos cobrar ${tenant.nombreClub || 'tu academia'}`,
      html: construirHtmlFalloCobroAutomatico(tenant.nombreClub),
    });
  },
});

exports.cobroAutomaticoMensual = paymentFunctions.pubsub
  .schedule("every 24 hours")
  .timeZone("America/Bogota")
  .onRun(async () => servicioCobroAutomaticoMensual(new Date()));

// SDD pricing-cupo-real (Bloque 3b, D5 "Growth guardrail placement"): guardrail diario de
// crecimiento/caída anómala de matrícula facturable -- SOLO notifica al rol SuperAdmin
// (MASTER_EMAIL, mismo destinatario ya usado para "Notificar a Master sobre nuevo Tenant" y
// "MISIÓN KICHO LEGALIZADA" más arriba en este archivo -- el Open Question de design.md sobre
// `SOPORTE_PLATAFORMA_EMAIL` queda resuelto reusando esta constante ya cableada, en vez de
// introducir `info@tudojang.com` -- que en este archivo siempre se usa como remitente hacia
// TENANTS, nunca como destinatario de alertas de plataforma). NUNCA bloquea ni revierte
// ninguna matrícula (capacidad-tenant, Scenario "Crecimiento anómalo dispara alerta, no
// bloqueo").
const listarTenantsVigilanciaFirestore = crearListadoTenantsFirestore(admin.firestore());
const contarFacturablesVigilanciaFirestore = crearContadorFacturablesVigilanciaFirestore(
  admin.firestore()
);
const leerHistorialVigilanciaFirestore = crearLectorHistorialVigilanciaFirestore(
  admin.firestore()
);
const guardarHistorialVigilanciaFirestore = crearGuardadorHistorialVigilanciaFirestore(
  admin.firestore()
);
const servicioVigilarCrecimientoFacturable = crearServicioVigilarCrecimientoFacturable({
  listarTenants: () => listarTenantsVigilanciaFirestore(),
  // Fix facturacion-periodo-vs-snapshot: se le pasa la propia fechaVencimiento del tenant --
  // es el input que contarFacturablesVigilanciaFirestore necesita para calcular el inicio
  // del período actual (ya no es solo una foto puntual del momento de la corrida diaria).
  contarEstudiantesFacturables: (tenantId, fechaVencimiento) =>
    contarFacturablesVigilanciaFirestore(tenantId, fechaVencimiento),
  leerHistorialVigilancia: (tenantId) => leerHistorialVigilanciaFirestore(tenantId),
  guardarHistorialVigilancia: (tenantId, datos) => guardarHistorialVigilanciaFirestore(tenantId, datos),
  notificarAlerta: async (payload) => {
    await enviarCorreo(getResend(), {
      from: "Tudojang Vigilancia <info@tudojang.com>",
      to: [MASTER_EMAIL],
      subject: `⚠️ Crecimiento/caída anómala de matrícula: ${payload.tenant?.nombreClub || payload.tenantId}`,
      html: construirHtmlAlertaVigilanciaFacturacion(payload),
    });
  },
});

exports.vigilarCrecimientoFacturable = emailFunctions.pubsub
  .schedule("every day 07:00")
  .timeZone("America/Bogota")
  .onRun(async () => servicioVigilarCrecimientoFacturable(new Date()));

/**
 * TRIGGER: Analizar comprobante de pago con IA (Gemini 2.5 Flash-Lite)
 * Se activa cuando un estudiante sube un reporte de pago.
 */
exports.analizarComprobanteEstudiante = geminiFunctions.firestore
  .document('reportes_pagos_estudiantes/{reporteId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const reporteId = context.params.reporteId;

    // ERR-0017 regression guard: reportarPagoEstudiante (servicios/pagosEstudiantesApi.ts)
    // writes comprobanteUrl in the SAME setDoc that creates this document -- never split it
    // back into addDoc(comprobanteUrl:'') + a LATER updateDoc(comprobanteUrl), or this
    // onCreate trigger fires before the URL exists and the guard below silently discards
    // every real report, forever. See functions/analizarComprobanteEstudiante.test.js.
    if (!data.comprobanteUrl) {
      console.warn(`Reporte ${reporteId} no tiene URL de imagen.`);
      return null;
    }

    try {
      // 1. Cambiar estado a Analizando
      await snap.ref.update({ estado: 'Analizando' });

      // 2. Configurar Gemini (Carga desde Secretos de Firebase)
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se encontró la API Key de Gemini en los secrets de Firebase. Ejecuta: firebase functions:secrets:set gemini_api_key");
      }
      // ERR-0012: gemini-1.5-flash fue deprecado por Google el 2025-09-24 y devuelve 404
      // -- mismo modelo ya usado (y funcionando) en servicioAsistenteIa mas arriba.
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      // 3. Descargar la imagen
      const response = await axios.get(data.comprobanteUrl, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');

      // 4. Prompt estratégico para Nequi/Daviplata/Bancos CO
      const prompt = `Analiza este comprobante de pago de una entidad bancaria Colombiana (Nequi, Daviplata, Bancolombia, etc). 
      Extrae exactamente estos datos en formato JSON puro:
      {
        "referencia": "Identificador único de la operación",
        "montoExtraido": valor numérico sin puntos ni comas,
        "fechaExtraida": "Fecha en formato YYYY-MM-DD",
        "entidad": "Nombre de la app o banco",
        "confianza": valor entre 0 y 1
      }
      Si algún dato no es legible, pon null. No incluyas texto explicativo, solo el JSON.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        }
      ]);

      const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const extractedData = JSON.parse(responseText);

      // 5. Validar coherencia (Monto informado vs Extraído)
      const advertencias = [];
      if (extractedData.montoExtraido && Math.abs(extractedData.montoExtraido - data.montoInformado) > 100) {
        advertencias.push(`Discrepancia de monto: Alumno dice ${data.montoInformado}, IA detectó ${extractedData.montoExtraido}`);
      }

      // 5b. Detectar comprobante duplicado: misma referencia ya usada en un pago APROBADO.
      // Solo compara contra Aprobado (no Pendiente/ValidadoIA) porque en ese punto es el
      // único estado que confirma que el dinero ya fue acreditado a un estudiante.
      // La decisión (¿hay o no duplicado, y qué texto arma?) vive en
      // deteccionDuplicadosPago.js -- pura, testeada sin mockear Firestore.
      if (extractedData.referencia) {
        const dupSnap = await admin.firestore()
          .collection('reportes_pagos_estudiantes')
          .where('tenantId', '==', data.tenantId)
          .where('datosIA.referencia', '==', extractedData.referencia)
          .where('estado', '==', 'Aprobado')
          .get();
        const advertenciaDuplicado = construirAdvertenciaReferenciaDuplicada(extractedData.referencia, dupSnap.docs, reporteId);
        if (advertenciaDuplicado) {
          advertencias.push(advertenciaDuplicado);
        }
      }

      // 6. Actualizar reporte con los datos de IA
      await snap.ref.update({
        estado: 'ValidadoIA',
        datosIA: {
          ...extractedData,
          advertencias: advertencias
        }
      });

      console.log(`Reporte ${reporteId} analizado exitosamente por Gemini.`);
      return { success: true };

    } catch (error) {
      console.error(`Error analizando reporte ${reporteId}:`, error);
      await snap.ref.update({
        estado: 'ErrorIA',
        observaciones: "No se pudo procesar la imagen automáticamente. Verificación manual requerida."
      });
      return null;
    }
  });

/**
 * TRIGGER: Notificar a Master sobre legalización de Misión Kicho
 */
exports.notificarMasterMisionKicho = emailFunctions.firestore
  .document('misiones_kicho/{misionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.estadoLote !== 'legalizado' && after.estadoLote === 'legalizado') {
      await enviarCorreo(getResend(), {
        from: "Tudojang Kicho <kicho@tudojang.com>",
        to: [MASTER_EMAIL],
        subject: `🧧 MISIÓN KICHO LEGALIZADA: ${after.tenantId}`,
        html: `
          <div style="${ESTILOS_EMAIL}">
            ${HEADER_HTML('Censo Masivo Listos')}
            <div style="padding: 30px;">
              <p>El tenant <b>${after.tenantId}</b> ha legalizado un lote de Kicho.</p>
              <p><strong>Registros:</strong> ${after.registrosRecibidos}</p>
              <p><strong>Fecha:</strong> ${after.fechaLegalizacion}</p>
              <p>Ya puedes proceder con la inyección desde el Master Dashboard.</p>
            </div>
          </div>
        `
      });
    }
    return null;
  });

/**
 * TRIGGER: Notificar a Master sobre solicitud de Carnets
 */
exports.notificarMasterSolicitudCarnets = emailFunctions.firestore
  .document('solicitudes_carnets/{solicitudId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await enviarCorreo(getResend(), {
      from: "Tudojang Producción <carnets@tudojang.com>",
      to: [MASTER_EMAIL],
      subject: `🪪 SOLICITUD DE CARNETS: ${data.nombreClub}`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Nueva Solicitud Gráfica')}
          <div style="padding: 30px;">
            <p>La academia <b>${data.nombreClub}</b> solicita la elaboración de carnets.</p>
            <p><strong>Cantidad:</strong> ${data.cantidad}</p>
            <p><strong>Sede:</strong> ${data.sedeNombre || 'Principal'}</p>
            <p>Verifica los perfiles en el panel de carnetización.</p>
          </div>
        </div>
      `
    });
    return null;
  });
