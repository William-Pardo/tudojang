import type { EstadoJornada } from '../../models/academico';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import { jornadaRepository, type JornadaRepository } from './jornadaRepository';
import { listarAsignacionesPorTenant } from './asignacionService';

export interface ClaseAcademicaAgenda {
  id: string;
  /**
   * Fase 4 (clase-en-vivo-checkin-trigger-agenda, Bloque A): id real de la `JornadaInstruccion`
   * elegida como `proxima` (ver mas abajo), NO la clave de agrupacion. En bloques recurrentes
   * `id` es `bloqueRecurrenteId` (agrupa todas las ocurrencias bajo una sola tarjeta semanal),
   * mientras que `jornadaId` es el documento real de HOY/la proxima ocurrencia contra el que hay
   * que operar Clase en Vivo (check-in/check-out, asistencia). Antes de esta fase no existia forma
   * de navegar con un jornadaId real desde una tarjeta recurrente -- ver design.md, deviation
   * documentada en el reporte de progreso de la Fase 4.
   */
  jornadaId: string;
  origen: 'academico';
  dia: string;
  horaInicio: string;
  horaFin: string;
  sedeId: string;
  instructorId: string;
  grupo: string;
  nombrePrograma: string;
  proximaFecha: string;
  materialAsignado: string[];
  estado: EstadoJornada;
}

interface AgruparClasesAcademicasOpciones {
  hoyIso: string;
  nombresPrograma?: Record<string, string>;
}

const DIAS_POR_INDICE_UTC = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function obtenerNombreDia(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T12:00:00Z`);
  return DIAS_POR_INDICE_UTC[fecha.getUTCDay()];
}

export function agruparClasesAcademicas(
  jornadas: JornadaInstruccion[],
  asignaciones: AsignacionAcademica[],
  { hoyIso, nombresPrograma = {} }: AgruparClasesAcademicasOpciones
): ClaseAcademicaAgenda[] {
  const grupos = new Map<string, JornadaInstruccion[]>();

  for (const jornada of jornadas) {
    const clave = jornada.bloqueRecurrenteId ?? jornada.id;
    grupos.set(clave, [...(grupos.get(clave) ?? []), jornada]);
  }

  return Array.from(grupos.entries())
    .map(([clave, ocurrencias]) => {
      const ordenadas = [...ocurrencias].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const activas = ordenadas.filter((jornada) => jornada.estado !== 'cancelada');
      if (activas.length === 0) return null;

      const proxima = activas.find((jornada) => jornada.fecha >= hoyIso) ?? activas[activas.length - 1];
      const materialAsignado = asignaciones
        .filter((asignacion) => asignacion.jornadaId === proxima.id)
        .map((asignacion) => asignacion.titulo);

      return {
        id: clave,
        jornadaId: proxima.id,
        origen: 'academico' as const,
        dia: obtenerNombreDia(proxima.fecha),
        horaInicio: proxima.horaInicio,
        horaFin: proxima.horaFin,
        sedeId: proxima.sedeId,
        instructorId: proxima.instructorId,
        grupo: proxima.grupoId,
        nombrePrograma: nombresPrograma[proxima.programaId] ?? proxima.programaId,
        proximaFecha: proxima.fecha,
        materialAsignado,
        estado: proxima.estado,
      };
    })
    .filter((clase): clase is ClaseAcademicaAgenda => clase !== null);
}

export async function obtenerClasesAcademicasDelTenant(
  tenantId: string,
  repository: JornadaRepository = jornadaRepository
): Promise<ClaseAcademicaAgenda[]> {
  if (!tenantId) return [];

  const [jornadas, asignaciones] = await Promise.all([
    repository.listarJornadasPorTenant(tenantId),
    listarAsignacionesPorTenant(tenantId),
  ]);

  const hoyIso = new Date().toISOString().slice(0, 10);
  return agruparClasesAcademicas(jornadas, asignaciones, { hoyIso });
}
