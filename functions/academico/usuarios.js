// functions/academico/usuarios.js
// Callable `actualizarUsuarioStaff`: alta/edicion segura de un usuario del equipo
// tecnico (Admin/Editor/Asistente/Maestro/etc). Reemplaza el write directo de cliente
// a `usuarios/{uid}` (bloqueado sin excepcion por firestore.rules: "allow create,
// update, delete: if false" -- DT-0020), que dejaba rota cualquier edicion (incluido
// el cambio de rol Editor->Maestro) para todos los roles, incluido Admin.

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

module.exports = {
  crearServicioActualizarUsuarioStaff,
};
