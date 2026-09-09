'use strict';

// functions/academico/indicadoresEstudiante.js
// Módulo "Indicadores de Estudiante": detección DETERMINÍSTICA (sin IA) de patrones de riesgo
// de deserción y candidatos a fidelización, a partir de la asistencia real ya acumulada.
//
// Decisión de arquitectura explícita: nada de esto usa Gemini/LLM. Un LLM no es confiable para
// aritmética exacta sobre datos de negocio (ver ERR-0029, bitacora.json: Gemini leyó mal un
// monto por ambigüedad de formato, el mismo día que se diseñó este módulo) -- todo el cálculo
// es código puro, auditable y cubierto por tests.
//
// Patrón de fábrica + deps inyectadas + test con node:test, igual que recordatoriosPago.js/
// recordatoriosEstudio.js: este archivo no toca Firestore directamente, solo recibe datos ya
// resueltos vía deps (functions/index.js es quien conecta admin.firestore()).

const crearError = (code, message) => Object.assign(new Error(message), { code });

// --- Umbrales ajustables (nombres claros, todo en un solo lugar) --------------------------
// Valores iniciales razonables definidos por el orquestador del feature; se pueden recalibrar
// acá sin tocar la lógica de abajo.
const UMBRAL_ASISTENCIA_RIESGO = 0.6; // <60% de asistencia reciente = alerta
const VENTANA_ASISTENCIA_RIESGO_DIAS = 28; // 4 semanas
const UMBRAL_TARDANZAS_RIESGO = 3; // 3+ tardanzas
const VENTANA_TARDANZAS_RIESGO_DIAS = 14; // 2 semanas

const UMBRAL_ASISTENCIA_FIDELIZACION = 0.9; // >=90% sostenido
const VENTANA_ASISTENCIA_FIDELIZACION_DIAS = 90; // 3 meses
const ANTIGUEDAD_MINIMA_FIDELIZACION_DIAS = 180; // 6 meses
const VENTANA_TARDANZAS_FIDELIZACION_DIAS = 30; // 1 mes (0 tardanzas exigidas)

// Umbral superior para la severidad 'alta' de candidato_fidelizacion -- mismo criterio de 2
// niveles que riesgo_desercion (ver WHY junto a `severidad` más abajo): "excepcional" exige
// AMBAS condiciones más estrictas a la vez, no una interpolación arbitraria.
const UMBRAL_ASISTENCIA_FIDELIZACION_ALTA = 0.98;
const ANTIGUEDAD_FIDELIZACION_ALTA_DIAS = 365;

// Ventana total que la orquestación (functions/index.js) debe traer del historial de clases
// para poder evaluar TODAS las reglas de arriba -- la mayor de todas las ventanas individuales.
const VENTANA_HISTORIAL_DIAS = Math.max(
  VENTANA_ASISTENCIA_RIESGO_DIAS,
  VENTANA_TARDANZAS_RIESGO_DIAS,
  VENTANA_ASISTENCIA_FIDELIZACION_DIAS,
  VENTANA_TARDANZAS_FIDELIZACION_DIAS
);

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasEntre(desde, hasta) {
  return (hasta.getTime() - new Date(desde).getTime()) / MS_POR_DIA;
}

function redondear(numero, decimales = 3) {
  const factor = 10 ** decimales;
  return Math.round(numero * factor) / factor;
}

// historialClases: un registro por cada clase YA OPERADA (jornada.estado 'cerrada'|'parcial')
// del grupo+sede del estudiante -- ver el WHY completo de esta aproximación en
// functions/index.js (obtenerHistorialClasesFirestore), junto al wiring real de Firestore.
function enVentana(historialClases, ahora, dias) {
  return historialClases.filter((c) => {
    const distancia = diasEntre(c.fecha, ahora);
    return distancia >= 0 && distancia <= dias;
  });
}

// null = sin clases en la ventana (no hay base para juzgar asistencia). Nunca 0/0.
function calcularPorcentajeAsistencia(clases) {
  if (clases.length === 0) return null;
  const asistidas = clases.filter((c) => c.asistio).length;
  return asistidas / clases.length;
}

function contarTardanzas(clases) {
  return clases.filter((c) => c.asistio && c.tarde).length;
}

/**
 * Evalúa, de forma 100% determinística, si UN estudiante cumple HOY los patrones de
 * riesgo_desercion y/o candidato_fidelizacion. Función PURA (sin Firestore) para poder
 * testearla sin mocks de infraestructura -- ver indicadoresEstudiante.test.js.
 *
 * @param {Object} params
 * @param {{id:string, fechaIngreso:string}} params.estudiante
 * @param {Array<{fecha:string, asistio:boolean, tarde:boolean}>} params.historialClases
 * @param {Date} params.ahora
 * @returns {Array<{tipo:string, severidad:'media'|'alta', metricas:Record<string,number>}>}
 */
