// servicios/academico/actividadService.ts
// Servicio para registrar actividad académica de estudiantes y calcular métricas.
//
// Colecciones Firestore:
//   - tenants/{tenantId}/actividadLogs/{logId}       → log inmutable por evento
//   - tenants/{tenantId}/metricasEstudiante/{uid}     → métricas agregadas
//
// En modo local (Firebase no configurado) usa almacenamiento en memoria.

import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type {
  ActividadLog,
  MetricasEstudiante,
  AvanceAsignacion,
  TipoActividad,
  MetadatosQuiz,
  MetadatosVideo,
  MetadatosPdf,
} from '../../models/academico/actividad';

// ---------------------------------------------------------------------------
// Almacenamiento en memoria para modo local / tests
// ---------------------------------------------------------------------------

let _mockLogs: ActividadLog[] = [];
let _mockMetricas: MetricasEstudiante[] = [];

export const __resetMockStore = () => {
  _mockLogs = [];
  _mockMetricas = [];
};

export const __getMockLogs = () => _mockLogs;
export const __getMockMetricas = () => _mockMetricas;

// ---------------------------------------------------------------------------
// Tipos de petición/respuesta
// ---------------------------------------------------------------------------

export interface RegistrarActividadRequest {
  tenantId: string;
  estudianteId: string;
  estudianteNombre?: string;
  asignacionId: string;
  recursoId: string;
  tituloRecurso?: string;
  tipo: TipoActividad;
  metadata: ActividadLog['metadata'];
}

export interface RegistrarActividadResponse {
  ok: boolean;
  logId: string;
}

export interface ObtenerActividadesRequest {
  tenantId: string;
  estudianteId?: string;  // si se omite, trae todos los estudiantes del tenant
  asignacionId?: string;
}

export interface ObtenerActividadesResponse {
  logs: ActividadLog[];
}

export interface ObtenerMetricasRequest {
  tenantId: string;
  estudianteId?: string;  // si se omite, trae todos los estudiantes del tenant
}

export interface ObtenerMetricasResponse {
  metricas: MetricasEstudiante[];
}

// ---------------------------------------------------------------------------
// Helpers de cálculo
// ---------------------------------------------------------------------------

/**
 * Determina el porcentaje de consumo de un material basado en los logs.
 */
function calcularPorcentajeConsumo(logs: ActividadLog[]): number {
  if (logs.length === 0) return 0;

  // Para quiz: el hecho de haberlo intentado cuenta como 100% de "consumo"
  const tieneQuiz = logs.some((l) => l.tipo === 'quiz');
  if (tieneQuiz) return 100;

  // Para video: máximo porcentaje visto
  const logsVideo = logs.filter((l) => l.tipo === 'video');
  if (logsVideo.length > 0) {
    const maxPct = Math.max(
      ...logsVideo.map((l) => (l.metadata as MetadatosVideo).porcentajeVisto ?? 0)
    );
    return Math.min(100, Math.round(maxPct));
  }

  // Para PDF: porcentaje de páginas vistas
  const logsPdf = logs.filter((l) => l.tipo === 'pdf');
  if (logsPdf.length > 0) {
    const maxPct = Math.max(
      ...logsPdf.map((l) => (l.metadata as MetadatosPdf).porcentajePaginas ?? 0)
    );
    return Math.min(100, Math.round(maxPct));
  }

  // Para imagen, texto, presentación, apertura: si hay al menos un log = 100%
  const logsGenerico = logs.filter((l) =>
    ['imagen', 'texto', 'presentacion', 'apertura'].includes(l.tipo)
  );
  if (logsGenerico.length > 0) return 100;

  return 0;
}

/**
 * Calcula el score de la última evaluación del estudiante en una asignación.
 */
function calcularScoreUltimoQuiz(logs: ActividadLog[]): number | undefined {
  const quizLogs = logs.filter((l) => l.tipo === 'quiz');
  if (quizLogs.length === 0) return undefined;

  // El desempate va al ULTIMO en llegar, no al primero.
  //
  // Antes esto era `.sort((a, b) => b.registradoEn.localeCompare(a.registradoEn))[0]`.
  // `registradoEn` es un ISO con precision de MILISEGUNDOS y `Array.sort` es estable: ante
  // dos logs con el mismo timestamp el comparador devuelve 0, se conserva el orden de
  // entrada y quedaba seleccionado el PRIMER intento. Una funcion llamada
  // "ultimoQuiz" devolviendo el primero, y el acudiente viendo congelado un score viejo.
  //
  // El empate exacto es la forma facil de reproducirlo, pero el caso real es peor:
  // `registradoEn` se sella con el reloj del DISPOSITIVO, asi que un atraso de hora entre
  // dos intentos (sincronizacion NTP, cambio manual) alcanza para invertir el orden.
  // Recorrer con `>=` deja ganar siempre al ultimo de la lista ante empate, que es el orden
  // de llegada tanto en el store en memoria como en la query ordenada por `registradoEn`.
  const ultimo = quizLogs.reduce((mejor, actual) =>
    actual.registradoEn >= mejor.registradoEn ? actual : mejor
  );

  return (ultimo.metadata as MetadatosQuiz).score ?? undefined;
}

