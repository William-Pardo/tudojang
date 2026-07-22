// servicios/academico/analisisProgresoService.ts
// Análisis transversal de progreso: cruce por Programa y agregación por Material.
//
// Todo lo de este archivo es lógica PURA (sin Firebase) que opera sobre datos ya
// cargados por el llamador (PanelMetricasEstudiantes hoy consume MetricasEstudiante[]
// via actividadService; para el cruce con Programa necesita además
// AsignacionAcademica[]/JornadaInstruccion[]/ProgramaAcademico[], que ya expone
// asignacionService.listarAsignacionesPorTenant / jornadaRepository / programaRepository
// -- no se agrega ninguna colección ni campo nuevo en Firestore).

import type { MetricasEstudiante, AvanceAsignacion, TipoActividad } from '../../models/academico/actividad';
import { avanceAsignacionCompletado } from '../../models/academico/actividad';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { ProgramaAcademico } from '../../models/academico/programa';

// ---------------------------------------------------------------------------
// Cruce asignación -> programa (para filtrar y para mostrar el programa del
// material). La cadena real es asignacionId -> AsignacionAcademica.jornadaId ->
// JornadaInstruccion.programaId -> ProgramaAcademico.nombre. Una asignación sin
// jornadaId (material asignado directo a un grupo, sin pasar por Agenda) queda
// simplemente sin programa resuelto -- no es un error, es un caso real del negocio.
// ---------------------------------------------------------------------------

export interface ProgramaDeAsignacion {
  programaId: string;
  programaNombre: string;
}

export function construirMapaAsignacionPrograma(
  asignaciones: AsignacionAcademica[],
  jornadas: JornadaInstruccion[],
  programas: ProgramaAcademico[]
): Map<string, ProgramaDeAsignacion> {
  const programaIdPorJornada = new Map(jornadas.map((j) => [j.id, j.programaId]));
  const nombrePorProgramaId = new Map(programas.map((p) => [p.id, p.nombre]));

  const mapa = new Map<string, ProgramaDeAsignacion>();
  for (const asignacion of asignaciones) {
    if (!asignacion.jornadaId) continue;
    const programaId = programaIdPorJornada.get(asignacion.jornadaId);
    if (!programaId) continue;
    const programaNombre = nombrePorProgramaId.get(programaId);
    if (!programaNombre) continue;
    mapa.set(asignacion.id, { programaId, programaNombre });
  }
  return mapa;
}

/** Lista de programas que tienen al menos una asignación real, para poblar el filtro. */
export function listarProgramasConAsignaciones(
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion>
): ProgramaDeAsignacion[] {
  const vistos = new Map<string, ProgramaDeAsignacion>();
  for (const info of mapaAsignacionPrograma.values()) {
    vistos.set(info.programaId, info);
  }
  return [...vistos.values()].sort((a, b) => a.programaNombre.localeCompare(b.programaNombre));
}

// ---------------------------------------------------------------------------
// Recorte de MetricasEstudiante a un programa: recalcula iniciado/completo/
// evaluación/global usando SOLO las asignaciones de ese programa -- no alcanza con
// filtrar la lista de estudiantes y dejar los números totales, porque mostrarían el
// avance del estudiante en TODOS sus programas, no en el filtrado.
// ---------------------------------------------------------------------------

