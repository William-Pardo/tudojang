// functions/academico/estudiantes.js
// Callable `crearEstudiante`: alta segura de estudiantes (auth/rol/tenant server-side).
// Reemplaza el write directo de cliente a `estudiantes/{id}` para `create` (bloqueado sin
// excepcion por firestore.rules a partir de este cambio, mismo criterio ya usado para
// `sedes/{id}` -- ver academico/sedes.js).
//
// SDD pricing-cupo-real (Bloque 3b, capacidad-tenant): el tope duro por plan que este archivo
// tenia (`resource-exhausted` al superar `tenant.limiteEstudiantes`) SE ELIMINA -- ya no hay
// planes fijos, y capacidad-tenant exige "Alta nunca se bloquea por limite de capacidad o
// plan". En su lugar, DESPUES de escribir el doc del estudiante nuevo (D4, design.md: el
// estudiante 70 debe contarse a si mismo), se evalua si el tenant acaba de cruzar 70
// estudiantes ACTIVOS por primera vez y, si es asi, se otorga +1 sede incluida de forma
// PERMANENTE (`sedeBonusOtorgada`), nunca revocada ni recalculada en vivo -- ver
// evaluarBonoSedePorCrecimiento mas abajo.
//
// A diferencia de sedes, `update`/`delete` de estudiantes NO se tocan aca (uso mucho mas
// frecuente que en sedes -- cambios de estado de pago, edicion de datos -- fuera de
// alcance de este fix puntual). Solo `create` pasa a requerir esta Cloud Function.

'use strict';

const { bonoSede: BONO_SEDE_CONFIG } = require('../facturacion-config.json');

const crearError = (code, message) => Object.assign(new Error(message), { code });

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