/**
 * Recalcula MetricasEstudiante a partir de los logs actuales de ese estudiante.
 */
function recalcularMetricas(
  tenantId: string,
  estudianteId: string,
  estudianteNombre: string | undefined,
  logs: ActividadLog[]
): MetricasEstudiante {
  // Agrupar logs por asignacionId
  const logsMap = new Map<string, ActividadLog[]>();
  for (const log of logs) {
    const lista = logsMap.get(log.asignacionId) ?? [];
    lista.push(log);
    logsMap.set(log.asignacionId, lista);
  }

  const avancePorAsignacion: AvanceAsignacion[] = [];

  for (const [asignacionId, logsList] of logsMap.entries()) {
    const porcentajeConsumo = calcularPorcentajeConsumo(logsList);
    const scoreUltimaEvaluacion = calcularScoreUltimoQuiz(logsList);
    const vecesEvaluado = logsList.filter((l) => l.tipo === 'quiz').length;
    const tituloRecurso = logsList[0]?.tituloRecurso ?? '';
    const tipoRecurso = logsList[0]?.tipo ?? 'apertura';

    const fechas = logsList.map((l) => l.registradoEn).sort();
    const primeraAperturaEn = fechas[0];
    const ultimaActividadEn = fechas[fechas.length - 1];

    avancePorAsignacion.push({
      asignacionId,
      tituloRecurso,
      tipoRecurso,
      porcentajeConsumo,
      scoreUltimaEvaluacion,
      vecesEvaluado: vecesEvaluado > 0 ? vecesEvaluado : undefined,
      primeraAperturaEn,
      ultimaActividadEn,
    });
  }

  const totalAsignaciones = avancePorAsignacion.length;
  const asignacionesIniciadas = avancePorAsignacion.filter(
    (a) => a.porcentajeConsumo > 0
  ).length;
  const asignacionesCompletadas = avancePorAsignacion.filter(
    (a) => a.porcentajeConsumo >= 80
  ).length;

  const porcentajeGlobalConsumo =
    totalAsignaciones > 0
      ? Math.round(
          avancePorAsignacion.reduce((sum, a) => sum + a.porcentajeConsumo, 0) /
            totalAsignaciones
        )
      : 0;

  const quizLogs = logs.filter((l) => l.tipo === 'quiz');
  const totalEvaluacionesRealizadas = quizLogs.length;
  const promedioScoreEvaluaciones =
    quizLogs.length > 0
      ? Math.round(
          quizLogs.reduce(
            (sum, l) => sum + ((l.metadata as MetadatosQuiz).score ?? 0),
            0
          ) / quizLogs.length
        )
      : 0;

  const todasFechas = logs.map((l) => l.registradoEn).sort();
  const ultimaActividadEn =
    todasFechas.length > 0 ? todasFechas[todasFechas.length - 1] : undefined;

  return {
    estudianteId,
    tenantId,
    estudianteNombre,
    porcentajeGlobalConsumo,
    promedioScoreEvaluaciones,
    totalAsignaciones,
    asignacionesIniciadas,
    asignacionesCompletadas,
    avancePorAsignacion,
    totalEvaluacionesRealizadas,
    ultimaActividadEn,
    actualizadoEn: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Implementación del servicio
// ---------------------------------------------------------------------------

export interface ActividadServiceDeps {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
}

export const crearActividadService = (deps: ActividadServiceDeps = {}) => {
  const getDb = () => deps.db ?? db;
  const firebaseActivo = () =>
    deps.isFirebaseConfigured !== undefined
      ? deps.isFirebaseConfigured
      : isFirebaseConfigured;

  // ---- registrarActividad ------------------------------------------------

  const registrarActividad = async (
    request: RegistrarActividadRequest
  ): Promise<RegistrarActividadResponse> => {
    const {
      tenantId,
      estudianteId,
      estudianteNombre,
      asignacionId,
      recursoId,
      tituloRecurso,
      tipo,
      metadata,
    } = request;

    if (!tenantId || !estudianteId || !asignacionId || !recursoId) {
      throw new Error(
        'registrarActividad: tenantId, estudianteId, asignacionId y recursoId son requeridos'
      );
    }

    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const log: ActividadLog = {
      id: logId,
      tenantId,
      estudianteId,
      estudianteNombre,
      asignacionId,
      recursoId,
      tituloRecurso,
      tipo,
      metadata,
      registradoEn: new Date().toISOString(),
    };

    if (!firebaseActivo()) {
      _mockLogs.push(log);
      // Recalcular métricas en memoria
      const logsEstudiante = _mockLogs.filter(
        (l) => l.tenantId === tenantId && l.estudianteId === estudianteId
      );
      const metricas = recalcularMetricas(
        tenantId,
        estudianteId,
        estudianteNombre,
        logsEstudiante
      );
      const idx = _mockMetricas.findIndex(
        (m) => m.tenantId === tenantId && m.estudianteId === estudianteId
      );
      if (idx >= 0) {
        _mockMetricas[idx] = metricas;
      } else {
        _mockMetricas.push(metricas);
      }
      return { ok: true, logId };
    }

    // Guardar log en Firestore
    const logRef = doc(
      collection(getDb(), 'tenants', tenantId, 'actividadLogs'),
      logId
    );
    await setDoc(logRef, log);

    // Recalcular métricas leyendo todos los logs del estudiante
    const logsRef = collection(getDb(), 'tenants', tenantId, 'actividadLogs');
    const q = query(
      logsRef,
      where('estudianteId', '==', estudianteId),
      orderBy('registradoEn', 'asc')
    );
    const snap = await getDocs(q);
    const todosLogs = snap.docs.map((d) => d.data() as ActividadLog);

    const metricas = recalcularMetricas(
      tenantId,
      estudianteId,
      estudianteNombre,
      todosLogs
    );

    const metricasRef = doc(
      getDb(),
      'tenants',
      tenantId,
      'metricasEstudiante',
      estudianteId
    );
    await setDoc(metricasRef, metricas, { merge: true });

    return { ok: true, logId };
  };

  // ---- obtenerActividades ------------------------------------------------

  const obtenerActividades = async (
    request: ObtenerActividadesRequest
  ): Promise<ObtenerActividadesResponse> => {
    const { tenantId, estudianteId, asignacionId } = request;

    if (!firebaseActivo()) {
      let logs = _mockLogs.filter((l) => l.tenantId === tenantId);
      if (estudianteId) logs = logs.filter((l) => l.estudianteId === estudianteId);
      if (asignacionId) logs = logs.filter((l) => l.asignacionId === asignacionId);
      return { logs };
    }

    const logsRef = collection(getDb(), 'tenants', tenantId, 'actividadLogs');
    let q = query(logsRef, orderBy('registradoEn', 'desc'));
    if (estudianteId) {
      q = query(logsRef, where('estudianteId', '==', estudianteId), orderBy('registradoEn', 'desc'));
    }
    const snap = await getDocs(q);
    let logs = snap.docs.map((d) => d.data() as ActividadLog);
    if (asignacionId) {
      logs = logs.filter((l) => l.asignacionId === asignacionId);
    }
    return { logs };
  };

  // ---- obtenerMetricas ---------------------------------------------------

  const obtenerMetricas = async (
    request: ObtenerMetricasRequest
  ): Promise<ObtenerMetricasResponse> => {
    const { tenantId, estudianteId } = request;

    if (!firebaseActivo()) {
      let metricas = _mockMetricas.filter((m) => m.tenantId === tenantId);
      if (estudianteId) {
        metricas = metricas.filter((m) => m.estudianteId === estudianteId);
      }
      return { metricas };
    }

    const metricasRef = collection(
      getDb(),
      'tenants',
      tenantId,
      'metricasEstudiante'
    );
    const snap = await getDocs(metricasRef);
    let metricas = snap.docs.map((d) => d.data() as MetricasEstudiante);
    if (estudianteId) {
      metricas = metricas.filter((m) => m.estudianteId === estudianteId);
    }
    return { metricas };
  };

  return {
    registrarActividad,
    obtenerActividades,
    obtenerMetricas,
    /** Expuesto para tests internos: recalcula sin side effects de Firebase */
    _recalcularMetricas: recalcularMetricas,
  };
};

// Instancia singleton
export const actividadService = crearActividadService();

// Exports individuales para importación destructurada
export const { registrarActividad, obtenerActividades, obtenerMetricas } =
  actividadService;
