// functions/academico/carnets.js
// Callables de fabricación física de carnets (Carnetizacion.tsx -> Master/Aliant ->
// MasterDashboard.tsx):
//   - `solicitarFabricacionCarnets`: el club pide producción de sus estudiantes pendientes.
//   - `actualizarEstadoSolicitudCarnets`: Master avanza o rechaza una solicitud existente.
//
// Un carnet físico es indispensable para el estudiante (asistencia a clase, eventos), así
// que la solicitud que lo pide NUNCA se pierde ni se borra -- queda como registro permanente
// para trazabilidad y recuperación, sin importar en qué estado termine (pendiente, en
// producción, rechazada o enviada). `firestore.rules` bloquea `delete` sin excepción; el
// único lugar que puede tocar estos documentos después de creados es este archivo.
//
// Reemplaza el `addDoc`/`updateDoc` directo de cliente a `solicitudes_carnets`: ni la
// cantidad, ni el lote de estudiantes, ni la transición de estado (incluida la reversión al
// rechazar) pueden validarse solo con firestore.rules -- todas requieren leer/escribir otras
// colecciones (`estudiantes`) de forma atómica.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Solo Admin/SuperAdmin dispara una fabricación física (tiene costo real para Aliant) --
// mismo alcance que `isAdmin()` en firestore.rules, más restrictivo que `isInstructor()`
// (Editor/Asistente/Maestro pueden dar de alta estudiantes pero no pedir producción).
const ROLES_ADMIN = ['Admin', 'SuperAdmin'];

// Límite de escritura por transacción de Firestore: 500 operaciones. Se deja margen para el
// doc de la solicitud + el update de cada estudiante en la MISMA transacción, así que el
// tope real de estudiantes por solicitud queda bastante por debajo de 500.
const LIMITE_ESTUDIANTES_POR_SOLICITUD = 400;

// Estados válidos y a qué otro estado puede pasar cada uno. `enviado` y `rechazado` son
// terminales: una vez ahí, la solicitud queda archivada tal cual (nunca se borra, ver nota de
// cabecera), pero ya no se mueve más. "Rechazado" existe para cuando Aliant no puede completar
// el lote -- alcanzable tanto desde `pendiente` (rechazo antes de aceptar el pedido) como
// desde `en_produccion` (se cae después de haber aceptado empezar). Solo Master decide esto,
// nunca el club (mismo alcance que `isSuperAdmin()` en firestore.rules).
const TRANSICIONES_VALIDAS = {
  pendiente: ['en_produccion', 'rechazado'],
  en_produccion: ['enviado', 'rechazado'],
  enviado: [],
  rechazado: [],
};

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (!ROLES_ADMIN.includes(rol)) {
    throw crearError('permission-denied', 'Solo un Admin puede solicitar la fabricación de carnets');
  }
}

function assertEsSuperAdmin(auth) {
  if (auth.token?.rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo Master puede gestionar el estado de una solicitud de carnets');
  }
}

// Mismo criterio que assertTenantAutorizado en academico/estudiantes.js y
// academico/asignaciones.js: SuperAdmin opera cross-tenant por diseño, el resto queda
// acotado a su propio tenant (el del token, nunca el que venga suelto en el payload).
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

