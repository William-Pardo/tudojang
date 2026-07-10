jest.mock('./asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn(),
}));

import { agruparClasesAcademicas, obtenerClasesAcademicasDelTenant } from './agendaAcademicaService';
import { listarAsignacionesPorTenant } from './asignacionService';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { JornadaRepository } from './jornadaRepository';

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    bloqueRecurrenteId: 'bloque-sabado',
    fecha: '2026-06-06',
    horaInicio: '08:00',
    horaFin: '09:00',
    estado: 'borrador',
    objetivosPlaneados: ['obj-1'],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'asignacion-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'maestro-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

describe('agendaAcademicaService', () => {
  it('agrupa multiples ocurrencias del mismo bloque en una sola tarjeta', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-06-06', fecha: '2026-06-06' }),
      crearJornada({ id: 'jornada-06-13', fecha: '2026-06-13' }),
      crearJornada({ id: 'jornada-06-20', fecha: '2026-06-20' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases).toHaveLength(1);
    expect(clases[0].dia).toBe('Sábado');
  });

  it('muestra la proxima ocurrencia futura y su material asignado', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-pasada', fecha: '2026-05-30' }),
      crearJornada({ id: 'jornada-proxima', fecha: '2026-06-13' }),
      crearJornada({ id: 'jornada-futura', fecha: '2026-06-20' }),
    ];
    const asignaciones = [
      crearAsignacion({ id: 'asig-1', jornadaId: 'jornada-proxima', titulo: 'Fundamentos tecnicos' }),
      crearAsignacion({ id: 'asig-2', jornadaId: 'jornada-futura', titulo: 'No deberia aparecer' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, asignaciones, { hoyIso: '2026-06-10' });

    expect(clases[0].proximaFecha).toBe('2026-06-13');
    expect(clases[0].materialAsignado).toEqual(['Fundamentos tecnicos']);
  });

  it('no falla y muestra la ultima ocurrencia pasada si no hay ninguna futura', () => {
    const jornadas = [crearJornada({ id: 'jornada-vieja', fecha: '2026-01-05' })];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-10' });

    expect(clases).toHaveLength(1);
    expect(clases[0].proximaFecha).toBe('2026-01-05');
    expect(clases[0].materialAsignado).toEqual([]);
  });

  it('obtenerClasesAcademicasDelTenant combina jornadas y asignaciones reales del tenant', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-06-06' });
    const repository: Pick<JornadaRepository, 'listarJornadasPorTenant'> = {
      listarJornadasPorTenant: jest.fn().mockResolvedValue([jornada]),
    };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);

    const clases = await obtenerClasesAcademicasDelTenant('tenant-1', repository as JornadaRepository);

    expect(repository.listarJornadasPorTenant).toHaveBeenCalledWith('tenant-1');
    expect(listarAsignacionesPorTenant).toHaveBeenCalledWith('tenant-1');
    expect(clases).toHaveLength(1);
  });

  it('obtenerClasesAcademicasDelTenant devuelve vacio sin tenantId', async () => {
    await expect(obtenerClasesAcademicasDelTenant('')).resolves.toEqual([]);
  });

  it('excluye del listado una jornada standalone cancelada', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-cancelada', bloqueRecurrenteId: undefined, fecha: '2026-06-13', estado: 'cancelada' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases).toHaveLength(0);
  });

  it('en un grupo recurrente, omite la ocurrencia cancelada mas proxima y elige la siguiente activa', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-06-06', fecha: '2026-06-06', estado: 'cancelada' }),
      crearJornada({ id: 'jornada-06-13', fecha: '2026-06-13', estado: 'confirmada' }),
      crearJornada({ id: 'jornada-06-20', fecha: '2026-06-20', estado: 'confirmada' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases).toHaveLength(1);
    expect(clases[0].proximaFecha).toBe('2026-06-13');
    expect(clases[0].estado).toBe('confirmada');
  });

  it('descarta el grupo completo cuando todas sus ocurrencias estan canceladas', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-06-06', fecha: '2026-06-06', estado: 'cancelada' }),
      crearJornada({ id: 'jornada-06-13', fecha: '2026-06-13', estado: 'cancelada' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases).toHaveLength(0);
  });

  it('expone el estado de la jornada elegida como proxima', () => {
    const jornadas = [crearJornada({ id: 'jornada-1', fecha: '2026-06-06', estado: 'confirmada' })];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases[0].estado).toBe('confirmada');
  });

  it('Fase 4: expone jornadaId con el id real de la JornadaInstruccion elegida, distinto de id (clave de agrupacion) en bloques recurrentes', () => {
    const jornadas = [
      crearJornada({ id: 'jornada-06-06', fecha: '2026-06-06', bloqueRecurrenteId: 'bloque-sabado' }),
      crearJornada({ id: 'jornada-06-13', fecha: '2026-06-13', bloqueRecurrenteId: 'bloque-sabado' }),
    ];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-10' });

    expect(clases[0].id).toBe('bloque-sabado');
    expect(clases[0].jornadaId).toBe('jornada-06-13');
  });

  it('Fase 4: en una jornada standalone (sin bloqueRecurrenteId), jornadaId coincide con la JornadaInstruccion.id real', () => {
    const jornadas = [crearJornada({ id: 'jornada-suelta', bloqueRecurrenteId: undefined, fecha: '2026-06-06' })];

    const clases = agruparClasesAcademicas(jornadas, [], { hoyIso: '2026-06-01' });

    expect(clases[0].id).toBe('jornada-suelta');
    expect(clases[0].jornadaId).toBe('jornada-suelta');
  });
});
