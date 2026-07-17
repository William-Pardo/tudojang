import { EstadoPago, type Estudiante } from '../../tipos';
import type { EjecucionPrograma } from '../../models/academico/programa';
import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';

/**
 * Puras del roster de matrícula (Fase 0, `design.md` Decisión 4/5).
 *
 * `estaInscrito` es la única fuente de verdad de PERTENENCIA que consume este
 * change (usada por la UI para reflejar el estado actual del roster; la
 * validación real de pertenencia contra `jornada.ejecucionProgramaId` la hace
 * el callable server-side en Fase 1 vía `exists()`, no esta función).
 *
 * `sugerirEstudiantesPorAtributo` es SOLO una sugerencia de conveniencia para
 * la UI de matrícula (pre-marcar candidatos) — nunca se usa para validar
 * pertenencia. No distingue dos `EjecucionPrograma` simultáneas del mismo
 * `grupoId` (ambas reciben la misma sugerencia); por eso el roster explícito
 * de Fase 0 existe: la confirmación manual del admin/instructor es la que
 * de verdad separa una sección de otra.
 */
function slugificar(valor: string): string {
  return valor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function estaInscrito(
  ejecucionProgramaId: string,
  estudianteId: string,
  inscripciones: InscripcionEjecucionPrograma[],
): boolean {
  return inscripciones.some(
    (inscripcion) => inscripcion.ejecucionProgramaId === ejecucionProgramaId
      && inscripcion.estudianteId === estudianteId,
  );
}

export function sugerirEstudiantesPorAtributo(
  ejecucion: EjecucionPrograma,
  estudiantes: Estudiante[],
): Estudiante[] {
  return estudiantes.filter((estudiante) => slugificar(estudiante.grupo) === ejecucion.grupoId);
}

/**
 * Matrícula automática (decisión de arquitectura 2026-07-11, ver engram
 * centro-estudios/matricula-automatica): mismo criterio que el callable
 * server-side `registrarAsistenciaJornada` (functions/academico/asistencia.js,
 * perteneceAEjecucion) — grupo + sede coinciden y el pago no está Vencido. Se
 * usa para pre-tildar el checklist del modal de asistencia (a diferencia de
 * `sugerirEstudiantesPorAtributo`, que solo mira grupo y es apenas una
 * sugerencia de conveniencia, no la fuente de verdad real de pertenencia).
 *
 * Riesgo conocido y aceptado (deuda técnica): `ejecucion.sedeId` es un slug del
 * NOMBRE de la sede (`slugificar(programa.sede)`), no una referencia real al
 * documento de la sede — coincide con `estudiante.sedeId` solo si el ID real de
 * la sede resulta ser igual a su propio nombre slugificado.
 */
export function perteneceAutomaticamente(
  estudiante: Estudiante,
  ejecucion: EjecucionPrograma,
): boolean {
  if (estudiante.estadoPago === EstadoPago.Vencido) return false;
  return slugificar(estudiante.grupo) === ejecucion.grupoId && estudiante.sedeId === ejecucion.sedeId;
}
