import type { EstadoJornada } from '../../models/academico';
import type { BloqueRecurrente, JornadaInstruccion, ObservacionClase } from '../../models/academico/jornada';

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
  // Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no
  // deberia existir", clases malleables por defecto): permite a un llamador especifico
  // (generateJornadasFromBloque, usado por Centro de Estudios) saltear el estado
  // 'borrador'. Default 'borrador' preservado para no romper el flujo de creacion
  // manual singular de JornadasView.tsx (createJornada -> confirmar explicito).
  estadoInicial?: EstadoJornada;
}

interface PendienteCierreInput {
  asistenciaRegistrada: boolean;
  objetivosImpartidos: string[];
  // WS-5 (§10): OPCIONAL a proposito -- la observacion grupal nunca es obligatoria para cerrar.
  observacionClase?: ObservacionClase;
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

function minutosDesdeHora(hora: string): number {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

function validarHorario(horaInicio: string, horaFin: string): void {
  if (minutosDesdeHora(horaFin) <= minutosDesdeHora(horaInicio)) {
    throw new Error('horaFin debe ser posterior a horaInicio.');
  }
}

const transicionesPermitidas: Record<EstadoJornada, EstadoJornada[]> = {
  // Rediseño 2026-07-12: se agrega 'reprogramada' -- una jornada en borrador (legacy o
  // creada manualmente desde JornadasView.tsx) ahora se puede reprogramar directamente,
  // sin exigir confirmar primero (jornadas malleables por defecto).
  borrador: ['confirmada', 'cancelada', 'reprogramada'],
  pendiente_confirmacion: ['confirmada', 'cancelada', 'pendiente_sustitucion'],
  confirmada: ['en_curso', 'cancelada', 'reprogramada'],
  en_curso: ['pendiente_cierre', 'parcial', 'cancelada'],
  pendiente_cierre: ['cerrada', 'parcial'],
  cerrada: [],
  // Rediseño 2026-07-13 (pedido explicito del usuario): "restituir" una clase cancelada
  // por error -- unico camino de salida de 'cancelada', vuelve directo a 'confirmada'.
  cancelada: ['confirmada'],
  reprogramada: ['confirmada', 'pendiente_confirmacion', 'cancelada'],
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
  validarHorario(input.horaInicio, input.horaFin);
  const ahora = new Date().toISOString();

  const jornada: JornadaInstruccion = {
    id: crearId('jornada'),
    tenantId: input.tenantId,
    programaId: input.programaId,
    ejecucionProgramaId: input.ejecucionProgramaId,
    grupoId: input.grupoId,
    sedeId: input.sedeId,
    espacioId: input.espacioId,
    instructorId: input.instructorId,
    fecha: input.fecha,
    horaInicio: input.horaInicio,
    horaFin: input.horaFin,
    estado: input.estadoInicial ?? 'borrador',
    objetivosPlaneados: [...input.objetivosPlaneados],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  if (input.bloqueRecurrenteId) {
    jornada.bloqueRecurrenteId = input.bloqueRecurrenteId;
  }

  return jornada;
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
    // WS-5 (§10): siempre opcional -- una jornada sin observacion pasa este campo en undefined.
    observacionClase: datos.observacionClase,
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

export function reprogramarJornada(
  jornada: JornadaInstruccion,
  cambios: { fecha: string; horaInicio: string; horaFin: string }
): JornadaInstruccion {
  validarHorario(cambios.horaInicio, cambios.horaFin);
  const conNuevoHorario = { ...jornada, ...cambios };
  return transicionar(transicionar(conNuevoHorario, 'reprogramada'), 'confirmada');
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
      // Rediseño 2026-07-12: las clases generadas por Centro de Estudios nacen
      // directamente confirmadas -- "borrador" deja de ser un paso manual para este flujo.
      estadoInicial: 'confirmada',
    }));
  }

  return jornadas;
}
