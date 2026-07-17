// functions/academico/invitaciones.js
// Cloud Functions para el ciclo de vida de invitaciones academicas.
// Gestiona invitaciones formales para roles Estudiante y Tutor.

'use strict';

const crypto = require('crypto');
const { construirCorreoInvitacion } = require('./plantillasInvitacion');

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

    const { email, rol, tenantId, nombreDestinatario, nombreAlumno } = data;

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

    // Fix consistencia de plantillas (2026-07-15): antes había un HTML generico inline (mismo
    // para Estudiante y Tutor, sin logo ni marca). Ahora usa la plantilla real por rol
    // (--/asignación_de_contraseña_*.html, ver plantillasInvitacion.js), con el nombre del
    // destinatario si el llamador lo mandó (FormularioEstudiante lo conoce; la invitación
    // manual de Configuración → Cuentas Externas no, y usa un fallback razonable).
    const { asunto, html: cuerpo } = construirCorreoInvitacion(rol, {
      nombreDestinatario,
      nombreAlumno,
      enlace: activationLink,
    });

    // Fix tutor-role-end-to-end (2026-07-14): el correo es una NOTIFICACIÓN, no el
    // núcleo de la operación. Si el proveedor de email (Resend) falla, la invitación ya
    // quedó creada en Firestore con su `activationLink` válido — NO debe abortarse todo.
    // Se devuelve `emailEnviado` + `activationLink` para que el frontend surface el enlace
    // (p.ej. compartir por WhatsApp) y el tutor pueda activar su cuenta igual.
    let emailEnviado = false;
    try {
      const resendClient = typeof resend === 'function' ? resend() : resend;
      await enviarCorreo(resendClient, {
        from: 'Tudojang <notificaciones@tudojang.com>',
        to: [emailLimpio],
        subject: asunto,
        html: cuerpo,
      });
      emailEnviado = true;
    } catch (errorCorreo) {
      console.error('[inviteUser] La invitación se creó pero el correo no pudo enviarse:', {
        email: emailLimpio,
        message: errorCorreo && errorCorreo.message,
      });
    }

    return {
      ok: true,
      invitacionId: invitacionRef.id,
      expiraEn: expiracion.toISOString(),
      emailEnviado,
      activationLink,
    };
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
      // Bug real encontrado 2026-07-15: si el email YA tenia cuenta (p.ej. invitado antes con
      // otro rol, o un reintento tras un submit duplicado), este branch reusaba el uid pero
      // NUNCA aplicaba la contrasena que la persona acaba de escribir -- quedaba con la
      // contrasena vieja en silencio, y el usuario no podia loguear con la que "acababa de
      // asignar". El token ya se valido arriba (hash + vigencia), asi que aplicar la nueva
      // contrasena aca es seguro -- es la misma garantia que el branch de creacion.
      await auth.updateUser(uid, { password });
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
