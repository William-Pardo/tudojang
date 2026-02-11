const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const plantillas = require("./plantillas");

admin.initializeApp();

const resend = new Resend("re_ZACtuoS1_FBeD6e6ZCu84HK8zfZHQV4MW");

const cors = require("cors")({ origin: true });

/**
 * Helper para manejar CORS y errores en onRequest
 */
const manejarRequest = (req, res, handler) => {
  return cors(req, res, async () => {
    try {
      const result = await handler(req.body.data || req.body);
      res.status(200).send({ data: result });
    } catch (error) {
      console.error("Error en función:", error);
      res.status(500).send({ error: { message: error.message, status: "INTERNAL" } });
    }
  });
};

exports.provisionarUsuarioOnboarding = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { tenantId, email, password, nombreClub, nombre } = data;
    const nombreUsuario = nombreClub || nombre || 'Administrador';
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
      nombreUsuario: nombreUsuario,
      rol: 'Admin',
      tenantId: tenantId,
      estadoContrato: 'Pendiente de Pago'
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
    console.log(`Enviando bienvenida a: ${email}`);

    await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: `🥋 ¡Bienvenido a Tudojang, ${nombreClub}!`,
      html: plantillas.bienvenida({
        nombreUsuario: "Sabonim",
        nombreAcademia: nombreClub,
        emailUsuario: email,
        passwordTemporal: passwordTemporal
      })
    });
    return { success: true };
  });
});

exports.enviarConfirmacionPago = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub, montoPagado } = data;
    console.log(`Enviando confirmación de pago a: ${email}`);

    const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

    await resend.emails.send({
      from: "Tudojang Facturación <pagos@tudojang.com>",
      to: [email],
      subject: `🙏 Honor a tu Compromiso - Pago Recibido`,
      html: plantillas.pagoExitoso({
        nombreUsuario: "Sabonim",
        nombreAcademia: nombreClub,
        montoPagado: formatter.format(montoPagado),
        fechaPago: new Date().toLocaleDateString('es-CO')
      })
    });
    return { success: true };
  });
});

exports.enviarRecuperacionPassword = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, resetLink } = data;
    console.log(`Enviando recuperación a: ${email}`);

    await resend.emails.send({
      from: "Tudojang Seguridad <soporte@tudojang.com>",
      to: [email],
      subject: `🔐 Restablecer Clave de Acceso Tudojang`,
      html: plantillas.recuperarPassword({
        nombreUsuario: "Sabonim",
        enlaceRecuperacion: resetLink
      })
    });
    return { success: true };
  });
});

exports.enviarSoporteTecnico = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    const { email, nombreClub, idTicket, mensajeRespuesta } = data;
    console.log(`Enviando respuesta de soporte a: ${email}`);

    await resend.emails.send({
      from: "Tudojang Soporte <soporte@tudojang.com>",
      to: [email],
      subject: `🛠️ Soporte Técnico - Ticket #${idTicket}`,
      html: plantillas.soporteTecnico({
        nombreUsuario: "Sabonim",
        nombreAcademia: nombreClub,
        idTicket: idTicket,
        mensajeRespuestaSoporte: mensajeRespuesta
      })
    });
    return { success: true };
  });
});

exports.testEmailResend = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async (data) => {
    await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [data.toEmail || "gengepardo@gmail.com"],
      subject: "🚀 Prueba de Sistema",
      html: "<h1>Funciona</h1>"
    });
    return { success: true };
  });
});

exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  const { event, data } = req.body;
  console.log("Webhook recibido:", event);

  if (event === 'transaction.updated' && data.transaction.status === 'APPROVED') {
    const ref = data.transaction.reference;
    if (ref && ref.startsWith('SUSC_')) {
      const tId = ref.split('_')[2];
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

          // 3. ENVIAR EMAIL DE BIENVENIDA (Doble Seguridad - Backend)
          // Solo enviamos si tenemos los datos necesarios
          if (tenantData.emailClub && tenantData.passwordTemporal) {
            console.log(`Enviando email de bienvenida desde Webhook a: ${tenantData.emailClub}`);
            try {
              await resend.emails.send({
                from: "Tudojang Academia <info@tudojang.com>",
                to: [tenantData.emailClub],
                subject: `🥋 ¡Acceso Activado: ${tenantData.nombreClub}!`,
                html: plantillas.bienvenida({
                  nombreUsuario: "Sabonim",
                  nombreAcademia: tenantData.nombreClub,
                  emailUsuario: tenantData.emailClub,
                  passwordTemporal: tenantData.passwordTemporal
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

