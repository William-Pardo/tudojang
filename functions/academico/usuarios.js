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

// ─── Alta de miembro del equipo (crearUsuarioStaff) ──────────────────────────
// Bug real (2026-10-03): `usuariosApi.ts::agregarUsuario` creaba la cuenta Auth desde el
// navegador (createUserWithEmailAndPassword) y luego escribia `usuarios/{uid}` directo a
// Firestore -- write SIEMPRE rechazado por firestore.rules ("allow create, delete: if
// false"). Resultado: cuenta Auth huerfana sin perfil ni claims, y cada reintento
// devolvia `auth/email-already-in-use`. El alta de CUALQUIER miembro del equipo quedaba
// rota para todos los tenants. Ahora todo el alta ocurre server-side con Admin SDK.

// Solo los roles que ofrece el formulario de Equipo Tecnico (FormularioUsuario.tsx).
// Estudiante/Tutor tienen su propio flujo (crearEstudiante / vinculos) y SuperAdmin nunca
// se asigna desde este formulario.
const ROLES_STAFF_ALTA = new Set(['Admin', 'Editor', 'Asistente', 'Maestro']);

// Minimo exigido por Firebase Auth (auth/invalid-password por debajo de 6).
const LONGITUD_MINIMA_CONTRASENA = 6;

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAJE_EMAIL_YA_REGISTRADO =
  'Este correo ya está registrado en TuDojang. Usa un correo diferente para el nuevo miembro del equipo';

const quitarIndefinidos = (valor) =>
  Object.fromEntries(Object.entries(valor).filter(([, item]) => item !== undefined));

// Espejo server-side de `services/usuariosService.ts::buildUserData` -- misma forma de
// documento que el cliente construia antes. `tenantId`, `email` y `rol` llegan ya
// validados/normalizados; nunca se toman crudos del payload.
function construirDatosUsuarioStaff(datos, { email, rol, tenantId, nombreUsuario }) {
  return quitarIndefinidos({
    nombreUsuario,
    email,
    numeroIdentificacion: datos.numeroIdentificacion,
    whatsapp: datos.whatsapp,
    rol,
    tenantId,
    sedeId: datos.sedeId || '',
    contrato: {
      sueldoBase: datos.sueldoBase || 0,
      duracionMeses: datos.duracionContratoMeses || 0,
      tipoVinculacion: datos.tipoVinculacion || '',
      fechaInicio: datos.fechaInicio || '',
      lugarEjecucion: datos.lugarEjecucion || '',
      firmado: false,
    },
    fcmTokens: [],
  });
}

function validarDatosAlta(datos) {
  const email = String(datos?.email || '').trim().toLowerCase();
  const password = typeof datos?.contrasena === 'string' ? datos.contrasena : '';
  const rol = datos?.rol;
  const nombreUsuario = String(datos?.nombreUsuario || '').trim();

  if (!PATRON_EMAIL.test(email)) {
    throw crearError('invalid-argument', 'El correo electrónico no es válido');
  }
  if (password.length < LONGITUD_MINIMA_CONTRASENA) {
    throw crearError('invalid-argument', `La contraseña debe tener mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`);
  }
  if (!ROLES_STAFF_ALTA.has(rol)) {
    throw crearError('invalid-argument', `Rol invalido para un miembro del equipo: ${rol}`);
  }
  if (!nombreUsuario) {
    throw crearError('invalid-argument', 'El nombre del usuario es obligatorio');
  }

  return { email, password, rol, nombreUsuario };
}

const tieneClaims = (usuarioAuth) =>
  Boolean(usuarioAuth?.customClaims) && Object.keys(usuarioAuth.customClaims).length > 0;

async function existeAlguno(query) {
  const snap = await query.limit(1).get();
  return !snap.empty;
}

