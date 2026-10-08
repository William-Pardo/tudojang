// functions/academico/usuarios.js
// Callable `actualizarUsuarioStaff`: alta/edicion segura de un usuario del equipo
// tecnico (Admin/Editor/Asistente/Maestro/etc). Reemplaza el write directo de cliente
// a `usuarios/{uid}` (bloqueado sin excepcion por firestore.rules: "allow create,
// update, delete: if false" -- DT-0020), que dejaba rota cualquier edicion (incluido
// el cambio de rol Editor->Maestro) para todos los roles, incluido Admin.
//
// Callable `repararOCrearUsuarioStaff`: recupera el estado huerfano Auth-sin-Firestore.
// Cuando agregarUsuario (cliente) recibe auth/email-already-in-use y verifica que el
// email NO tiene documento en Firestore, invoca este callable para que el Admin SDK
// obtenga el UID existente y cree el documento faltante. Si el documento ya existe,
// retorna 'already-exists' para que el cliente distinga el huerfano real del duplicado.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

const ROLES_VALIDOS = new Set([
  'Admin', 'Editor', 'Asistente', 'Estudiante', 'Tutor', 'Maestro', 'SuperAdmin',
]);

// tenantId y deletedAt quedan fuera a proposito: tenantId nunca se toma de `cambios`
// (se fuerza siempre al tenantId ya validado, para que un Admin no pueda mover a un
// miembro de su equipo a otro tenant), y deletedAt es responsabilidad de un flujo de
// baja dedicado (eliminarUsuario), no de esta edicion de perfil.
const CAMPOS_PERMITIDOS = ['nombreUsuario', 'numeroIdentificacion', 'whatsapp', 'email', 'rol', 'sedeId'];

const CAMPOS_CONTRATO = {
  sueldoBase: 'sueldoBase',
  duracionContratoMeses: 'duracionMeses',
  tipoVinculacion: 'tipoVinculacion',
  fechaInicio: 'fechaInicio',
  lugarEjecucion: 'lugarEjecucion',
};

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

// SuperAdmin opera cross-tenant por diseño (mismo criterio que isSuperAdmin() en
// firestore.rules para `tenants/{tenantId}` get); Admin queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (rol !== 'Admin' && rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo un administrador puede gestionar usuarios del equipo');
  }
}

function sanitizarCambios(cambios = {}, auth) {
  const limpio = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (cambios[campo] !== undefined) limpio[campo] = cambios[campo];
  }

  if (limpio.rol !== undefined) {
    if (!ROLES_VALIDOS.has(limpio.rol)) {
      throw crearError('invalid-argument', `Rol invalido: ${limpio.rol}`);
    }
    if (limpio.rol === 'SuperAdmin' && auth.token?.rol !== 'SuperAdmin') {
      throw crearError('permission-denied', 'Solo un SuperAdmin puede asignar el rol SuperAdmin');
    }
  }

  const contrato = {};
  for (const [origen, destino] of Object.entries(CAMPOS_CONTRATO)) {
    if (cambios[origen] !== undefined) contrato[destino] = cambios[origen];
  }
  if (Object.keys(contrato).length > 0) limpio.contrato = contrato;

  return limpio;
}

function crearServicioActualizarUsuarioStaff({ firestore }) {
  return async function actualizarUsuarioStaff(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    const usuarioId = String(data?.usuarioId || '').trim();

    assertTenantAutorizado(tenantId, auth);

    if (!usuarioId) {
      throw crearError('invalid-argument', 'El usuario a actualizar es obligatorio');
    }

    const ref = firestore.collection('usuarios').doc(usuarioId);
    const snap = await ref.get();

    if (snap.exists) {
      const existente = snap.data();
      if (existente.tenantId !== tenantId) {
        throw crearError('permission-denied', 'El usuario no pertenece a este tenant');
      }
    }

    const cambios = sanitizarCambios(data?.cambios, auth);
    const payload = { ...cambios, tenantId };

    await ref.set(payload, { merge: true });

    const actualizado = await ref.get();
    return { id: usuarioId, ...actualizado.data() };
  };
}

// Fix ERR-ORPHAN-AUTH (2026-10-08): estado huerfano Auth-sin-Firestore.
// agregarUsuario (cliente) no puede obtener el UID de un usuario existente;
// este callable usa Admin SDK (authAdmin.getUserByEmail) para hacerlo de forma segura.
function crearServicioRepararOCrearUsuarioStaff({ firestore, authAdmin }) {
  return async function repararOCrearUsuarioStaff(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    const email = String(data?.email || '').trim().toLowerCase();
    const datosUsuario = data?.datosUsuario;

    assertTenantAutorizado(tenantId, auth);

    if (!email) throw crearError('invalid-argument', 'El email es obligatorio');
    if (!datosUsuario) throw crearError('invalid-argument', 'datosUsuario es obligatorio');

    // Obtener el UID existente en Auth via Admin SDK.
    let userRecord;
    try {
      userRecord = await authAdmin.getUserByEmail(email);
    } catch (e) {
      // Si no existe en Auth tampoco, el cliente deberia haber podido crear el usuario.
      // Esto es un estado inesperado; lanzar para que el cliente reintente el flujo normal.
      throw crearError('not-found', 'El correo no existe en Authentication. Reintenta el registro.');
    }

    const uid = userRecord.uid;
    const ref = firestore.collection('usuarios').doc(uid);
    const snap = await ref.get();

    // Si ya existe el documento, NO es un huerfano -- es un duplicado real.
    if (snap.exists) {
      const existente = snap.data();
      // Solo bloqueamos si pertenece al mismo tenant; cross-tenant lo puede ver SuperAdmin.
      if (existente.tenantId === tenantId || auth.token?.rol !== 'SuperAdmin') {
        throw crearError('already-exists', 'Este correo ya tiene un usuario registrado activo.');
      }
    }

    // Crear el documento faltante con el UID existente.
    const camposPermitidos = [
      'nombreUsuario', 'email', 'rol', 'whatsapp', 'numeroIdentificacion', 'sedeId',
    ];
    const payload = { tenantId };
    for (const campo of camposPermitidos) {
      if (datosUsuario[campo] !== undefined) payload[campo] = datosUsuario[campo];
    }

    if (payload.rol !== undefined && !ROLES_VALIDOS.has(payload.rol)) {
      throw crearError('invalid-argument', `Rol invalido: ${payload.rol}`);
    }
    if (payload.rol === 'SuperAdmin' && auth.token?.rol !== 'SuperAdmin') {
      throw crearError('permission-denied', 'Solo un SuperAdmin puede asignar el rol SuperAdmin');
    }

    payload.email = email;
    await ref.set(payload);

    return { id: uid, ...payload };
  };
}

module.exports = {
  crearServicioActualizarUsuarioStaff,
  crearServicioRepararOCrearUsuarioStaff,
};
