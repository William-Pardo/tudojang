import type { EstadoJornada } from '../../models/academico';
import type { BloqueRecurrente, JornadaInstruccion } from '../../models/academico/jornada';

interface CrearJornadaInput {
  tenantId: string;
  programaId: string;
  ejecucionProgramaId: string;
  grupoId: string;
  sedeId: string;
  espacioId: string;
  instructorId: string;
  bloqueRecurrenteId?: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  objetivosPlaneados: string[];
}

interface PendienteCierreInput {
  asistenciaRegistrada: boolean;
  objetivosImpartidos: string[];
}

interface GenerarJornadasFromBloqueInput {
  bloque: BloqueRecurrente;
  programaId: string;
  ejecucionProgramaId: string;
  objetivosPlaneados: string[];
  fechaInicio: string;
  fechaFin: string;
}

const crearId = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const transicionesPermitidas: Record<EstadoJornada, EstadoJornada[]> = {
  borrador: ['confirmada', 'cancelada'],
  pendiente_confirmacion: ['confirmada', 'cancelada', 'pendiente_sustitucion'],
  confirmada: ['en_curso', 'cancelada', 'reprogramada'],
  en_curso: ['pendiente_cierre', 'parcial', 'cancelada'],
  pendiente_cierre: ['cerrada', 'parcial'],
  cerrada: [],
  cancelada: [],
  reprogramada: ['pendiente_confirmacion', 'cancelada'],
  parcial: ['cerrada'],
  pendiente_sustitucion: ['confirmada', 'cancelada'],
};

function transicionar(jornada: JornadaInstruccion, estado: EstadoJornada): JornadaInstruccion {
  const permitidas = transicionesPermitidas[jornada.estado] ?? [];
  if (!permitidas.includes(estado)) {
    throw new Error(`Transicion invalida: ${jornada.estado} -> ${estado}`);
  }

  return {
    ...jornada,
    estado,
    actualizadoEn: new Date().toISOString(),
  };
}

export function createJornada(input: CrearJornadaInput): JornadaInstruccion {
  const ahora = new Date().toISOString();

  return {
    id: crearId('jornada'),
    tenantId: input.tenantId,
    programaId: input.programaId,
    ejecucionProgramaId: input.ejecucionProgramaId,
    grupoId: input.grupoId,
    sedeId: input.sedeId,
    espacioId: input.espacioId,
    instructorId: input.instructorId,
    bloqueRecurrenteId: input.bloqueRecurrenteId,
    fecha: input.fecha,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
    estado: 'borrador',
    objetivosPlaneados: [...input.objetivosPlaneados],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

export function confirmarJornada(jornada: JornadaInstruccion): JornadaInstruccion {
  return transicionar(jornada, 'confirmada');
}

export function iniciarJornada(jornada: JornadaInstruccion): JornadaInstruccion {
  return transicionar(jornada, 'en_curso');
}

export function marcarPendienteCierre(
  jornada: JornadaInstruccion,
  datos: PendienteCierreInput
): JornadaInstruccion {
  return {
    ...transicionar(jornada, 'pendiente_cierre'),
    asistenciaRegistrada: datos.asistenciaRegistrada,
    objetivosImpartidos: [...datos.objetivosImpartidos],
  };
}

export function cerrarJornada(jornada: JornadaInstruccion): JornadaInstruccion {
  if (!jornada.asistenciaRegistrada) {
    throw new Error('No se puede cerrar una jornada sin asistencia registrada.');
  }

  if (jornada.objetivosImpartidos.length === 0) {
    throw new Error('No se puede cerrar una jornada sin objetivos impartidos.');
  }

  return transicionar(jornada, 'cerrada');
}

export function cancelarJornada(jornada: JornadaInstruccion, motivoCancelacion: string): JornadaInstruccion {
  return {
    ...transicionar(jornada, 'cancelada'),
    motivoCancelacion,
  };
}

export function rechazarTransicionInvalida(
  jornada: JornadaInstruccion,
  estado: EstadoJornada
): JornadaInstruccion {
  return transicionar(jornada, estado);
}

function formatoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function generateJornadasFromBloque({
  bloque,
  programaId,
  ejecucionProgramaId,
  objetivosPlaneados,
  fechaInicio,
  fechaFin,
}: GenerarJornadasFromBloqueInput): JornadaInstruccion[] {
  if (!bloque.activo) return [];

  const inicio = new Date(`${fechaInicio}T00:00:00.000Z`);
  const fin = new Date(`${fechaFin}T00:00:00.000Z`);
  const jornadas: JornadaInstruccion[] = [];

  for (const cursor = new Date(inicio); cursor <= fin; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== bloque.diaSemana) continue;

    jornadas.push(createJornada({
      tenantId: bloque.tenantId,
      programaId,
      ejecucionProgramaId,
      grupoId: bloque.grupoId,
      sedeId: bloque.sedeId,
      espacioId: bloque.espacioId,
      instructorId: bloque.instructorId,
      fecha: formatoFecha(cursor),
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
      objetivosPlaneados,
      bloqueRecurrenteId: bloque.id,
    }));
  }

  return jornadas;
}