// Cuenta estudiantes FACTURABLES (estadoMatricula=='activo') del tenant via una agregacion
// `.count()` de Firestore -- NO un `.get()` completo. `crearEstudiante` es un hot path
// (ModalImportacionMasiva.tsx lo llama una vez por fila de CSV, D5's rationale en design.md),
// asi que evaluar el bono de sede en CADA alta no puede pagar el costo de traer todos los
// documentos del tenant solo para contarlos. Mismo patron de query (independiente, sin modulo
// compartido -- ver la nota equivalente en wompiCobroAutomatico.js) que
// crearContadorEstudiantesFacturablesFirestore en ese archivo y en vigilanciaFacturacion.js.
async function contarEstudiantesFacturablesDelTenant(firestore, tenantId) {
  const snapshot = await firestore
    .collection('estudiantes')
    .where('tenantId', '==', tenantId)
    .where('estadoMatricula', '==', 'activo')
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * SDD pricing-cupo-real (D4, design.md "Sede bonus persistence"): la PRIMERA vez que un
 * tenant cruza `BONO_SEDE_CONFIG.umbralEstudiantes` (70) estudiantes matriculados activos, se
 * otorga +1 sede incluida de forma PERMANENTE -- write-once, guardado por
 * `sedeBonusOtorgada !== true`. Nunca se revoca ni se recalcula en vivo:
 * `calcularCapacidad` (functions/facturacion.js, no reabierta aca) solo LEE este flag, jamas
 * un conteo. El boolean hace que la carrera concurrente 69->70 sea inofensiva por
 * construccion -- dos llamadas que racean escriben el MISMO valor (`true`), no hay
 * doble-otorgamiento posible, asi que esto NO necesita una transaccion Firestore.
 *
 * Se cuenta SIEMPRE (no solo cuando el tenant aun no tiene el bono) -- mismo orden que el
 * diagrama de flujo de design.md ("Data Flow"): la agregacion `.count()` es lo bastante barata
 * (no un `.get()`) como para que este orden simple sea aceptable incluso para un tenant que ya
 * paso el umbral hace tiempo.
 */
async function evaluarBonoSedePorCrecimiento(firestore, tenantId) {
  const cantidadFacturable = await contarEstudiantesFacturablesDelTenant(firestore, tenantId);
  if (cantidadFacturable < BONO_SEDE_CONFIG.umbralEstudiantes) return;

  const tenantRef = firestore.collection('tenants').doc(tenantId);
  const tenantSnap = await tenantRef.get();
  const yaOtorgado = tenantSnap.exists && tenantSnap.data()?.sedeBonusOtorgada === true;
  if (yaOtorgado) return;

  // set + merge (no update): mismo criterio ya usado en academico/capacidad.js -- funciona
  // igual si el doc del tenant ya existe (siempre deberia, en produccion) o si un fake de
  // test no lo sembro de antemano.
  await tenantRef.set(
    { sedeBonusOtorgada: true, sedeBonusOtorgadaEn: new Date().toISOString() },
    { merge: true }
  );
}

// Normaliza a minusculas y sin espacios los DOS correos con los que despues se resuelve
// identidad: el del alumno y el del acudiente.
//
// BUG QUE ARREGLA (2026-07-22, encontrado con las pruebas de integracion de identidad):
// `servicios/academico/tutorStudentResolver.js::resolveLinkedStudent` resuelve los hijos de
// un acudiente con `where('tutor.correo', '==', emailNormalizado)`, y ese email sale de
// Auth ya en minusculas. La consulta de igualdad de Firestore es EXACTA y SENSIBLE A
// MAYUSCULAS, asi que un doc guardado con "Papa@Gajog.com" NUNCA matchea: el padre entra y
// ve una pantalla vacia, sin error, para siempre.
//
// Habia dos caminos de alta y solo uno normalizaba:
//   - formulario de admin  -> hooks/useGestionEstudiantes.ts:112-120  SI normalizaba
//   - importacion masiva   -> components/ModalImportacionMasiva.tsx   NO (linea 232; el
//     correo del ALUMNO si, el del ACUDIENTE no, en el mismo objeto literal)
// y la importacion masiva es justo como un club da de alta a 100 alumnos de una.
//
// Se centraliza aca porque esta Cloud Function es el UNICO punto por el que pasan todas las
// altas (`estudiantesApi.agregarEstudiante` -> callable `crearEstudiante`); normalizar solo
// en el cliente deja el agujero abierto para cualquier otro llamador.
//
// OJO: esto NO arregla los documentos YA guardados con mayusculas. Eso requiere una
// migracion de datos. Ver ACCIONES_PENDIENTES.md.
function normalizarCorreos(campos) {
  const normalizado = {};

  if (typeof campos.correo === 'string') {
    normalizado.correo = campos.correo.toLowerCase().trim();
  }

  if (campos.tutor && typeof campos.tutor.correo === 'string') {
    normalizado.tutor = { ...campos.tutor, correo: campos.tutor.correo.toLowerCase().trim() };
  }

  return normalizado;
}

/**
 * Crea un estudiante nuevo. SDD pricing-cupo-real (Bloque 3b, capacidad-tenant): ya NO
 * re-valida un limite de plan -- "Alta nunca se bloquea por limite de capacidad". Despues de
 * escribir el doc (D4: el estudiante 70 debe contarse a si mismo), evalua si el tenant acaba
 * de cruzar el umbral del bono de sede.
 */
function crearServicioCrearEstudiante({ firestore }) {
  return async function crearEstudiante(data, context) {
    const auth = requireAuth(context);
    assertEsInstructor(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    // `id` nunca se toma del cliente (lo asigna Firestore); `tenantId` se fija al validado
    // arriba, no al que venga en el payload, para que nadie pueda crear un estudiante en
    // un tenant distinto al propio.
    const { id: _idIgnorado, tenantId: _tenantIdIgnorado, ...camposEstudiante } = data || {};
    const payload = {
      ...camposEstudiante,
      ...normalizarCorreos(camposEstudiante),
      historialPagos: Array.isArray(camposEstudiante.historialPagos) ? camposEstudiante.historialPagos : [],
      carnetGenerado: false,
      // SDD pricing-cupo-real (Bloque 1, matricula-estado-estudiante, D3): estampado
      // incondicional -- ignora cualquier estadoMatricula que venga en el payload del
      // cliente, igual que carnetGenerado/tenantId arriba. `facturacion-metered` lee este
      // campo para decidir que estudiante es facturable; todo alta nueva nace 'activo',
      // nunca 'retirado' por defecto.
      estadoMatricula: 'activo',
      tenantId,
    };

    const ref = await firestore.collection('estudiantes').add(payload);
    const creado = await ref.get();

    // El estudiante YA esta creado en este punto -- esa es la operacion primaria y no debe
    // fallar por un problema transitorio en el efecto secundario del bono (mismo criterio ya
    // usado para enviarCorreoFalloPago en wompiCobroAutomatico.js: un try/catch aislado evita
    // que un error de infraestructura en el "extra" tumbe el flujo principal). Si esta
    // evaluacion falla una vez, se auto-corrige en la proxima alta del mismo tenant (se
    // evalua en cada `crearEstudiante`, no solo la primera vez que se cruza el umbral).
    try {
      await evaluarBonoSedePorCrecimiento(firestore, tenantId);
    } catch (error) {
      console.error(
        `[crearEstudiante] No fue posible evaluar el bono de sede para el tenant ${tenantId}:`,
        error
      );
    }

    return { id: ref.id, ...creado.data() };
  };
}

module.exports = {
  crearServicioCrearEstudiante,
};
