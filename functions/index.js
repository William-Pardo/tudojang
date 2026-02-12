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

    const emailNormalizado = email.toLowerCase().trim();
    console.log(`Provisionando usuario: ${emailNormalizado}`);
    let user;
    try {
      user = await admin.auth().createUser({
        uid: tenantId,
        email: emailNormalizado,
        password: password,
        displayName: nombreClub
      });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        user = await admin.auth().getUserByEmail(emailNormalizado);
        await admin.auth().updateUser(user.uid, { password: password });
      } else { throw e; }
    }

    await admin.firestore().collection('usuarios').doc(user.uid).set({
      id: user.uid,
      email: emailNormalizado,
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
      fechaVencimiento: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
      subject: `🥋 ¡Bienvenido al Equipo Técnico: ${nombreClub}!`,
      html: plantillas.bienvenida({
        nombreUsuario: "Sabonim / Colaborador",
        nombreAcademia: nombreClub,
        emailUsuario: email,
        passwordTemporal: passwordTemporal,
        loginUrl: "https://tudojang.com"
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

const WOMPI_KEYS = {
  prod: {
    private: "prv_prod_O9z3... (si la tuviera, pero usaré la de constantes)",
  },
  test: {
    private: "prv_test_VVkIyE0hBvHJpjKf2JJOl2dGoYG6PBXK",
  }
};

exports.verificarTransaccionWompi = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { transactionId } = req.body.data || req.body;
      if (!transactionId) throw new Error("Falta ID de transacción");

      console.log(`[Verificar] Consultando Wompi para ID: ${transactionId}`);

      const headers = {
        'Authorization': `Bearer ${WOMPI_KEYS.test.private}`,
        'Content-Type': 'application/json'
      };

      // Intentar Sandbox primero ya que estamos en pruebas, luego Prod
      let response = await fetch(`https://sandbox.wompi.co/v1/transactions/${transactionId}`, { headers });

      if (!response.ok) {
        // Si no está en sandbox, probamos prod (con la misma lógica de headers si se tuviera la key)
        response = await fetch(`https://production.wompi.co/v1/transactions/${transactionId}`, { headers });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Verificar] Error de Wompi (${response.status}):`, errorText);
        throw new Error(`Wompi respondió con error ${response.status}`);
      }

      const json = await response.json();
      const tx = json.data;

      console.log(`[Verificar] Estado de transacción ${transactionId}: ${tx.status}`);

      if (tx.status === 'APPROVED') {
        const ref = tx.reference;
        let tId = null;

        // Extraer tenantId de la referencia (ej: RENOVACION_tnt-123_...)
        const match = ref.match(/tnt-[0-9]+/);
        if (match) { tId = match[0]; }
        else if (ref.includes('_')) { tId = ref.split('_')[1]; }

        if (tId) {
          const tRef = admin.firestore().collection('tenants').doc(tId);
          const tSnap = await tRef.get();

          if (tSnap.exists) {
            const tData = tSnap.data();
            const hoy = new Date();

            // Lógica de nueva fecha: Si ya venció, empezamos desde hoy. Si no, sumamos al vencimiento actual.
            let fBase = tData.fechaVencimiento && typeof tData.fechaVencimiento.toDate === 'function' ? tData.fechaVencimiento.toDate() : (typeof tData.fechaVencimiento === 'string' ? new Date(tData.fechaVencimiento) : hoy);
            if (isNaN(fBase.getTime()) || fBase < hoy) fBase = hoy;

            // Sumar 31 días
            const nuevaFecha = new Date(fBase.getTime() + 31 * 24 * 60 * 60 * 1000);
            const fStr = nuevaFecha.toISOString().split('T')[0];

            await tRef.update({
              estadoSuscripcion: 'activo',
              fechaVencimiento: fStr,
              ultimoPagoVerificado: admin.firestore.FieldValue.serverTimestamp(),
              wompiStatus: 'APPROVED_MANUAL',
              transaccionUltima: transactionId
            });

            // Reactivar usuarios de este tenant
            const uSnap = await admin.firestore().collection('usuarios').where('tenantId', '==', tId).get();
            const promises = uSnap.docs.filter(d => d.data().estadoContrato === 'Suspendido').map(d => d.ref.update({ estadoContrato: 'Activo' }));
            await Promise.all(promises);

            return res.status(200).send({ data: { success: true, message: "Licencia activada con éxito", nuevaFecha: fStr } });
          } else {
            console.error(`[Verificar] Tenant no encontrado: ${tId}`);
          }
        } else {
          console.error(`[Verificar] No se pudo extraer tenantId de la referencia: ${ref}`);
        }
      }

      return res.status(200).send({ data: { success: false, status: tx.status, message: `La transacción está en estado: ${tx.status}` } });
    } catch (error) {
      console.error("Error en verificarTransaccionWompi:", error);
      return res.status(500).send({ error: { message: error.message } });
    }
  });
});


exports.getDebugLogs = functions.https.onRequest((req, res) => {
  manejarRequest(req, res, async () => {
    const snap = await admin.firestore().collection('_debug_webhooks').orderBy('timestamp', 'desc').limit(10).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
});

exports.webhookWompi = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('Webhook de Wompi activo y listo.');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { console.error("Error parseando body string"); }
  }

  const { event, data } = body || {};
  const ref = data?.transaction?.reference;

  try {
    await admin.firestore().collection('_debug_webhooks').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      event,
      ref,
      status: data?.transaction?.status,
      fullBody: body
    });
  } catch (e) { console.error("Error debug log"); }

  if (event === 'transaction.updated' && data?.transaction?.status === 'APPROVED') {
    let tId = null;
    const match = ref.match(/tnt-[0-9]+/);
    if (match) { tId = match[0]; }
    else if (ref.includes('_')) { tId = ref.split('_')[1]; }

    if (tId) {
      try {
        let tSnap = await admin.firestore().collection('tenants').doc(tId).get();
        if (!tSnap.exists && data.transaction.customer_email) {
          const fbSnap = await admin.firestore().collection('tenants')
            .where('emailClub', '==', data.transaction.customer_email.toLowerCase().trim())
            .limit(1).get();
          if (!fbSnap.empty) { tSnap = fbSnap.docs[0]; tId = tSnap.id; }
        }

        if (tSnap.exists) {
          const tData = tSnap.data();
          const hoy = new Date();
          let fBase = tData.fechaVencimiento && typeof tData.fechaVencimiento.toDate === 'function' ? tData.fechaVencimiento.toDate() : (typeof tData.fechaVencimiento === 'string' ? new Date(tData.fechaVencimiento) : hoy);
          if (isNaN(fBase.getTime()) || fBase < hoy) fBase = hoy;
          const fStr = new Date(fBase.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          await admin.firestore().collection('tenants').doc(tId).update({
            estadoSuscripcion: 'activo',
            fechaVencimiento: fStr,
            wompiStatus: 'APPROVED_LAST'
          });

          const uSnap = await admin.firestore().collection('usuarios').where('tenantId', '==', tId).get();
          const promises = uSnap.docs.filter(d => d.data().estadoContrato === 'Suspendido').map(d => d.ref.update({ estadoContrato: 'Activo' }));
          await Promise.all(promises);

          if (tData.emailClub) {
            try {
              const monto = data.transaction.amount_in_cents / 100;
              await resend.emails.send({
                from: "Tudojang Facturación <pagos@tudojang.com>",
                to: [tData.emailClub],
                subject: `🥋 Membresía Renovada: ${tData.nombreClub}`,
                html: plantillas.pagoExitoso({
                  nombreUsuario: "Sabonim",
                  nombreAcademia: tData.nombreClub,
                  montoPagado: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(monto),
                  fechaPago: new Date().toLocaleDateString('es-CO')
                })
              });
            } catch (err) { }
          }
        }
      } catch (err) { }
    }
  }
  res.status(200).send('OK');
});
