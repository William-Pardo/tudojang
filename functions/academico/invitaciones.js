// functions/academico/invitaciones.js
// Cloud Functions para el ciclo de vida de invitaciones académicas.
// Gestiona la creación de invitaciones para roles Estudiante y Tutor,
// la aceptación del link y el reenvío de invitaciones vencidas.

'use strict';

const ROLES_ACADEMICOS_VALIDOS = ['Estudiante', 'Tutor'];
const TTL_INVITACION_DIAS = 7;

/**
 * Crea y envía una invitación académica.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.auth - admin.auth()
 * @param {object} deps.firestore - admin.firestore()
 * @param {Function} deps.enviarCorreo - función de envío de email
 * @param {object|Function} deps.resend - instancia de Resend o getter lazy
 * @param {string} deps.appUrl - URL base de la aplicación
 */
const crearServicioInviteUser = ({ auth, firestore, enviarCorreo, resend, appUrl }) => {
  return async (data, context) => {
    // Validar autenticación
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { email, rol, tenantId } = data;

    // Validar que el invocador sea Admin del mismo tenant
    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      throw new Error('Solo el Admin del tenant puede invitar usuarios');
    }

    if (tenantId !== context.auth.token.tenantId) {
      throw new Error('No autorizado para este tenant');
    }

    // Validar rol
    if (!ROLES_ACADEMICOS_VALIDOS.includes(rol)) {
      throw new Error(`Rol inválido. Debe ser uno de: ${ROLES_ACADEMICOS_VALIDOS.join(', ')}`);
    }

    // Validar email
    if (!email || !email.includes('@')) {
      throw new Error('Email inválido');
    }

    const emailLimpio = email.toLowerCase().trim();

    // Verificar que no exista ya un usuario con ese email
    try {
      const existingUser = await auth.getUserByEmail(emailLimpio);
      if (existingUser) {
        throw new Error(`Ya existe un usuario con el email ${emailLimpio}`);
      }
    } catch (err) {
      // auth/user-not-found es el caso esperado cuando no existe — seguimos
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Calcular expiración
    const ahora = new Date();
    const expiracion = new Date(ahora);
    expiracion.setDate(expiracion.getDate() + TTL_INVITACION_DIAS);

    // Generar Firebase Auth action link
    const actionLink = await auth.generateSignInWithEmailLink(emailLimpio, {
      url: `${appUrl}/#/activar-cuenta`,
      handleCodeInApp: true,
    });

    // Crear el documento de invitación en Firestore
    const invitacionRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('invitaciones')
      .doc();

    const invitacion = {
      id: invitacionRef.id,
      email: emailLimpio,
      rol,
      tenantId,
      estado: 'pendiente',
      creadoPor: context.auth.uid,
      creadoEn: ahora.toISOString(),
      expiraEn: expiracion.toISOString(),
      actionLink, // Se guarda para posible reenvío
    };

    await invitacionRef.set(invitacion);

    // Enviar correo de invitación
    const asunto = rol === 'Tutor'
      ? '¡Tienes acceso al portal de seguimiento de tu estudiante!'
      : '¡Tu cuenta de estudiante está lista!';

    const cuerpo = `
      <p>Hola,</p>
      <p>Has sido invitado a acceder a <strong>Tudojang</strong> como <strong>${rol}</strong>.</p>
      <p>Haz clic en el siguiente enlace para activar tu cuenta. Este link es válido por ${TTL_INVITACION_DIAS} días:</p>
      <p><a href="${actionLink}" style="background:#1a73e8;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Activar mi cuenta</a></p>
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
 * Acepta una invitación: valida el link, crea el usuario con custom claims
 * y marca la invitación como aceptada.
 *
 * @param {object} deps - Dependencias inyectadas
 */
const crearServicioAcceptInvitation = ({ auth, firestore }) => {
  return async (data, context) => {
    const { invitacionId, tenantId, password } = data;

    if (!invitacionId || !tenantId || !password) {
      throw new Error('Faltan parámetros: invitacionId, tenantId y password son obligatorios');
    }

    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    // Leer la invitación
    const invRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('invitaciones')
      .doc(invitacionId);

    const snap = await invRef.get();

    if (!snap.exists) {
      throw new Error('Invitación no encontrada');
    }

    const invitacion = snap.data();

    if (invitacion.estado !== 'pendiente') {
      throw new Error(`La invitación ya fue ${invitacion.estado}`);
    }

    // Verificar expiración
    const ahora = new Date();
    const expira = new Date(invitacion.expiraEn);
    if (ahora > expira) {
      await invRef.update({ estado: 'vencida' });
      throw new Error('La invitación venció. Solicitá al administrador un nuevo enlace.');
    }

    // Verificar que el email no exista ya como usuario de Auth
    let uid;
    try {
      const existing = await auth.getUserByEmail(invitacion.email);
      uid = existing.uid;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Crear el usuario en Firebase Auth
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

    // Asignar custom claims: rol + tenantId
    await auth.setCustomUserClaims(uid, {
      rol: invitacion.rol,
      tenantId: invitacion.tenantId,
    });

    // Crear documento de usuario en la colección `usuarios`
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

    // Marcar invitación como aceptada
    await invRef.update({
      estado: 'aceptada',
      aceptadaEn: new Date().toISOString(),
      uid,
    });

    return { ok: true, uid };
  };
};

module.exports = { crearServicioInviteUser, crearServicioAcceptInvitation };
