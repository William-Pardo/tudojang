'use strict';

// Genera/limpia datos DEMO para el panel "Progreso por Estudiante" (metricasEstudiante),
// pedido por el usuario para poder mostrar la funcionalidad en la presentación a los
// padres de Gajog (2026-07-15). Las reglas de Firestore exigen
// `request.auth.uid == estudianteId` para escribir metricasEstudiante/actividadLogs —
// ningún cliente (ni Admin) puede sembrar el progreso de OTRO estudiante desde el
// browser. Por eso esto vive en una Cloud Function con Admin SDK (bypassa reglas),
// gateada a los mismos roles que ya ven este panel (Admin/Editor/SuperAdmin —
// puedeGestionarJornadas en vistas/CentroEstudios.tsx).
//
// Todos los IDs quedan bajo el prefijo PREFIJO_DEMO para poder identificarlos y
// borrarlos limpio con limpiarDatosDemoProgreso una vez pasada la demo.

const crearError = (code, message) => Object.assign(new Error(message), { code });

const PREFIJO_DEMO = 'demo-progreso-';

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertPuedeGestionar(auth) {
  const rol = auth.token?.rol;
  if (!['Admin', 'Editor', 'SuperAdmin'].includes(rol)) {
    throw crearError('permission-denied', 'No autorizado para generar datos demo');
  }
}

// SuperAdmin opera cross-tenant por diseño (mismo criterio que en usuarios.js); Admin/Editor
// quedan acotados a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function diasAtras(dias) {
  return new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
}

function avance({
  asignacionId,
  tituloRecurso,
  tipoRecurso,
  porcentajeConsumo,
  scoreUltimaEvaluacion,
  vecesEvaluado,
  primeraAperturaEn,
  ultimaActividadEn,
}) {
  const item = { asignacionId, tituloRecurso, tipoRecurso, porcentajeConsumo };
  if (scoreUltimaEvaluacion !== undefined) item.scoreUltimaEvaluacion = scoreUltimaEvaluacion;
  if (vecesEvaluado !== undefined) item.vecesEvaluado = vecesEvaluado;
  if (primeraAperturaEn !== undefined) item.primeraAperturaEn = primeraAperturaEn;
  if (ultimaActividadEn !== undefined) item.ultimaActividadEn = ultimaActividadEn;
  return item;
}

/**
 * Agrega un `avancePorAsignacion[]` a los totales de MetricasEstudiante, con la MISMA
 * fórmula que `recalcularMetricas` en servicios/academico/actividadService.ts, para que
 * los datos demo sean indistinguibles de métricas calculadas a partir de logs reales.
 */
function agregar(avancePorAsignacion) {
  const totalAsignaciones = avancePorAsignacion.length;
  const asignacionesIniciadas = avancePorAsignacion.filter((a) => a.porcentajeConsumo > 0).length;
  const asignacionesCompletadas = avancePorAsignacion.filter((a) => a.porcentajeConsumo >= 80).length;
  const porcentajeGlobalConsumo = totalAsignaciones > 0
    ? Math.round(avancePorAsignacion.reduce((s, a) => s + a.porcentajeConsumo, 0) / totalAsignaciones)
    : 0;

  const quizzes = avancePorAsignacion.filter(
    (a) => a.tipoRecurso === 'quiz' && a.scoreUltimaEvaluacion !== undefined
  );
  const totalEvaluacionesRealizadas = quizzes.reduce((s, q) => s + (q.vecesEvaluado || 1), 0);
  const promedioScoreEvaluaciones = quizzes.length > 0
    ? Math.round(quizzes.reduce((s, q) => s + q.scoreUltimaEvaluacion, 0) / quizzes.length)
    : 0;

  const fechas = avancePorAsignacion.map((a) => a.ultimaActividadEn).filter(Boolean).sort();

  const resultado = {
    porcentajeGlobalConsumo,
    promedioScoreEvaluaciones,
    totalAsignaciones,
    asignacionesIniciadas,
    asignacionesCompletadas,
    avancePorAsignacion,
    totalEvaluacionesRealizadas,
  };
  // Firestore rechaza campos con valor `undefined` explícito (causa del 500 original:
  // el estudiante demo sin avancePorAsignacion generaba `ultimaActividadEn: undefined`).
  // Se omite la clave en vez de escribirla vacía.
  if (fechas.length > 0) resultado.ultimaActividadEn = fechas[fechas.length - 1];
  return resultado;
}

