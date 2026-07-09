// functions/academico/invitaciones.js
// Cloud Functions para el ciclo de vida de invitaciones academicas.
// Gestiona invitaciones formales para roles Estudiante y Tutor.

'use strict';

const crypto = require('crypto');

const ROLES_ACADEMICOS_VALIDOS = ['Estudiante', 'Tutor'];
const TTL_INVITACION_DIAS = 7;

const crearTokenInvitacion = () => crypto.randomBytes(32).toString('hex');

const hashearTokenInvitacion = (token) =>
  crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');

const crearUrlActivacion = ({ appUrl, tenantId, invitacionId, token }) => {
  const base = String(appUrl || '').replace(/\/$/, '');
  const params = new URLSearchParams({ tenantId, invitacionId, token });
  return `${base}/#/activar-cuenta?${params.toString()}`;
};

const crearErrorOperativo = (message, code = 'invalid-argument') => {
  const error = new Error(message);
  error.code = code;
  return error;
};

/**
 * Crea y envia una invitacion academica.
 *
 * La invitacion no contiene contrasena. El correo entrega un enlace temporal
 * con token de un solo uso. El token se guarda hasheado en Firestore.
 */
const crearServicioInviteUser = ({ auth, firestore, enviarCorreo, resend, appUrl }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw crearErrorOperativo('No autenticado', 'unauthenticated');
    }

    const { email, rol, tenantId } = data;

    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      throw crearErrorOperativo('Solo el Admin del tenant puede invitar usuarios', 'permission-denied');
    }

    if (tenantId !== context.auth.token.tenantId) {
      throw crearErrorOperativo('No autorizado para este tenant', 'permission-denied');
    }

    if (!ROLES_ACADEMICOS_VALIDOS.includes(rol)) {
      throw crearErrorOperativo(`Rol invalido. Debe ser uno de: ${ROLES_ACADEMICOS_VALIDOS.join(', ')}`);
    }

    if (!email || !email.includes('@')) {
      throw crearErrorOperativo('Email invalido');
    }

    const emailLimpio = email.toLowerCase().trim();

    try {
      const existingUser = await auth.getUserByEmail(emailLimpio);
      if (existingUser) {
        throw crearErrorOperativo(`Ya existe un usuario con el email ${emailLimpio}`, 'failed-precondition');
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    const ahora = new Date();
    const expiracion = new Date(ahora);
    expiracion.setDate(expiracion.getDate() + TTL_INVITACION_DIAS);

    const invitacionRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('invitaciones')
      .doc();

    const token = crearTokenInvitacion();
    const activationLink = crearUrlActivacion({
      appUrl,
      tenantId,
      invitacionId: invitacionRef.id,
      token,
    });

    const invitacion = {
      id: invitacionRef.id,
      email: emailLimpio,
      rol,
      tenantId,
      estado: 'pendiente',
      creadoPor: context.auth.uid,
      creadoEn: ahora.toISOString(),
      expiraEn: expiracion.toISOString(),
      tokenHash: hashearTokenInvitacion(token),
      activationLink,
    };

    await invitacionRef.set(invitacion);

    const asunto = rol === 'Tutor'
      ? 'Tu acceso al portal de seguimiento de Tudojang esta listo'
      : 'Tu cuenta de estudiante en Tudojang esta lista';

    const cuerpo = `
      <p>Hola,</p>
      <p>Has sido invitado a acceder a <strong>Tudojang</strong> como <strong>${rol}</strong>.</p>
      <p>Haz clic en el siguiente enlace para crear tu contrasena y activar tu cuenta. Este link es valido por ${TTL_INVITACION_DIAS} dias y solo puede usarse una vez:</p>
      <p><a href="${activationLink}" style="background:#1a73e8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Crear mi acceso</a></p>
      <p>Por seguridad, Tudojang nunca te pedira compartir tu contrasena por correo o WhatsApp.</p>
      <p>Si no esperabas este correo, puedes ignorarlo.</p>
    `;

    const resendClient = typeof resend === 'function' ? resend() : resend;
    await enviarCorreo(resendClient, {
      from: 'Tudojang <notificaciones@tudojang.com>',
      to: [emailLimpio],
      subject: asunto,
      html: cuerpo,
    });

    return { ok: true, invitacionId: invitacionRef.id, expiraEn: expiracion.toISOString() };
  };
};

/**
 * Acepta una invitacion: valida token, crea usuario con custom claims
 * y marca la invitacion como aceptada.
 */
const crearServicioAcceptInvitation = ({ auth, firestore }) => {
  return async (data) => {
    const { invitacionId, tenantId, token, password } = data;

    if (!invitacionId || !tenantId || !token || !password) {
      throw crearErrorOperativo('Faltan parametros: invitacionId, tenantId, token y password son obligatorios');
    }

    if (password.length < 8) {
      throw crearErrorOperativo('La contrasena debe tener al menos 8 caracteres');
    }

    const invRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('invitaciones')
      .doc(invitacionId);

    const snap = await invRef.get();

    if (!snap.exists) {
      throw crearErrorOperativo('Invitacion no encontrada', 'not-found');
    }

    const invitacion = snap.data();

    if (invitacion.estado !== 'pendiente') {
      throw crearErrorOperativo(`La invitacion ya fue ${invitacion.estado}`, 'failed-precondition');
    }

    if (!invitacion.tokenHash || invitacion.tokenHash !== hashearTokenInvitacion(token)) {
      throw crearErrorOperativo('El enlace de activacion no es valido o fue modificado', 'permission-denied');
    }

    const ahora = new Date();
    const expira = new Date(invitacion.expiraEn);
    if (ahora > expira) {
      await invRef.update({ estado: 'vencida' });
      throw crearErrorOperativo('La invitacion vencio. Solicita al administrador un nuevo enlace.', 'failed-precondition');
    }

    let uid;
    try {
      const existing = await auth.getUserByEmail(invitacion.email);
      uid = existing.uid;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email: invitacion.email,
          password,
          displayName: invitacion.email.split('@')[0],
          emailVerified: true,
        });
        uid = newUser.uid;
      } else {
        throw err;
      }
    }

    await auth.setCustomUserClaims(uid, {
      rol: invitacion.rol,
      tenantId: invitacion.tenantId,
    });

    await firestore.collection('usuarios').doc(uid).set({
      id: uid,
      email: invitacion.email,
      nombreUsuario: invitacion.email.split('@')[0],
      rol: invitacion.rol,
      tenantId: invitacion.tenantId,
      numeroIdentificacion: '',
      whatsapp: '',
      fcmTokens: [],
      creadoDesdeInvitacion: invitacionId,
      creadoEn: new Date().toISOString(),
    });

    await invRef.update({
      estado: 'aceptada',
      aceptadaEn: new Date().toISOString(),
      uid,
      tokenHash: null,
    });

    return { ok: true, uid };
  };
};

module.exports = {
  crearServicioInviteUser,
  crearServicioAcceptInvitation,
  hashearTokenInvitacion,
  crearUrlActivacion,
};