/**
 * Crea la solicitud y, en la MISMA transacción, marca `carnetGenerado: true` en cada
 * estudiante incluido. Ese flag es el que ya usa el flujo de impresión local
 * (`marcarCarnetsComoGenerados` en estudiantesApi.ts) para sacar a un estudiante de la cola
 * de "pendientes" -- se reutiliza en vez de agregar un campo nuevo porque el significado real
 * es el mismo en los dos flujos ("este carnet ya no está pendiente, está comprometido"), y
 * reutilizarlo hace que el PRÓXIMO cálculo de pendientes ya no traiga a estos estudiantes. Si
 * la solicitud termina `rechazado`, `actualizarEstadoSolicitudCarnets` revierte este flag
 * (ver más abajo) -- "comprometido" no es lo mismo que "entregado".
 *
 * Por qué transacción y no un `.get()` + `.batch()` sueltos: dos invocaciones casi
 * simultáneas (doble click, dos pestañas, dos Admins del mismo tenant) podían leer el MISMO
 * conjunto de pendientes antes de que cualquiera de las dos confirmara su escritura,
 * generando dos solicitudes duplicadas con los mismos `estudianteIds` -- Aliant recibía dos
 * órdenes de producción física por el mismo lote. `firestore.runTransaction` (mismo patrón ya
 * usado en asistente/cuotas.js) hace que la segunda transacción en confirmar reintente
 * automáticamente: al reintentar, vuelve a leer el estado YA actualizado por la primera (esos
 * estudiantes ya están `carnetGenerado:true`), así que su propio lote queda vacío o reducido
 * al verdadero remanente -- nunca duplicado.
 *
 * Por qué se trae TODO el tenant y se filtra en memoria (`!== true`) en vez de
 * `.where('carnetGenerado','==', false)`: Firestore no matchea con `==` ni con `!=` un
 * documento donde el campo esté ausente -- un estudiante legado sin `carnetGenerado` nunca
 * aparecería en ese query, aunque `Carnetizacion.tsx` sí lo cuenta como pendiente
 * (`!e.carnetGenerado`, que trata "ausente" igual que "false"). Filtrar en memoria con el
 * mismo criterio evita que esos estudiantes queden invisibles para siempre en este flujo.
 */
function crearServicioSolicitudCarnets({ firestore }) {
  return async function solicitarFabricacionCarnets(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    if (!tenantId) {
      throw crearError('invalid-argument', 'Falta el tenant');
    }
    assertTenantAutorizado(tenantId, auth);

    const sedeNombre = String(data?.sedeNombre || '').trim() || 'Principal';
    const solicitudRef = firestore.collection('solicitudes_carnets').doc();

    return firestore.runTransaction(async (tx) => {
      // Toda lectura de una transacción debe completarse antes de la primera escritura --
      // por eso las dos van primero, secuenciales (no Promise.all: `tx.get` sobre una Query
      // no está documentado como seguro para llamar concurrentemente dentro de la misma
      // transacción, y la latencia de una lectura extra acá no es un costo real para una
      // acción que un Admin dispara manualmente, no un hot path).
      const tenantSnap = await tx.get(firestore.collection('tenants').doc(tenantId));
      if (!tenantSnap.exists) {
        throw crearError('not-found', 'Tenant no encontrado');
      }
      // Nombre real del club, resuelto server-side -- no el que mande el cliente. Este valor
      // termina en el correo que recibe Master/Aliant (notificarMasterSolicitudCarnets), así
      // que no puede depender de un display value del cliente.
      const nombreClub = tenantSnap.data()?.nombreClub || tenantId;

      const estudiantesSnap = await tx.get(
        firestore.collection('estudiantes').where('tenantId', '==', tenantId)
      );
      const pendientes = estudiantesSnap.docs.filter((doc) => doc.data()?.carnetGenerado !== true);

      if (pendientes.length === 0) {
        throw crearError('failed-precondition', 'No hay estudiantes pendientes de carnet para este tenant');
      }
      if (pendientes.length > LIMITE_ESTUDIANTES_POR_SOLICITUD) {
        throw crearError(
          'resource-exhausted',
          `Hay ${pendientes.length} estudiantes pendientes -- el máximo por solicitud es ${LIMITE_ESTUDIANTES_POR_SOLICITUD}. Solicita por sede o en varios lotes.`
        );
      }

      const estudianteIds = pendientes.map((doc) => doc.id);
      const ahora = new Date().toISOString();

      tx.set(solicitudRef, {
        tenantId,
        nombreClub,
        sedeNombre,
        cantidad: estudianteIds.length,
        estudianteIds,
        fechaSolicitud: ahora,
        estado: 'pendiente',
        solicitadoPorUid: auth.uid,
        // Historial de transiciones -- se acumula acá y en actualizarEstadoSolicitudCarnets,
        // nunca se sobreescribe ni se borra, es la evidencia de "qué pasó" que pidió trazar.
        historial: [{ estado: 'pendiente', en: ahora, porUid: auth.uid }],
      });
      pendientes.forEach((doc) => {
        tx.update(doc.ref, { carnetGenerado: true });
      });

      return { id: solicitudRef.id, cantidad: estudianteIds.length };
    });
  };
}

