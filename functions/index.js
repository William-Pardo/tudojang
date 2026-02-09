const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

const resend = new Resend("re_ZACtuoS1_FBeD6e6ZCu84HK8zfZHQV4MW");

/**
 * Cloud Function: Enviar email de bienvenida
 * v1 onCall maneja CORS automáticamente
 */
/**
 * Cloud Function: Provisionar usuario (Crear en Auth y Firestore ANTES del pago)
 * Esto asegura que el login funcione aunque el webhook falle.
 */
exports.provisionarUsuarioOnboarding = functions.https.onCall(async (data, context) => {
  const { tenantId, email, password, nombreClub, slug, plan } = data;

  if (!email || !password || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan parámetros');
  }

  try {
    console.log(`Provisionando usuario preliminar: ${email}`);

    // 1. Crear en Auth
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

    // 2. Crear Perfil Firestore (Estado: Pendiente)
    await admin.firestore().collection('usuarios').doc(user.uid).set({
      id: user.uid,
      email: email,
      nombreUsuario: nombreClub,
      rol: 'Admin',
      tenantId: tenantId,
      estadoContrato: 'Pendiente de Pago'
    });

    return { success: true, uid: user.uid };
  } catch (error) {
    console.error("Error provisionando:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Activar Suscripción (Llamada manualmente desde el frontend al volver de Wompi)
 * Doble seguridad por si el webhook falla.
 */
exports.activarSuscripcionManual = functions.https.onCall(async (data, context) => {
  const { tenantId, email } = data;

  try {
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
  } catch (error) {
    console.error("Error activación manual:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.enviarBienvenidaTudojang = functions.https.onCall(async (data, context) => {
  const { email, nombreClub, passwordTemporal } = data;
  try {
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
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  const { event, data } = req.body;
  if (event === 'transaction.updated' && data.transaction.status === 'APPROVED') {
    const ref = data.transaction.reference;
    if (ref && ref.startsWith('SUSC_')) {
      const tId = ref.split('_')[2];
      try {
        const tSnap = await admin.firestore().collection('tenants').doc(tId).get();
        if (tSnap.exists) {
          const tData = tSnap.data();
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
      } catch (err) { console.error(err); }
    }
  }
  res.status(200).send('OK');
});

exports.testEmailResend = functions.https.onCall(async (data) => {
  await resend.emails.send({
    from: "Tudojang Academia <info@tudojang.com>",
    to: [data.toEmail || "gengepardo@gmail.com"],
    subject: "🚀 Prueba de Sistema",
    html: "<h1>Funciona</h1>"
  });
  return { success: true };
});