function evaluarPatrones({ estudiante, historialClases, ahora }) {
  const candidatos = [];

  // --- riesgo_desercion --------------------------------------------------------------------
  const clasesRiesgo = enVentana(historialClases, ahora, VENTANA_ASISTENCIA_RIESGO_DIAS);
  const porcentajeRiesgo = calcularPorcentajeAsistencia(clasesRiesgo);
  const clasesTardanzaRiesgo = enVentana(historialClases, ahora, VENTANA_TARDANZAS_RIESGO_DIAS);
  const tardanzasRiesgo = contarTardanzas(clasesTardanzaRiesgo);

  // Sin clases en la ventana (grupo nuevo, vacaciones, todas canceladas) no hay base para
  // juzgar asistencia -- no se dispara esta condición para evitar un falso positivo por falta
  // de datos, no por mal desempeño real. Nota: la ventana de tardanzas (14 días) es un
  // SUBCONJUNTO de la de asistencia (28 días), así que si esta condición no tiene datos,
  // tampoco puede haber tardanzas suficientes -- por eso `porcentajeRiesgo` está siempre
  // definido cuando este bloque efectivamente dispara un hallazgo.
  const condicionAsistenciaBaja = porcentajeRiesgo !== null && porcentajeRiesgo < UMBRAL_ASISTENCIA_RIESGO;
  const condicionTardanzas = tardanzasRiesgo >= UMBRAL_TARDANZAS_RIESGO;

  if (condicionAsistenciaBaja || condicionTardanzas) {
    // Severidad de 2 niveles a propósito: con solo 2 condiciones booleanas de entrada, una
    // 'baja' intermedia obligaría a inventar un sub-umbral arbitrario ("cerca del 60%") que
    // ningún dato real respalda todavía -- se deja fuera hasta tener series históricas que
    // justifiquen dónde cortarla (ver también HallazgoIndicador.severidad en tipos.ts).
    const severidad = condicionAsistenciaBaja && condicionTardanzas ? 'alta' : 'media';
    candidatos.push({
      tipo: 'riesgo_desercion',
      severidad,
      metricas: {
        porcentajeAsistencia4Semanas: redondear(porcentajeRiesgo),
        clasesEsperadas4Semanas: clasesRiesgo.length,
        tardanzas2Semanas: tardanzasRiesgo,
      },
    });
  }

  // --- candidato_fidelizacion ----------------------------------------------------------------
  const clasesFidelizacion = enVentana(historialClases, ahora, VENTANA_ASISTENCIA_FIDELIZACION_DIAS);
  const porcentajeFidelizacion = calcularPorcentajeAsistencia(clasesFidelizacion);
  const clasesTardanzaFidelizacion = enVentana(historialClases, ahora, VENTANA_TARDANZAS_FIDELIZACION_DIAS);
  const tardanzasFidelizacion = contarTardanzas(clasesTardanzaFidelizacion);
  // fechaIngreso ausente/inválida -> Date inválida -> NaN -> la comparación >= es false, nunca
  // true: un dato faltante falla seguro (no genera fidelización), sin necesidad de un guard
  // explícito.
  const antiguedadDias = diasEntre(estudiante.fechaIngreso, ahora);

  const cumpleAsistenciaAlta = porcentajeFidelizacion !== null && porcentajeFidelizacion >= UMBRAL_ASISTENCIA_FIDELIZACION;
  const cumpleAntiguedad = antiguedadDias >= ANTIGUEDAD_MINIMA_FIDELIZACION_DIAS;
  const cumpleSinTardanzas = tardanzasFidelizacion === 0;

  if (cumpleAsistenciaAlta && cumpleAntiguedad && cumpleSinTardanzas) {
    const esExcepcional = porcentajeFidelizacion >= UMBRAL_ASISTENCIA_FIDELIZACION_ALTA
      && antiguedadDias >= ANTIGUEDAD_FIDELIZACION_ALTA_DIAS;
    candidatos.push({
      tipo: 'candidato_fidelizacion',
      severidad: esExcepcional ? 'alta' : 'media',
      metricas: {
        porcentajeAsistencia3Meses: redondear(porcentajeFidelizacion),
        antiguedadDias: Math.floor(antiguedadDias),
        tardanzasUltimoMes: tardanzasFidelizacion,
      },
    });
  }

  return candidatos;
}