export function escalarMetricasAPrograma(
  metricas: MetricasEstudiante,
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion>,
  programaId: string
): MetricasEstudiante | null {
  const avanceDelPrograma = metricas.avancePorAsignacion.filter(
    (a) => mapaAsignacionPrograma.get(a.asignacionId)?.programaId === programaId
  );

  // El estudiante no tiene ninguna asignación de este programa -- no aplica mostrarlo
  // en esta vista filtrada.
  if (avanceDelPrograma.length === 0) return null;

  const totalAsignaciones = avanceDelPrograma.length;
  const asignacionesIniciadas = avanceDelPrograma.filter((a) => a.porcentajeConsumo > 0).length;
  const asignacionesCompletadas = avanceDelPrograma.filter(avanceAsignacionCompletado).length;
  const porcentajeGlobalConsumo = Math.round(
    avanceDelPrograma.reduce((suma, a) => suma + a.porcentajeConsumo, 0) / totalAsignaciones
  );

  const quizzesDelPrograma = avanceDelPrograma.filter((a) => a.tipoRecurso === 'quiz');
  const totalEvaluacionesRealizadas = quizzesDelPrograma.reduce((suma, a) => suma + (a.vecesEvaluado ?? 0), 0);
  const promedioScoreEvaluaciones = quizzesDelPrograma.length > 0
    ? Math.round(
        quizzesDelPrograma.reduce((suma, a) => suma + (a.scoreUltimaEvaluacion ?? 0), 0) / quizzesDelPrograma.length
      )
    : 0;

  const fechas = avanceDelPrograma.map((a) => a.ultimaActividadEn).filter((f): f is string => Boolean(f)).sort();

  return {
    ...metricas,
    totalAsignaciones,
    asignacionesIniciadas,
    asignacionesCompletadas,
    porcentajeGlobalConsumo,
    totalEvaluacionesRealizadas,
    promedioScoreEvaluaciones,
    avancePorAsignacion: avanceDelPrograma,
    ultimaActividadEn: fechas.length > 0 ? fechas[fechas.length - 1] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Métricas por material (dashboard "Por Material"): velocidad de reacción +
// finalización, agregadas a través de TODOS los estudiantes que tienen esa
// asignación. Ver conversación de diseño: cruce de dos ejes en vez de un índice
// compuesto, para que cada categoría explique el "por qué" y sugiera una acción.
// ---------------------------------------------------------------------------

export type CategoriaMaterial = 'no_funciona' | 'engancha_decepciona' | 'cuesta_arrancar' | 'funciona';

/** Umbral acordado con el usuario: reacciona "rápido" si empieza antes de 24h desde
 *  que el material se volvió accesible (fechaApertura de la asignación, NO la fecha en
 *  que el admin lo creó -- una asignación programada a futuro no debe contar como
 *  "demora" del estudiante, ver conversación de diseño). */
const HORAS_REACCION_RAPIDA = 24;

/** Mismo umbral que el resto del panel usa para "Al día" (>=80% de consumo). */
const PORCENTAJE_FINALIZACION_ALTA = 80;

export interface MetricaMaterial {
  asignacionId: string;
  tituloRecurso: string;
  tipoRecurso: TipoActividad;
  programaId?: string;
  programaNombre?: string;
  /** Promedio de horas entre fechaApertura y la primera apertura de cada estudiante. */
  tiempoReaccionPromedioHoras: number;
  /** % de quienes iniciaron que además completaron (>=80% de consumo). */
  porcentajeFinalizacion: number;
  totalEstudiantesIniciaron: number;
  categoria: CategoriaMaterial;
}

function categorizar(reaccionRapida: boolean, finalizacionAlta: boolean): CategoriaMaterial {
  if (reaccionRapida && finalizacionAlta) return 'funciona';
  if (reaccionRapida && !finalizacionAlta) return 'engancha_decepciona';
  if (!reaccionRapida && finalizacionAlta) return 'cuesta_arrancar';
  return 'no_funciona';
}

export function calcularMetricasPorMaterial(
  metricas: MetricasEstudiante[],
  fechaAperturaPorAsignacion: Map<string, string>,
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion> = new Map()
): MetricaMaterial[] {
  const avancesPorAsignacion = new Map<string, AvanceAsignacion[]>();
  for (const estudiante of metricas) {
    for (const avance of estudiante.avancePorAsignacion) {
      const lista = avancesPorAsignacion.get(avance.asignacionId) ?? [];
      lista.push(avance);
      avancesPorAsignacion.set(avance.asignacionId, lista);
    }
  }

  const resultado: MetricaMaterial[] = [];

  for (const [asignacionId, avances] of avancesPorAsignacion.entries()) {
    const fechaApertura = fechaAperturaPorAsignacion.get(asignacionId);
    // Sin fecha de apertura real (asignación huérfana/no encontrada) no hay forma
    // confiable de medir velocidad de reacción -- se excluye del dashboard en vez de
    // adivinar una categoría.
    if (!fechaApertura) continue;

    const aperturaMs = new Date(fechaApertura).getTime();
    const iniciados = avances.filter((a) => a.porcentajeConsumo > 0 && a.primeraAperturaEn);
    if (iniciados.length === 0) continue;

    const horasReaccion = iniciados.map(
      (a) => Math.max(0, (new Date(a.primeraAperturaEn!).getTime() - aperturaMs) / 3_600_000)
    );
    const tiempoReaccionPromedioHoras = horasReaccion.reduce((s, h) => s + h, 0) / horasReaccion.length;

    // Misma regla de "completado" que el resto del panel (avanceAsignacionCompletado): para un
    // quiz, "finalizar" es APROBAR (>=70), no solo intentarlo. Asi un material donde todos
    // entran pero reprueban cae en "engancha pero decepciona", que es la señal correcta.
    const completados = iniciados.filter(avanceAsignacionCompletado).length;
    const porcentajeFinalizacion = Math.round((completados / iniciados.length) * 100);

    const reaccionRapida = tiempoReaccionPromedioHoras < HORAS_REACCION_RAPIDA;
    const finalizacionAlta = porcentajeFinalizacion >= PORCENTAJE_FINALIZACION_ALTA;

    const programaInfo = mapaAsignacionPrograma.get(asignacionId);

    resultado.push({
      asignacionId,
      tituloRecurso: avances[0]?.tituloRecurso || '(Sin título)',
      tipoRecurso: avances[0]?.tipoRecurso ?? 'apertura',
      programaId: programaInfo?.programaId,
      programaNombre: programaInfo?.programaNombre,
      tiempoReaccionPromedioHoras: Math.round(tiempoReaccionPromedioHoras * 10) / 10,
      porcentajeFinalizacion,
      totalEstudiantesIniciaron: iniciados.length,
      categoria: categorizar(reaccionRapida, finalizacionAlta),
    });
  }

  return resultado.sort((a, b) => a.tituloRecurso.localeCompare(b.tituloRecurso));
}

/** Formatea horas (puede tener decimales) a un texto compacto tipo "3h", "1d 4h", "45min". */
export function formatearTiempoReaccion(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)}min`;
  if (horas < 24) return `${Math.round(horas)}h`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = Math.round(horas % 24);
  return horasRestantes > 0 ? `${dias}d ${horasRestantes}h` : `${dias}d`;
}
