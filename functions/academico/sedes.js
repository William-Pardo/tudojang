// functions/academico/sedes.js
// Callables `createSede`/`updateSede`/`deleteSede`: alta/edicion/baja segura de sedes.
// Reemplaza el write directo de cliente a `sedes/{id}` (bloqueado sin excepcion por
// firestore.rules a partir de este cambio, mismo criterio ya usado para `usuarios/{uid}`
// -- ver academico/usuarios.js).
//
// Motivo (bug real 2026-07-16): el limite de sedes del plan ("Plan Starter: 2 sedes")
// SOLO se validaba en el boton de la UI (Configuracion.tsx), nunca en el servidor.
// firestore.rules permitia `create` a cualquier Admin sin chequear cantidad -- una
// llamada directa a `agregarSede()` desde la consola del navegador (o cualquier otro
// codigo que la invocara) creaba sedes sin limite. Asi se acumularon 12 sedes reales en
// Firestore con un plan que solo permite 2, once de ellas basura de pruebas nunca
// limpiada. Ademas, nada impedia nombres duplicados ("Sede B" x2, "Nueva Sede" x2),
// que hacian ambiguos los selectores de sede en el resto de la app (Programa
// academico, Agenda). Estas funciones cierran ambos huecos server-side.

'use strict';

const { planes: PLANES_SAAS } = require('../planes-config.json');

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Derivado de planes-config.json (fuente unica de verdad, compartida con constantes.ts
// del frontend y con wompiCobroAutomatico.js) -- se extrae solo el campo `limiteSedes`
// porque es el unico que esta funcion necesita validar server-side. El resto del plan
// (precio, caracteristicas, etc.) es informativo y vive solo en el frontend.
const LIMITE_SEDES_POR_PLAN = Object.fromEntries(
  Object.entries(PLANES_SAAS).map(([plan, datos]) => [plan, datos.limiteSedes])
);

const CAMPOS_PERMITIDOS = ['nombre', 'direccion', 'ciudad', 'telefono', 'valorMensualidad'];

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

// SuperAdmin opera cross-tenant por diseno (mismo criterio que academico/usuarios.js);
// Admin queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (rol !== 'Admin' && rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo un administrador puede gestionar sedes');
  }
}

function normalizarNombre(nombre) {
  return String(nombre || '').trim();
}

// Comparacion insensible a mayusculas/espacios repetidos -- "Sede B" y "sede   b" deben
// tratarse como el mismo nombre para evitar la ambiguedad que causo el bug original.
function claveComparable(nombre) {
  return normalizarNombre(nombre).toLowerCase().replace(/\s+/g, ' ');
}

async function obtenerSedesActivas(firestore, tenantId) {
  const snap = await firestore.collection('sedes').where('tenantId', '==', tenantId).get();
  return snap.docs.filter((doc) => !doc.data().deletedAt);
}

async function obtenerLimiteSedes(firestore, tenantId) {
  const tenantSnap = await firestore.collection('tenants').doc(tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() : {};
  const limitePlan = LIMITE_SEDES_POR_PLAN[tenantData.plan] || 0;
  const cuposAdicionales = Number(tenantData.cuposSedesAdicionales) || 0;
  return limitePlan + cuposAdicionales;
}

function sanitizarCampos(cambios = {}) {
  const limpio = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (cambios[campo] !== undefined) limpio[campo] = cambios[campo];
  }
  return limpio;
}

/**
 * Crea una sede nueva. Re-valida server-side lo que antes solo chequeaba el boton de
 * la UI: (1) que no se supere el limite de sedes activas del plan (+ cupos adicionales
 * comprados), y (2) que el nombre no colisione (insensible a mayusculas/espacios) con
 * una sede activa existente del mismo tenant.
 */