/**
 * Fusiona los patrones detectados HOY con los hallazgos ya guardados (bitácora), decidiendo
 * altas/actualizaciones sin pisar nunca `fechaDeteccion` ni tocar hallazgos ya resueltos.
 *
 * Decisión de diseño: si un patrón DEJA de cumplirse mientras seguía sin resolver, esta función
 * NO lo auto-resuelve -- lo deja intacto para que el Admin lo cierre a mano (con su nota). Auto-
 * resolver rompería la trazabilidad que es el objetivo central del módulo ("desde cuándo está
 * activo un patrón", punto 2 del diseño): si el patrón reaparece días después tras haberse
 * auto-cerrado, se perdería la fecha de detección original. El Admin decide, no la app.
 *
 * @param {Object} params
 * @param {Array<Object>} params.hallazgosExistentes
 * @param {Array<{tipo:string, severidad:string, metricas:Record<string,number>}>} params.candidatosDetectados
 * @param {Date} params.ahora
 * @returns {Array<Object>} el nuevo array completo de hallazgos a persistir
 */
function fusionarHallazgos({ hallazgosExistentes, candidatosDetectados, ahora }) {
  const ahoraIso = ahora.toISOString();
  const fechaHoy = ahoraIso.slice(0, 10);
  const resultado = hallazgosExistentes.map((h) => ({ ...h }));

  for (const candidato of candidatosDetectados) {
    const vigente = resultado.find((h) => h.tipo === candidato.tipo && !h.resuelto);

    if (vigente) {
      vigente.severidad = candidato.severidad;
      vigente.metricas = candidato.metricas;
      vigente.fechaActualizacion = ahoraIso;
      continue;
    }

    const id = `${candidato.tipo}-${fechaHoy}`;
    // El cron corre 1x/día: un id (tipo+día) que YA existe hoy (ej. se resolvió y el patrón
    // volvió a detectarse en la misma corrida, o dos corridas manuales el mismo día) no se
    // resucita ni se duplica -- se creará mañana, con la fecha de mañana, si el patrón
    // persiste. Evita pisar una resolución que el Admin ya guardó.
    if (resultado.some((h) => h.id === id)) continue;

    resultado.push({
      id,
      tipo: candidato.tipo,
      fechaDeteccion: ahoraIso,
      fechaActualizacion: ahoraIso,
      severidad: candidato.severidad,
      metricas: candidato.metricas,
      resuelto: false,
    });
  }

  return resultado;
}

/**
 * Cron diario: evalúa a todos los estudiantes activos y hace upsert de sus indicadores.
 *
 * @param {Object} deps
 * @param {() => Promise<Array<{id:string, tenantId:string, fechaIngreso:string, grupo:string, sedeId:string}>>} deps.listarEstudiantesActivos
 *        Estudiantes con `estadoMatricula !== 'retirado'` de TODOS los tenants (mismo patrón
 *        flat que recordatoriosPago.js/recordatoriosEstudio.js: `estudiantes` es una colección
 *        raíz, no una subcolección por tenant).
 * @param {(tenantId:string, estudiante:Object, ahora:Date) => Promise<Array<{fecha:string,asistio:boolean,tarde:boolean}>>} deps.obtenerHistorialClases
 *        Cara (lee jornadas/asistencias) y NO compite con `resolverHallazgoIndicador` (nunca
 *        toca ese historial) -- se resuelve FUERA de cualquier transacción a propósito, para no
 *        alargar el lock del documento de indicador con trabajo que no lo necesita.
 * @param {(tenantId:string, estudianteId:string, candidatos:Array<Object>, ahora:Date) => Promise<{actualizado:boolean}>} deps.actualizarIndicadorTransaccional
 *        Hace TODO el read-modify-write de `tenants/{tenantId}/indicadoresEstudiante/{estudianteId}`
 *        DENTRO de una única `firestore.runTransaction` (mismo documento y mismo patrón que
 *        `crearServicioResolverHallazgoIndicador` más abajo en este archivo). Necesario porque
 *        el callable `resolverHallazgoIndicador` también escribe ese documento vía transacción:
 *        un read-then-write separado acá (como antes) puede pisar en silencio una resolución de
 *        Admin que ocurrió justo entre la lectura y la escritura del cron -- ver WHY completo en
 *        la bitácora (hallazgo CRITICAL confirmado por review-resilience y review-reliability).
 *        Recibe `candidatos` YA calculados (evaluarPatrones corre afuera, es puro) y decide
 *        adentro si hace falta escribir (misma regla de siempre: sin candidatos y sin indicador
 *        previo, no escribe nada) antes de fusionar y persistir.
 */
function crearServicioIndicadoresEstudiante({
  listarEstudiantesActivos,
  obtenerHistorialClases,
  actualizarIndicadorTransaccional,
}) {
  return async function indicadoresEstudiante(ahora = new Date()) {
    const estudiantes = await listarEstudiantesActivos();
    let actualizados = 0;

    for (const estudiante of estudiantes) {
      const historialClases = await obtenerHistorialClases(estudiante.tenantId, estudiante, ahora);
      const candidatos = evaluarPatrones({ estudiante, historialClases, ahora });

      const { actualizado } = await actualizarIndicadorTransaccional(
        estudiante.tenantId,
        estudiante.id,
        candidatos,
        ahora,
      );
      if (actualizado) actualizados += 1;
    }

    return { evaluados: estudiantes.length, actualizados };
  };
}