// 8 perfiles pensados para cubrir cada badge/estado que arma estadoGlobal() en
// PanelMetricasEstudiantes.tsx: Al día ×2, En progreso ×2, Atrasado ×2, Sin iniciar ×1
// (asignación tocada con 0% — distinto de "sin asignaciones"), Sin asignaciones ×1.
// También cubre los 3 colores de score de quiz (verde/amarillo/rojo), el sufijo "(N×)"
// de reintentos, y los 6 tipos de recurso (video/pdf/imagen/texto/presentacion/quiz).
function construirDataset() {
  return [
    {
      id: `${PREFIJO_DEMO}01`,
      nombre: 'Sofía Ramírez Ortiz',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-poomsae-iljang', tituloRecurso: 'Poomsae Taegeuk Il Jang — Demostración', tipoRecurso: 'video', porcentajeConsumo: 100, primeraAperturaEn: diasAtras(9), ultimaActividadEn: diasAtras(6) }),
        avance({ asignacionId: 'demo-asig-manual-grados', tituloRecurso: 'Manual de Grados y Cinturones', tipoRecurso: 'pdf', porcentajeConsumo: 100, primeraAperturaEn: diasAtras(8), ultimaActividadEn: diasAtras(5) }),
        avance({ asignacionId: 'demo-asig-terminologia', tituloRecurso: 'Terminología Coreana Esencial', tipoRecurso: 'presentacion', porcentajeConsumo: 100, primeraAperturaEn: diasAtras(4), ultimaActividadEn: diasAtras(2) }),
        avance({ asignacionId: 'demo-asig-eval-fundamentos', tituloRecurso: 'Evaluación Teórica — Fundamentos Cinturón Amarillo', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 92, vecesEvaluado: 1, ultimaActividadEn: diasAtras(1) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}02`,
      nombre: 'Mateo Londoño Vélez',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-bandal-chagui', tituloRecurso: 'Técnica de Patada Bandal Chagui', tipoRecurso: 'video', porcentajeConsumo: 90, primeraAperturaEn: diasAtras(10), ultimaActividadEn: diasAtras(7) }),
        avance({ asignacionId: 'demo-asig-manual-grados', tituloRecurso: 'Manual de Grados y Cinturones', tipoRecurso: 'pdf', porcentajeConsumo: 80, primeraAperturaEn: diasAtras(9), ultimaActividadEn: diasAtras(6) }),
        avance({ asignacionId: 'demo-asig-diagrama-sogi', tituloRecurso: 'Diagrama de Posiciones Básicas (Sogi)', tipoRecurso: 'imagen', porcentajeConsumo: 100, primeraAperturaEn: diasAtras(5), ultimaActividadEn: diasAtras(5) }),
        avance({ asignacionId: 'demo-asig-eval-fundamentos', tituloRecurso: 'Evaluación Teórica — Fundamentos Cinturón Amarillo', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 70, vecesEvaluado: 2, ultimaActividadEn: diasAtras(3) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}03`,
      nombre: 'Valentina Osorio Ríos',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-poomsae-iljang', tituloRecurso: 'Poomsae Taegeuk Il Jang — Demostración', tipoRecurso: 'video', porcentajeConsumo: 70, primeraAperturaEn: diasAtras(8), ultimaActividadEn: diasAtras(4) }),
        avance({ asignacionId: 'demo-asig-reglamento', tituloRecurso: 'Reglamento Oficial de Competencia WT', tipoRecurso: 'pdf', porcentajeConsumo: 40, primeraAperturaEn: diasAtras(6), ultimaActividadEn: diasAtras(3) }),
        avance({ asignacionId: 'demo-asig-historia-tkd', tituloRecurso: 'Historia del Taekwondo y Filosofía del Dojang', tipoRecurso: 'texto', porcentajeConsumo: 60, primeraAperturaEn: diasAtras(3), ultimaActividadEn: diasAtras(2) }),
        avance({ asignacionId: 'demo-asig-eval-reglamento', tituloRecurso: 'Evaluación Teórica — Reglamento de Competencia', tipoRecurso: 'quiz', porcentajeConsumo: 100, scoreUltimaEvaluacion: 55, vecesEvaluado: 1, ultimaActividadEn: diasAtras(1) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}04`,
      nombre: 'Samuel Quintero Bravo',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-bandal-chagui', tituloRecurso: 'Técnica de Patada Bandal Chagui', tipoRecurso: 'video', porcentajeConsumo: 55, primeraAperturaEn: diasAtras(6), ultimaActividadEn: diasAtras(4) }),
        avance({ asignacionId: 'demo-asig-manual-grados', tituloRecurso: 'Manual de Grados y Cinturones', tipoRecurso: 'pdf', porcentajeConsumo: 35, primeraAperturaEn: diasAtras(5), ultimaActividadEn: diasAtras(3) }),
        avance({ asignacionId: 'demo-asig-terminologia', tituloRecurso: 'Terminología Coreana Esencial', tipoRecurso: 'presentacion', porcentajeConsumo: 50, primeraAperturaEn: diasAtras(3), ultimaActividadEn: diasAtras(2) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}05`,
      nombre: 'Isabella Cárdenas Muñoz',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-poomsae-iljang', tituloRecurso: 'Poomsae Taegeuk Il Jang — Demostración', tipoRecurso: 'video', porcentajeConsumo: 20, primeraAperturaEn: diasAtras(12), ultimaActividadEn: diasAtras(11) }),
        avance({ asignacionId: 'demo-asig-reglamento', tituloRecurso: 'Reglamento Oficial de Competencia WT', tipoRecurso: 'pdf', porcentajeConsumo: 15, primeraAperturaEn: diasAtras(10), ultimaActividadEn: diasAtras(9) }),
        avance({ asignacionId: 'demo-asig-historia-tkd', tituloRecurso: 'Historia del Taekwondo y Filosofía del Dojang', tipoRecurso: 'texto', porcentajeConsumo: 10, primeraAperturaEn: diasAtras(9), ultimaActividadEn: diasAtras(9) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}06`,
      nombre: 'Nicolás Vargas Peña',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-bandal-chagui', tituloRecurso: 'Técnica de Patada Bandal Chagui', tipoRecurso: 'video', porcentajeConsumo: 30, primeraAperturaEn: diasAtras(14), ultimaActividadEn: diasAtras(13) }),
        avance({ asignacionId: 'demo-asig-manual-grados', tituloRecurso: 'Manual de Grados y Cinturones', tipoRecurso: 'pdf', porcentajeConsumo: 20, primeraAperturaEn: diasAtras(13), ultimaActividadEn: diasAtras(12) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}07`,
      nombre: 'Emmanuel Castro Salazar',
      avancePorAsignacion: [
        avance({ asignacionId: 'demo-asig-poomsae-iljang', tituloRecurso: 'Poomsae Taegeuk Il Jang — Demostración', tipoRecurso: 'video', porcentajeConsumo: 0, primeraAperturaEn: diasAtras(2), ultimaActividadEn: diasAtras(2) }),
      ],
    },
    {
      id: `${PREFIJO_DEMO}08`,
      nombre: 'Mariana Gómez Salinas',
      avancePorAsignacion: [],
    },
  ];
}

function crearServicioGenerarDatosDemoProgreso({ firestore, now = () => new Date() }) {
  return async function generarDatosDemoProgreso(data, context) {
    const auth = requireAuth(context);
    assertPuedeGestionar(auth);

    const tenantId = String(data?.tenantId || '').trim();
    if (!tenantId) throw crearError('invalid-argument', 'tenantId requerido');
    assertTenantAutorizado(tenantId, auth);

    const dataset = construirDataset();
    const coleccion = firestore.collection('tenants').doc(tenantId).collection('metricasEstudiante');

    for (const estudiante of dataset) {
      const metricas = {
        estudianteId: estudiante.id,
        tenantId,
        estudianteNombre: estudiante.nombre,
        ...agregar(estudiante.avancePorAsignacion),
        actualizadoEn: now().toISOString(),
      };
      await coleccion.doc(estudiante.id).set(metricas);
    }

    return { ok: true, generados: dataset.length };
  };
}

function crearServicioLimpiarDatosDemoProgreso({ firestore }) {
  return async function limpiarDatosDemoProgreso(data, context) {
    const auth = requireAuth(context);
    assertPuedeGestionar(auth);

    const tenantId = String(data?.tenantId || '').trim();
    if (!tenantId) throw crearError('invalid-argument', 'tenantId requerido');
    assertTenantAutorizado(tenantId, auth);

    const coleccion = firestore.collection('tenants').doc(tenantId).collection('metricasEstudiante');
    const snap = await coleccion.get();

    let eliminados = 0;
    for (const doc of snap.docs) {
      if (doc.id.startsWith(PREFIJO_DEMO)) {
        await doc.ref.delete();
        eliminados += 1;
      }
    }

    return { ok: true, eliminados };
  };
}

module.exports = {
  crearServicioGenerarDatosDemoProgreso,
  crearServicioLimpiarDatosDemoProgreso,
  PREFIJO_DEMO,
  _construirDataset: construirDataset,
  _agregar: agregar,
};
