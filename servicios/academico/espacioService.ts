import type {
  DisponibilidadEspacio,
  EspacioFisico,
  ReservaEspacio,
} from '../../models/academico/espacio';

interface CrearEspacioInput {
  tenantId: string;
  sedeId: string;
  nombre: string;
  capacidad: number;
  disciplinasPermitidas: string[];
}

type ActualizarEspacioInput = Partial<Pick<
  EspacioFisico,
  'nombre' | 'capacidad' | 'disciplinasPermitidas' | 'activo'
>>;

interface DisponibilidadRequest {
  espacioId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  reservas: ReservaEspacio[];
  referenciaIdIgnorada?: string;
}

const crearId = (prefijo: string) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function minutos(hora: string): number {
  const [hh, mm] = hora.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    throw new Error(`Hora invalida: ${hora}`);
  }
  return hh * 60 + mm;
}

function haySolapamiento(inicioA: string, finA: string, inicioB: string, finB: string): boolean {
  const aInicio = minutos(inicioA);
  const aFin = minutos(finA);
  const bInicio = minutos(inicioB);
  const bFin = minutos(finB);

  if (aFin <= aInicio || bFin <= bInicio) {
    throw new Error('El rango horario debe tener una hora fin posterior a la hora inicio.');
  }

  return aInicio < bFin && bInicio < aFin;
}

export function createEspacio(input: CrearEspacioInput): EspacioFisico {
  const ahora = new Date().toISOString();

  return {
    id: crearId('espacio'),
    tenantId: input.tenantId,
    sedeId: input.sedeId,
    nombre: input.nombre,
    capacidad: input.capacidad,
    disciplinasPermitidas: [...input.disciplinasPermitidas],
    activo: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

export function updateEspacio(
  espacio: EspacioFisico,
  cambios: ActualizarEspacioInput
): EspacioFisico {
  return {
    ...espacio,
    ...cambios,
    tenantId: espacio.tenantId,
    sedeId: espacio.sedeId,
    actualizadoEn: new Date().toISOString(),
  };
}

export function getDisponibilidad(request: DisponibilidadRequest): DisponibilidadEspacio {
  const conflictos = request.reservas.filter((reserva) => {
    if (reserva.espacioId !== request.espacioId) return false;
    if (reserva.fecha !== request.fecha) return false;
    if (reserva.referenciaId === request.referenciaIdIgnorada) return false;

    return haySolapamiento(
      request.horaInicio,
      request.horaFin,
      reserva.horaInicio,
      reserva.horaFin
    );
  });

  return {
    disponible: conflictos.length === 0,
    conflictos,
  };
}
