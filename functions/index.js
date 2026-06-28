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
  crearServicioSyncDriveMetadata,
} = require("./academico/drive");
const {
  crearServicioPublishAsignacion,
} = require("./academico/asignaciones");
const {
  crearServicioVencerAsignaciones,
  crearListadoAsignacionesFirestore,
} = require("./academico/asignacionesScheduler");
const {
  crearServicioConsolidateProgress,
  crearAdaptadorConsolidateProgressFirestore,
} = require("./academico/progreso");

admin.initializeApp();

const emailFunctions = functionsV1.runWith({ secrets: ["RESEND_API_KEY"] });
const paymentFunctions = functionsV1.runWith({
  secrets: ["RESEND_API_KEY", "WOMPI_EVENTS_SECRET", "WOMPI_INTEGRITY_SECRET"],
});
const assistantFunctions = functionsV1.runWith({
  secrets: ["GEMINI_API_KEY"],
  enforceAppCheck: true,
});
const geminiFunctions = functionsV1.runWith({
  secrets: ["GEMINI_API_KEY"],
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
  appUrl: process.env.APP_URL || "https://app.tudojang.com"
});

const servicioAcceptInvitation = crearServicioAcceptInvitation({
  auth: admin.auth(),
  firestore: admin.firestore()
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

const servicioSyncDriveMetadata = crearServicioSyncDriveMetadata({
  googleDriveConfig,
  firestore: admin.firestore()
});

const servicioPublishAsignacion = crearServicioPublishAsignacion({
  firestore: admin.firestore()
});

const servicioVencerAsignaciones = crearServicioVencerAsignaciones({
  listarAsignacionesPublicadas: crearListadoAsignacionesFirestore(admin.firestore())
});

const servicioConsolidateProgress = crearServicioConsolidateProgress(
  crearAdaptadorConsolidateProgressFirestore(admin.firestore())
);

exports.inviteUser = emailFunctions.https.onCall(
  crearHandlerCallable(servicioInviteUser)
);

exports.acceptInvitation = functionsV1.https.onCall(
  crearHandlerCallable(servicioAcceptInvitation)
);

exports.connectDrive = functionsV1.https.onCall(
  crearHandlerCallable(servicioConnectDrive)
);

exports.driveOAuthCallback = functionsV1.https.onCall(
  crearHandlerCallable(servicioDriveOAuthCallback)
);

exports.syncDriveMetadata = functionsV1.https.onRequest(async (req, res) => {
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

exports.vencerAsignacionesAcademicas = functionsV1.pubsub
  .schedule("every day 02:00")
  .timeZone("America/Bogota")
  .onRun(async () => servicioVencerAsignaciones(new Date()));

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

    await tenantRef.update({
      estadoSuscripcion: 'activo',
      fechaVencimiento: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
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
      const tId = ref.includes('_') ? ref.split('_')[2] : ref;
      try {
        const tSnap = await admin.firestore().collection('tenants').doc(tId).get();
        if (tSnap.exists) {
          const tenantData = tSnap.data();

          // 1. Activar Suscripción
          await admin.firestore().collection('tenants').doc(tId).update({
            estadoSuscripcion: 'activo',
            fechaVencimiento: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)),
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
          if (!uSnap.empty) {
            await uSnap.docs[0].ref.update({ estadoContrato: 'Activo' });
          }

          // 3. ENVIAR EMAIL DE BIENVENIDA (Versión Premium)
          if (tenantData.emailClub && tenantData.passwordTemporal) {
            console.log(`Enviando email de bienvenida desde Webhook a: ${tenantData.emailClub}`);
            try {
              await enviarCorreo(getResend(), {
                from: "Tudojang Academia <info@tudojang.com>",
                to: [tenantData.emailClub],
                subject: `🥋 ¡Acceso Activado: ${tenantData.nombreClub}!`,
                html: `
                    <div style="${ESTILOS_EMAIL}">
                      ${HEADER_HTML('Dojang Activado')}
                      <div style="padding: 40px 30px;">
                        <p>Hola Sabonim, confirmamos el pago de tu suscripción para <b>${tenantData.nombreClub}</b>.</p>
                        <div style="background: #f1f5f9; padding: 25px; border-radius: 16px; margin: 30px 0; border: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Credenciales de Acceso</p>
                          <p style="margin: 0;"><strong>Usuario:</strong> ${tenantData.emailClub}</p>
                          <p style="margin: 5px 0 0 0;"><strong>Clave Temporal:</strong> <code style="background: #ffffff; padding: 4px 8px; border-radius: 6px; color: #CD2E3A; border: 1px solid #cbd5e1;">${tenantData.passwordTemporal}</code></p>
                        </div>
                        <p>Ya puedes configurar tu academia y empezar a registrar estudiantes.</p>
                        <div style="text-align: center; margin-top: 40px;">
                          <a href="https://tudojang.com/#/login" style="background: #CD2E3A; color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 14px; text-transform: uppercase; display: inline-block;">Entrar a Tudojang</a>
                        </div>
                      </div>
                      ${FOOTER_HTML}
                    </div>
                  `
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

/**
 * TRIGGER: Analizar comprobante de pago con IA (Gemini 1.5 Flash)
 * Se activa cuando un estudiante sube un reporte de pago.
 */
exports.analizarComprobanteEstudiante = geminiFunctions.firestore
  .document('reportes_pagos_estudiantes/{reporteId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const reporteId = context.params.reporteId;

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
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