/**
 * Avanza o rechaza una solicitud existente. Solo Master (SuperAdmin) la gestiona -- el club
 * únicamente la ve. La solicitud en sí NUNCA se borra pase lo que pase (ver nota de
 * cabecera); esta función solo cambia su `estado` y, si el nuevo estado es `rechazado`,
 * revierte `carnetGenerado` a `false` en cada estudiante del lote en la MISMA transacción --
 * un estudiante rechazado nunca recibió el carnet físico, así que debe poder volver a
 * solicitarse. `enviado` no revierte nada: ya se entregó, es un cierre exitoso.
 */
function crearServicioActualizarEstadoSolicitudCarnets({ firestore }) {
  return async function actualizarEstadoSolicitudCarnets(data, context) {
    const auth = requireAuth(context);
    assertEsSuperAdmin(auth);

    const solicitudId = String(data?.solicitudId || '').trim();
    const nuevoEstado = data?.nuevoEstado;
    if (!solicitudId) {
      throw crearError('invalid-argument', 'Falta el id de la solicitud');
    }
    if (!['en_produccion', 'enviado', 'rechazado'].includes(nuevoEstado)) {
      throw crearError('invalid-argument', 'Estado inválido');
    }

    const solicitudRef = firestore.collection('solicitudes_carnets').doc(solicitudId);

    return firestore.runTransaction(async (tx) => {
      const solicitudSnap = await tx.get(solicitudRef);
      if (!solicitudSnap.exists) {
        throw crearError('not-found', 'Solicitud no encontrada');
      }
      const solicitud = solicitudSnap.data();
      const estadoActual = solicitud.estado;

      const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
      if (!permitidos.includes(nuevoEstado)) {
        throw crearError(
          'failed-precondition',
          `No se puede pasar de "${estadoActual}" a "${nuevoEstado}"`
        );
      }

      const estudianteIds = Array.isArray(solicitud.estudianteIds) ? solicitud.estudianteIds : [];

      if (nuevoEstado === 'rechazado' && estudianteIds.length > 0) {
        // Todas las lecturas de la transacción van antes que cualquier escritura: hay que
        // confirmar que cada estudiante SIGUE existiendo antes de tocarlo (pudo haberse
        // borrado desde que se creó la solicitud). `getAll` es la forma documentada de leer
        // varios docs conocidos dentro de una transacción (mismo patrón que
        // asistente/cuotas.js), a diferencia de un query con `tx.get`.
        const estudianteRefs = estudianteIds.map((id) => firestore.collection('estudiantes').doc(id));
        const estudianteSnaps = await tx.getAll(...estudianteRefs);
        estudianteSnaps.forEach((snap, i) => {
          if (snap.exists) {
            tx.update(estudianteRefs[i], { carnetGenerado: false });
          }
        });
      }

      const ahora = new Date().toISOString();
      tx.update(solicitudRef, {
        estado: nuevoEstado,
        historial: [
          ...(Array.isArray(solicitud.historial) ? solicitud.historial : []),
          { estado: nuevoEstado, en: ahora, porUid: auth.uid },
        ],
      });

      return { id: solicitudId, estado: nuevoEstado };
    });
  };
}

module.exports = {
  crearServicioSolicitudCarnets,
  crearServicioActualizarEstadoSolicitudCarnets,
};