// Una cuenta Auth es huerfana SOLO si no tiene NINGUNA señal de pertenecer a alguien:
// sin claims, sin perfil `usuarios/{uid}` (ni otro perfil con ese email), sin ser dueña de
// un tenant (onboarding crea al Admin con uid == tenantId y SIN claims) y sin estudiante
// vinculado como alumno o acudiente. Ante la duda NO es huerfana: borrar/reusar una cuenta
// real seria una toma de cuenta.
async function esCuentaHuerfana({ firestore, usuarioAuth, email }) {
  if (tieneClaims(usuarioAuth)) return false;

  const uid = usuarioAuth.uid;
  const [perfil, tenantPropio] = await Promise.all([
    firestore.collection('usuarios').doc(uid).get(),
    firestore.collection('tenants').doc(uid).get(),
  ]);
  if (perfil.exists || tenantPropio.exists) return false;

  const usuarios = firestore.collection('usuarios');
  const estudiantes = firestore.collection('estudiantes');
  const vinculos = await Promise.all([
    existeAlguno(usuarios.where('email', '==', email)),
    existeAlguno(estudiantes.where('correo', '==', email)),
    existeAlguno(estudiantes.where('tutor.correo', '==', email)),
  ]);
  return !vinculos.some(Boolean);
}

function mapearErrorCreacionAuth(error) {
  if (error?.code === 'auth/email-already-exists') {
    return crearError('already-exists', MENSAJE_EMAIL_YA_REGISTRADO);
  }
  if (error?.code === 'auth/invalid-email') {
    return crearError('invalid-argument', 'El correo electrónico no es válido');
  }
  if (error?.code === 'auth/invalid-password') {
    return crearError('invalid-argument', `La contraseña debe tener mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`);
  }
  return error;
}

function crearServicioCrearUsuarioStaff({ firestore, auth: adminAuth }) {
  return async function crearUsuarioStaff(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    const datos = data?.datos || {};
    const { email, password, rol, nombreUsuario } = validarDatosAlta(datos);

    const crearCuenta = () => adminAuth.createUser({ email, password, displayName: nombreUsuario });

    let usuarioAuth;
    try {
      usuarioAuth = await crearCuenta();
    } catch (error) {
      if (error?.code !== 'auth/email-already-exists') throw mapearErrorCreacionAuth(error);

      const existente = await adminAuth.getUserByEmail(email);
      if (!(await esCuentaHuerfana({ firestore, usuarioAuth: existente, email }))) {
        throw crearError('already-exists', MENSAJE_EMAIL_YA_REGISTRADO);
      }

      // Cuenta huerfana real (p.ej. dejada por el bug del alta desde el cliente): se
      // elimina y se reintenta UNA sola vez.
      console.warn(
        `[crearUsuarioStaff] Eliminando cuenta Auth huerfana ${existente.uid} (sin claims, perfil ni estudiante vinculado) para reintentar el alta en el tenant ${tenantId}`
      );
      await adminAuth.deleteUser(existente.uid);
      try {
        usuarioAuth = await crearCuenta();
      } catch (errorReintento) {
        throw mapearErrorCreacionAuth(errorReintento);
      }
    }

    const uid = usuarioAuth.uid;
    const datosUsuario = construirDatosUsuarioStaff(datos, { email, rol, tenantId, nombreUsuario });

    try {
      // Mismos claims que otorga acceptInvitation (academico/invitaciones.js): firestore.rules
      // lee primero el claim de Auth, asi que sin ellos el nuevo miembro no tendria acceso.
      await adminAuth.setCustomUserClaims(uid, { rol, tenantId });
      await firestore.collection('usuarios').doc(uid).set(datosUsuario);
    } catch (error) {
      // Rollback: nunca dejar una cuenta Auth sin claims/perfil (el bug original).
      try {
        await adminAuth.deleteUser(uid);
      } catch (errorRollback) {
        console.error(
          `[crearUsuarioStaff] No fue posible revertir la cuenta Auth ${uid} tras un fallo en el alta:`,
          errorRollback?.message
        );
      }
      throw error;
    }

    return { id: uid, ...datosUsuario };
  };
}

module.exports = {
  crearServicioActualizarUsuarioStaff,
  crearServicioCrearUsuarioStaff,
};
