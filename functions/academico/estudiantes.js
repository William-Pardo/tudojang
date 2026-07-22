// functions/academico/estudiantes.js
// Callable `crearEstudiante`: alta segura de estudiantes con validacion server-side del
// limite del plan (+ addons). Reemplaza el write directo de cliente a `estudiantes/{id}`
// para `create` (bloqueado sin excepcion por firestore.rules a partir de este cambio,
// mismo criterio ya usado para `sedes/{id}` -- ver academico/sedes.js).
//
// Motivo (bug real, mismo patron que sedes 2026-07-16): el limite `limiteEstudiantes` del
// plan SOLO se validaba en el boton de la UI (hooks/useGestionEstudiantes.ts,
// abrirFormulario). firestore.rules permitia `create` a cualquier Instructor
// (Admin/Editor/Asistente/Maestro/SuperAdmin) sin chequear cantidad -- un write directo a
// Firestore (dev tools del navegador, o cualquier codigo que llamara a
// servicios/estudiantesApi.ts::agregarEstudiante) creaba estudiantes sin limite, incluida
// la importacion masiva (components/ModalImportacionMasiva.tsx), que invoca ese mismo
// punto de entrada en loop, uno por fila.
//
// A diferencia de sedes, `update`/`delete` de estudiantes NO se tocan aca (uso mucho mas
// frecuente que en sedes -- cambios de estado de pago, edicion de datos -- fuera de
// alcance de este fix puntual). Solo `create` pasa a requerir esta Cloud Function.

'use strict';

const { planes: PLANES_SAAS } = require('../planes-config.json');

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Derivado de planes-config.json (fuente unica de verdad, compartida con constantes.ts
// del frontend y con wompiCobroAutomatico.js) -- se usa SOLO como fallback defensivo si
// el doc del tenant no tuviera `limiteEstudiantes` seteado (no deberia ocurrir en
// produccion: registrarNuevaEscuela/actualizarPlanClub siempre lo setean). El limite real
// a validar es `tenant.limiteEstudiantes` tal cual vive en el doc -- YA incluye plan base
// + addons comprados (ver constantes.ts::COSTOS_ADICIONALES.estudiantes y
// servicios/configuracionApi.ts::actualizarCapacidadClub, que hace `increment(cantidad)`
// directo sobre ese mismo campo al comprar el addon "+10 Alumnos"). A diferencia de sedes
// (que no tiene ese mecanismo de addon acumulativo), NO se recalcula plan + cupos aca: se
// lee el campo ya consolidado.
const LIMITE_ESTUDIANTES_POR_PLAN = Object.fromEntries(
  Object.entries(PLANES_SAAS).map(([plan, datos]) => [plan, datos.limiteEstudiantes])
);

// Mismo rol operativo que `isInstructor()` en firestore.rules: Admin/Editor/Asistente/
// Maestro/SuperAdmin. Editor/Asistente/Maestro pueden dar de alta estudiantes hoy (no solo
// Admin) -- restringir a Admin solamente cambiaria el comportamiento actual mas alla del
// bug que se esta arreglando.
const ROLES_INSTRUCTOR = ['Admin', 'Editor', 'Asistente', 'Maestro', 'SuperAdmin'];

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertEsInstructor(auth) {
  const rol = auth.token?.rol;
  if (!ROLES_INSTRUCTOR.includes(rol)) {
    throw crearError('permission-denied', 'Solo un instructor puede gestionar estudiantes');
  }
}

// SuperAdmin opera cross-tenant por diseno (mismo criterio que academico/sedes.js);
// el resto de roles queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

// Estudiante no tiene concepto de soft-delete (a diferencia de Sede/`deletedAt`) -- las
// bajas son borrado fisico (`eliminarEstudiante` -> deleteDoc). Se cuentan todos los docs
// del tenant sin filtrar.
async function contarEstudiantesDelTenant(firestore, tenantId) {
  const snap = await firestore.collection('estudiantes').where('tenantId', '==', tenantId).get();
  return snap.docs.length;
}

async function obtenerLimiteEstudiantes(firestore, tenantId) {
  const tenantSnap = await firestore.collection('tenants').doc(tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() : {};
  if (typeof tenantData.limiteEstudiantes === 'number') {
    return tenantData.limiteEstudiantes;
  }
  return LIMITE_ESTUDIANTES_POR_PLAN[tenantData.plan] || 0;
}

/**
 * Crea un estudiante nuevo. Re-valida server-side lo que antes solo chequeaba el boton de
 * la UI (hooks/useGestionEstudiantes.ts::abrirFormulario): que no se supere
 * `tenant.limiteEstudiantes` (plan base + addons ya acumulados en ese mismo campo).
 */
function crearServicioCrearEstudiante({ firestore }) {
  return async function crearEstudiante(data, context) {
    const auth = requireAuth(context);
    assertEsInstructor(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    const cantidadActual = await contarEstudiantesDelTenant(firestore, tenantId);
    const limite = await obtenerLimiteEstudiantes(firestore, tenantId);
    if (cantidadActual >= limite) {
      throw crearError(
        'resource-exhausted',
        `Límite del plan superado (${limite} alumnos). Por favor, suba de plan o agregue un addon para agregar más estudiantes.`
      );
    }

    // `id` nunca se toma del cliente (lo asigna Firestore); `tenantId` se fija al validado
    // arriba, no al que venga en el payload, para que nadie pueda crear un estudiante en
    // un tenant distinto al propio.
    const { id: _idIgnorado, tenantId: _tenantIdIgnorado, ...camposEstudiante } = data || {};
    const payload = {
      ...camposEstudiante,
      historialPagos: Array.isArray(camposEstudiante.historialPagos) ? camposEstudiante.historialPagos : [],
      carnetGenerado: false,
      tenantId,
    };

    const ref = await firestore.collection('estudiantes').add(payload);
    const creado = await ref.get();
    return { id: ref.id, ...creado.data() };
  };
}

module.exports = {
  crearServicioCrearEstudiante,
};
