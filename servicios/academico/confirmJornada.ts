import type { ReservaEspacio } from '../../models/academico/espacio';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import { getDisponibilidad } from './espacioService';

export type ErrorConfirmacionJornada =
  | 'tenant_invalido'
  | 'instructor_no_autorizado_sede'
  | 'capacidad_insuficiente'
  | 'disciplina_no_compatible'
  | 'espacio_no_disponible'
  | 'instructor_no_disponible'
  | 'grupo_no_disponible';

export interface ContextoConfirmacionJornada {
  tenantId: string;
  sedesPermitidasInstructor: string[];
  capacidadEspacio: number;
  totalEstudiantesGrupo: number;
  disciplinasEspacio: string[];
  disciplinaJornada: string;
  reservas: ReservaEspacio[];
  jornadasInstructor: JornadaInstruccion[];
  jornadasGrupo: JornadaInstruccion[];
}

export interface ResultadoConfirmacionJornada {
  ok: boolean;
  errores: ErrorConfirmacionJornada[];
}

function minutos(hora: string): number {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

function seCruzan(a: JornadaInstruccion, b: JornadaInstruccion): boolean {
  if (a.fecha !== b.fecha) return false;
  return minutos(a.horaInicio) < minutos(b.horaFin) && minutos(b.horaInicio) < minutos(a.horaFin);
}

export function validarConfirmacionJornada(
  jornada: JornadaInstruccion,
  contexto: ContextoConfirmacionJornada
): ResultadoConfirmacionJornada {
  const errores: ErrorConfirmacionJornada[] = [];

  if (jornada.tenantId !== contexto.tenantId) {
    errores.push('tenant_invalido');
  }

  if (!contexto.sedesPermitidasInstructor.includes(jornada.sedeId)) {
    errores.push('instructor_no_autorizado_sede');
  }

  if (contexto.totalEstudiantesGrupo > contexto.capacidadEspacio) {
    errores.push('capacidad_insuficiente');
  }

  if (!contexto.disciplinasEspacio.includes(contexto.disciplinaJornada)) {
    errores.push('disciplina_no_compatible');
  }

  const disponibilidadEspacio = getDisponibilidad({
    espacioId: jornada.espacioId,
    fecha: jornada.fecha,
    horaInicio: jornada.horaInicio,
    horaFin: jornada.horaFin,
    referenciaIdIgnorada: jornada.id,
    reservas: contexto.reservas,
  });

  if (!disponibilidadEspacio.disponible) {
    errores.push('espacio_no_disponible');
  }

  if (contexto.jornadasInstructor.some((existente) => existente.id !== jornada.id && seCruzan(jornada, existente))) {
    errores.push('instructor_no_disponible');
  }

  if (contexto.jornadasGrupo.some((existente) => existente.id !== jornada.id && seCruzan(jornada, existente))) {
    errores.push('grupo_no_disponible');
  }

  return {
    ok: errores.length === 0,
    errores,
  };
}
