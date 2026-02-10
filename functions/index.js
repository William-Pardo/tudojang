const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");

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
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #0047A0;">🥋 ¡Acceso Activado!</h1>
          <p>Hola Sabonim, tu academia <b>${nombreClub}</b> ya está lista.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
            <p><strong>Usuario:</strong> ${email}</p>
            <p><strong>Clave:</strong> <code>${passwordTemporal}</code></p>
          </div>
          <p>Inicia sesión en: <a href="https://tudojang.com/#/login">tudojang.com</a></p>
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
          await admin.firestore().collection('tenants').doc(tId).update({
            estadoSuscripcion: 'activo',
            fechaVencimiento: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
          });
          const uSnap = await admin.firestore().collection('usuarios').where('tenantId', '==', tId).limit(1).get();
          if (!uSnap.empty) {
            await uSnap.docs[0].ref.update({ estadoContrato: 'Activo' });
          }
          console.log("Activado via Webhook exitosamente");
        }
      } catch (err) { console.error("Error en webhook:", err); }
    }
  }
  res.status(200).send('OK');
});