// Mismo set que asistencia.js/pagosValidacion.js: Admin/Editor/Asistente/Maestro/SuperAdmin.
const ROLES_AUTORIZADOS_RESOLVER = new Set(['Admin', 'Editor', 'Asistente', 'Maestro', 'SuperAdmin']);

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

// SuperAdmin opera cross-tenant por diseño (mismo criterio ya usado en pagosValidacion.js).
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

/**
 * Callable `resolverHallazgoIndicador`: único writer autorizado para marcar un hallazgo como
 * resuelto (con nota opcional del Admin).
 *
 * Decisión de diseño (ver firestore.rules, match de `indicadoresEstudiante`): esto NO se
 * expone como un `updateDoc` directo del cliente acotado por reglas, aunque el punto 4 del
 * diseño original lo planteaba como opción. Firestore Security Rules no puede validar de forma
 * segura "solo cambiaron 4 campos DENTRO de un elemento de un array de tamaño variable" -- solo
 * puede comparar el campo `hallazgos` completo como bloque. Aceptar cualquier reescritura del
 * array (validando nada más que "solo cambió la clave hallazgos") le permitiría a un cliente
 * comprometido reescribir `fechaDeteccion`/`metricas`/`severidad`/`tipo` de CUALQUIER hallazgo,
 * lo que rompe el propósito entero del módulo (bitácora auditable e inmutable salvo resolución).
 * Por eso el update real corre acá, server-side, validando el diff exacto en código -- y
 * firestore.rules bloquea `update` del cliente por completo (`allow update: if false`).
 */
function crearServicioResolverHallazgoIndicador({ firestore }) {
  return async function resolverHallazgoIndicador(data, context) {
    const auth = requireAuth(context);
    if (!ROLES_AUTORIZADOS_RESOLVER.has(auth.token?.rol)) {
      throw crearError('permission-denied', 'No tienes permiso para resolver indicadores de estudiante');
    }

    const tenantId = String(data?.tenantId || '').trim();
    const estudianteId = String(data?.estudianteId || '').trim();
    const hallazgoId = String(data?.hallazgoId || '').trim();
    const nota = data?.nota ? String(data.nota).trim() : '';

    assertTenantAutorizado(tenantId, auth);

    if (!estudianteId || !hallazgoId) {
      throw crearError('invalid-argument', 'estudianteId y hallazgoId son obligatorios');
    }

    const ref = firestore.collection('tenants').doc(tenantId).collection('indicadoresEstudiante').doc(estudianteId);

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw crearError('not-found', 'No se encontró el indicador de este estudiante');
      }
      const datosDoc = snap.data();
      const hallazgos = Array.isArray(datosDoc.hallazgos) ? datosDoc.hallazgos : [];
      const indice = hallazgos.findIndex((h) => h.id === hallazgoId);
      if (indice === -1) {
        throw crearError('not-found', 'No se encontró ese hallazgo');
      }
      if (hallazgos[indice].resuelto) {
        throw crearError('failed-precondition', 'Este hallazgo ya estaba resuelto');
      }

      const nuevosHallazgos = hallazgos.map((h, i) => {
        if (i !== indice) return h;
        return {
          ...h,
          resuelto: true,
          resueltoEn: new Date().toISOString(),
          resueltoPor: auth.uid,
          ...(nota ? { notaAdmin: nota } : {}),
        };
      });

      tx.update(ref, { hallazgos: nuevosHallazgos });
    });

    return { ok: true };
  };
}

module.exports = {
  evaluarPatrones,
  fusionarHallazgos,
  crearServicioIndicadoresEstudiante,
  crearServicioResolverHallazgoIndicador,
  crearError,
  UMBRAL_ASISTENCIA_RIESGO,
  VENTANA_ASISTENCIA_RIESGO_DIAS,
  UMBRAL_TARDANZAS_RIESGO,
  VENTANA_TARDANZAS_RIESGO_DIAS,
  UMBRAL_ASISTENCIA_FIDELIZACION,
  VENTANA_ASISTENCIA_FIDELIZACION_DIAS,
  ANTIGUEDAD_MINIMA_FIDELIZACION_DIAS,
  VENTANA_TARDANZAS_FIDELIZACION_DIAS,
  UMBRAL_ASISTENCIA_FIDELIZACION_ALTA,
  ANTIGUEDAD_FIDELIZACION_ALTA_DIAS,
  VENTANA_HISTORIAL_DIAS,
};