function crearServicioCreateSede({ firestore }) {
  return async function createSede(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    const nombre = normalizarNombre(data?.nombre);
    if (!nombre) {
      throw crearError('invalid-argument', 'El nombre de la sede es obligatorio');
    }

    const sedesActivas = await obtenerSedesActivas(firestore, tenantId);

    const limite = await obtenerLimiteSedes(firestore, tenantId);
    if (sedesActivas.length >= limite) {
      throw crearError(
        'resource-exhausted',
        `Límite de sedes alcanzado (${limite}). Amplía tu plan para agregar más sucursales.`
      );
    }

    const colisiona = sedesActivas.some((doc) => claveComparable(doc.data().nombre) === claveComparable(nombre));
    if (colisiona) {
      throw crearError('failed-precondition', `Ya existe una sede llamada "${nombre}" en este tenant`);
    }

    const payload = { ...sanitizarCampos(data), nombre, tenantId };
    const ref = await firestore.collection('sedes').add(payload);
    const creado = await ref.get();
    return { id: ref.id, ...creado.data() };
  };
}

/**
 * Actualiza una sede existente. Si el cambio incluye `nombre`, re-valida la misma
 * unicidad que `createSede` (excluyendo la propia sede que se esta editando).
 * `deletedAt`/`tenantId`/`id` quedan fuera a proposito: la baja es responsabilidad de
 * `deleteSede`, y el tenant nunca se toma de `cambios` para que un Admin no pueda mover
 * una sede a otro tenant.
 */
function crearServicioUpdateSede({ firestore }) {
  return async function updateSede(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    const sedeId = String(data?.sedeId || '').trim();
    if (!sedeId) {
      throw crearError('invalid-argument', 'La sede a actualizar es obligatoria');
    }

    const ref = firestore.collection('sedes').doc(sedeId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw crearError('not-found', 'La sede especificada no existe');
    }
    if (snap.data().tenantId !== tenantId) {
      throw crearError('permission-denied', 'La sede no pertenece a este tenant');
    }

    const cambios = sanitizarCampos(data?.cambios);

    if (cambios.nombre !== undefined) {
      const nombreNuevo = normalizarNombre(cambios.nombre);
      if (!nombreNuevo) {
        throw crearError('invalid-argument', 'El nombre de la sede no puede quedar vacío');
      }
      const sedesActivas = await obtenerSedesActivas(firestore, tenantId);
      const colisiona = sedesActivas.some(
        (doc) => doc.id !== sedeId && claveComparable(doc.data().nombre) === claveComparable(nombreNuevo)
      );
      if (colisiona) {
        throw crearError('failed-precondition', `Ya existe una sede llamada "${nombreNuevo}" en este tenant`);
      }
      cambios.nombre = nombreNuevo;
    }

    await ref.set(cambios, { merge: true });
    const actualizado = await ref.get();
    return { id: sedeId, ...actualizado.data() };
  };
}

/**
 * Baja logica (soft delete, `deletedAt`) de una sede -- mismo comportamiento que ya
 * tenia `sedesApi.eliminarSede` del lado del cliente, solo que ahora corre server-side
 * con re-validacion de tenant. A diferencia de create/update, no exige que el cliente
 * mande `tenantId`: se deriva del PROPIO documento (fuente de verdad), evitando que el
 * llamador tenga que conocerlo de antemano solo para poder borrar.
 */
function crearServicioDeleteSede({ firestore }) {
  return async function deleteSede(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const sedeId = String(data?.sedeId || '').trim();
    if (!sedeId) {
      throw crearError('invalid-argument', 'La sede a eliminar es obligatoria');
    }

    const ref = firestore.collection('sedes').doc(sedeId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw crearError('not-found', 'La sede especificada no existe');
    }

    assertTenantAutorizado(snap.data().tenantId, auth);

    await ref.set({ deletedAt: new Date().toISOString() }, { merge: true });
    return { ok: true, id: sedeId };
  };
}

module.exports = {
  crearServicioCreateSede,
  crearServicioUpdateSede,
  crearServicioDeleteSede,
};
