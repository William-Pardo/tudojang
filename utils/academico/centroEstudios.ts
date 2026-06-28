import type { AsignacionCentroEstudios, UrgenciaAsignacion } from '../../models/academico/asignacionService.types';
import type { MetricasProgresoAcademico } from '../../components/academico/ProgresoResumenCard';

const MS_DIA = 24 * 60 * 60 * 1000;

export function calcularUrgenciaAsignacion(fechaCierre?: string, ahora = new Date()): UrgenciaAsignacion {
  if (!fechaCierre) return 'sin_fecha';

  const cierre = new Date(fechaCierre);
  const diasRestantes = Math.ceil((cierre.getTime() - ahora.getTime()) / MS_DIA);

  if (Number.isNaN(diasRestantes)) return 'sin_fecha';
  if (diasRestantes < 0) return 'vencida';
  if (diasRestantes <= 2) return 'alta';
  if (diasRestantes <= 7) return 'media';
  return 'baja';
}

const pesoUrgencia: Record<UrgenciaAsignacion, number> = {
  vencida: 0,
  alta: 1,
  media: 2,
  baja: 3,
  sin_fecha: 4,
};

const pesoEstado: Record<string, number> = {
  vencido: 0,
  requiere_refuerzo: 1,
  pendiente_revision: 2,
  en_progreso: 3,
  iniciado: 4,
  disponible: 5,
  completado: 6,
  aprobado: 7,
  bloqueado: 8,
};

export function ordenarAsignacionesPorUrgencia(asignaciones: AsignacionCentroEstudios[]): AsignacionCentroEstudios[] {
  return [...asignaciones].sort((a, b) => {
    const urgencia = pesoUrgencia[a.urgencia] - pesoUrgencia[b.urgencia];
    if (urgencia !== 0) return urgencia;

    const estado = (pesoEstado[a.estadoProgreso] ?? 99) - (pesoEstado[b.estadoProgreso] ?? 99);
    if (estado !== 0) return estado;

    const fechaA = a.fechaCierre ? new Date(a.fechaCierre).getTime() : Number.MAX_SAFE_INTEGER;
    const fechaB = b.fechaCierre ? new Date(b.fechaCierre).getTime() : Number.MAX_SAFE_INTEGER;
    return fechaA - fechaB;
  });
}

export function calcularMetricasCentroEstudios(asignaciones: AsignacionCentroEstudios[]): MetricasProgresoAcademico {
  return {
    total: asignaciones.length,
    completadas: asignaciones.filter((a) => a.estadoProgreso === 'completado' || a.estadoProgreso === 'aprobado').length,
    enProgreso: asignaciones.filter((a) => a.estadoProgreso === 'iniciado' || a.estadoProgreso === 'en_progreso').length,
    vencidas: asignaciones.filter((a) => a.urgencia === 'vencida' || a.estadoProgreso === 'vencido').length,
    proximasAVencer: asignaciones.filter((a) => a.urgencia === 'alta').length,
  };
}
