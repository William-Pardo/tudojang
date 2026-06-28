export interface ProgresoQuizLocal {
  asignacionId: string;
  tenantId: string;
  puntaje: number;
  aprobado: boolean;
  intentosUsados: number;
  estadoPostQuiz: 'aprobado' | 'requiere_refuerzo';
  actualizadoEn: string;
}

export interface AsignacionConProgresoLocal {
  id: string;
  tenantId: string;
  uso: string;
  estadoProgreso: string;
  porcentajeProgreso: number;
}

export function crearClaveProgresoQuiz(tenantId: string, asignacionId: string): string {
  return `tudojang:centro-estudios:quiz:${tenantId}:${asignacionId}`;
}

export function guardarProgresoQuizLocal(progreso: ProgresoQuizLocal, storage: Storage = window.localStorage): void {
  storage.setItem(crearClaveProgresoQuiz(progreso.tenantId, progreso.asignacionId), JSON.stringify(progreso));
}

export function leerProgresoQuizLocal(
  tenantId: string,
  asignacionId: string,
  storage: Storage = window.localStorage
): ProgresoQuizLocal | null {
  const raw = storage.getItem(crearClaveProgresoQuiz(tenantId, asignacionId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ProgresoQuizLocal;
    if (parsed.tenantId !== tenantId || parsed.asignacionId !== asignacionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function aplicarProgresoQuizLocal<T extends AsignacionConProgresoLocal>(
  asignaciones: T[],
  storage: Storage = window.localStorage
): T[] {
  return asignaciones.map((asignacion) => {
    if (asignacion.uso !== 'evaluacion') return asignacion;

    const progreso = leerProgresoQuizLocal(asignacion.tenantId, asignacion.id, storage);
    if (!progreso) return asignacion;

    return {
      ...asignacion,
      estadoProgreso: progreso.estadoPostQuiz,
      porcentajeProgreso: progreso.aprobado ? 100 : asignacion.porcentajeProgreso,
    };
  });
}
