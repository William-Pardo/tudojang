const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

admin.initializeApp();

const resend = new Resend("re_ZACtuoS1_FBeD6e6ZCu84HK8zfZHQV4MW");

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

exports.provisionarUsuarioOnboarding = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { tenantId, email, password, nombreClub } = data;
    if (!email || !password || !tenantId) throw new Error('Faltan parámetros');

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
    await resend.emails.send({
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

exports.activarSuscripcionManual = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { tenantId, email } = data;
    console.log(`Activación manual para: ${tenantId}`);

    const tenantRef = admin.firestore().collection('tenants').doc(tenantId);
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

exports.enviarBienvenidaTudojang = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub, passwordTemporal } = data;

    if (!(await verificarDestinatario(email))) {
      throw new Error(`Acceso restringido: El destinatario ${email} no es un usuario o estudiante registrado.`);
    }

    await resend.emails.send({
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

exports.enviarConfirmacionPago = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub, montoPagado, referenciaPago } = data;

    if (!(await verificarDestinatario(email))) {
      throw new Error(`Acceso restringido: Destinatario ${email} no válido.`);
    }

    const montoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(montoPagado / 100);

    await resend.emails.send({
      from: "Tudojang Pagos <info@tudojang.com>",
      to: [email],
      subject: `✅ Confirmación de Pago: ${nombreClub}`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Recibo de Pago')}
          <div style="padding: 40px 30px;">
            <p>Confirmamos la recepción exitosa de tu pago para <b>${nombreClub}</b>.</p>
            <div style="border: 2px dashed #e2e8f0; padding: 25px; border-radius: 16px; margin: 30px 0; position: relative; background: #fff;">
              <div style="margin-bottom: 20px;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Detalle de Transacción</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900; color: #0047A0;">${montoFormateado}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Referencia</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-family: monospace; color: #1e293b;">${referenciaPago || 'PAGO-AUTO-' + Date.now()}</p>
              </div>
            </div>
            <p style="font-size: 13px; color: #64748b;">Tu estado de cuenta ha sido actualizado automáticamente en la plataforma.</p>
          </div>
          ${FOOTER_HTML}
        </div>
      `
    });
    return { success: true };
  });
});

exports.enviarRecuperacionPassword = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, resetLink, nombreClub } = data;

    if (!(await verificarDestinatario(email))) {
      throw new Error(`Acceso restringido: Destinatario ${email} no válido.`);
    }

    await resend.emails.send({
      from: "Tudojang Seguridad <info@tudojang.com>",
      to: [email],
      subject: `🔐 Recuperación de Contraseña - Tudojang`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Seguridad de Cuenta')}
          <div style="padding: 40px 30px;">
            <p>Has solicitado restablecer la contraseña de tu cuenta en <b>Tudojang</b> para la academia <b>${nombreClub || 'Tu Dojang'}</b>.</p>
            <p>Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por 1 hora.</p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetLink}" style="background: #CD2E3A; color: #ffffff; padding: 18px 35px; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 14px; text-transform: uppercase; display: inline-block;">Restablecer Clave</a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; pt: 20px;">Si no solicitaste este cambio, puedes ignorar este correo con total seguridad.</p>
          </div>
          ${FOOTER_HTML}
        </div>
      `
    });
    return { success: true };
  });
});

exports.notificarCambioPassword = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub } = data;

    if (!(await verificarDestinatario(email))) return { success: false, message: 'Ignorado' };

    await resend.emails.send({
      from: "Tudojang Seguridad <info@tudojang.com>",
      to: [email],
      subject: `⚠️ Cambio de Contraseña Confirmado`,
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Alerta de Seguridad')}
          <div style="padding: 40px 30px;">
            <p>Te notificamos que la contraseña de tu perfil en <b>${nombreClub || 'Tudojang'}</b> ha sido cambiada exitosamente.</p>
            <div style="background: #fff4f4; border-left: 4px solid #CD2E3A; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #7f1d1d;">Si fuiste tú quien realizó el cambio, no es necesario hacer nada más.</p>
            </div>
            <p style="font-weight: 700; color: #1e293b;">¿No fuiste tú?</p>
            <p>Contacta inmediatamente con tu administrador o soporte técnico para proteger tu cuenta.</p>
          </div>
          ${FOOTER_HTML}
        </div>
      `
    });
    return { success: true };
  });
});

exports.testEmailResend = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [data.toEmail || "gengepardo@gmail.com"],
      subject: "🚀 Prueba de Sistema Premium",
      html: `
        <div style="${ESTILOS_EMAIL}">
          ${HEADER_HTML('Test de Sistema')}
          <div style="padding: 40px 30px; text-align: center;">
            <span style="font-size: 48px;">🚀</span>
            <h2 style="color: #0047A0; margin-top: 20px;">¡Motor de Correos Online!</h2>
            <p>Este es un correo de prueba generado desde el núcleo de Tudojang.</p>
          </div>
          ${FOOTER_HTML}
        </div>
      `
    });
    return { success: true };
  });
});

exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  const { event, data } = req.body;
  console.log("Webhook recibido:", event);

  if (event === 'transaction.updated' && data.transaction.status === 'APPROVED') {
    const ref = data.transaction.reference;
    const monto = data.transaction.amount_in_cents;
    const montoFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(monto / 100);

    // Notificar a Master sobre pago recibido
    await resend.emails.send({
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
            fechaVencimiento: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
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
              await resend.emails.send({
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
exports.analizarComprobanteEstudiante = functions.firestore
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
      const apiKey = functions.config().gemini?.api_key;
      if (!apiKey) {
        throw new Error("No se encontró la API Key de Gemini en la configuración del servidor.");
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
exports.notificarMasterMisionKicho = functions.firestore
  .document('misiones_kicho/{misionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.estadoLote !== 'legalizado' && after.estadoLote === 'legalizado') {
      await resend.emails.send({
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
exports.notificarMasterSolicitudCarnets = functions.firestore
  .document('solicitudes_carnets/{solicitudId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await resend.emails.send({
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
