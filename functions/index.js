const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

const resend = new Resend("re_d2452b45-37a2-4294-93c0-e3a51c323d47");

/**
 * Cloud Function: Enviar email de bienvenida
 * v1 onCall maneja CORS automáticamente
 */
exports.enviarBienvenidaTudojang = functions.https.onCall(async (data, context) => {
  const { email, nombreClub, passwordTemporal, slug } = data;

  if (!email || !nombreClub || !passwordTemporal) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan parámetros requeridos');
  }

  try {
    console.log(`Enviando bienvenida v1 a: ${email}`);
    const result = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: `¡Bienvenido a Tudojang, ${nombreClub}!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #0047A0;">🥋 ¡Bienvenido a Tudojang!</h1>
          <p>Tu academia <strong>${nombreClub}</strong> está lista para empezar.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Usuario:</strong> ${email}</p>
            <p><strong>Clave Temporal:</strong> <code>${passwordTemporal}</code></p>
          </div>
          <p>Puedes iniciar sesión en: <a href="https://tudojang.com/#/login">tudojang.com</a></p>
        </div>
      `
    });
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Error Resend v1:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Webhook Wompi (v1)
 * URL: https://us-central1-tudojang.cloudfunctions.net/webhookWompi
 */
exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  const evento = req.body;
  console.log("Evento Wompi recibido v1:", JSON.stringify(evento));

  if (evento.event === 'transaction.updated') {
    const transaction = evento.data.transaction;
    console.log(`Transacción ${transaction.id} con estado: ${transaction.status}`);

    if (transaction.status === 'APPROVED') {
      const referencia = transaction.reference;
      console.log(`Referencia recibida: ${referencia}`);

      if (referencia && referencia.startsWith('SUSC_')) {
        const parts = referencia.split('_');
        const tenantId = parts[2];

        try {
          const tenantRef = admin.firestore().collection('tenants').doc(tenantId);
          const tenantSnap = await tenantRef.get();

          if (tenantSnap.exists) {
            const tenantData = tenantSnap.data();
            console.log(`Procesando activación para tenant: ${tenantId}`);

            // 1. Activar Tenant
            await tenantRef.update({
              estadoSuscripcion: 'activo',
              fechaVencimiento: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))
            });

            // 2. Crear/Actualizar Usuario Auth
            let user;
            try {
              user = await admin.auth().createUser({
                uid: tenantId,
                email: tenantData.emailClub,
                password: tenantData.passwordTemporal,
                displayName: tenantData.nombreClub
              });
              console.log("Usuario Auth creado nuevo");
            } catch (e) {
              if (e.code === 'auth/email-already-exists') {
                user = await admin.auth().getUserByEmail(tenantData.emailClub);
                await admin.auth().updateUser(user.uid, {
                  password: tenantData.passwordTemporal
                });
                console.log("Usuario Auth actualizado existente");
              } else { throw e; }
            }

            // 3. Crear Perfil Firestore
            await admin.firestore().collection('usuarios').doc(user.uid).set({
              id: user.uid,
              email: tenantData.emailClub,
              nombreUsuario: tenantData.nombreClub,
              rol: 'Admin',
              tenantId: tenantId,
              estadoContrato: 'Activo'
            });

            console.log(`Registro completado exitosamente para ${tenantData.emailClub}`);

            // 4. Email de bienvenida (Backend)
            try {
              await resend.emails.send({
                from: "Tudojang Academia <info@tudojang.com>",
                to: [tenantData.emailClub],
                subject: "🥋 Tu Academia está activada",
                html: `
                  <div style="font-family: sans-serif; padding: 20px;">
                    <h1>¡Felicidades Sabonim!</h1>
                    <p>Tu pago ha sido procesado exitosamente en modo Sandbox.</p>
                    <p><strong>Academia:</strong> ${tenantData.nombreClub}</p>
                    <p><strong>Tu clave de acceso:</strong> ${tenantData.passwordTemporal}</p>
                    <p>Ya puedes entrar en: <a href="https://tudojang.com/#/login">tudojang.com</a></p>
                  </div>
                `
              });
              console.log("Email enviado desde backend");
            } catch (emailErr) {
              console.error("Error enviando email desde backend:", emailErr);
            }
          } else {
            console.warn(`Tenant con ID ${tenantId} no existe en Firestore`);
          }
        } catch (err) {
          console.error("Error crítico procesando webhook:", err);
        }
      }
    } else {
      console.log(`La transacción no fue aprobada (Estado: ${transaction.status})`);
    }
  }

  res.status(200).send('Webhook Procesado');
});

// Función para probar el envío de emails manualmente
exports.testEmailResend = functions.https.onCall(async (data, context) => {
  const { toEmail } = data;
  try {
    const result = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [toEmail || "gengepardo@gmail.com"],
      subject: "🚀 Prueba de Sistema - Tudojang",
      html: "<h1>¡Funciona!</h1><p>Si recibes este correo, la configuración de <b>info@tudojang.com</b> y Resend es correcta.</p>"
    });
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Error en prueba de email:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
