import type { Estudiante } from '../../tipos';
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
