import {
  advanceCiclo,
  assignProgramaToGrupo,
  createPrograma,
  generarJornadasDeEjecucion,
  publishPrograma,
} from './programaService';
import type { ProgramaAcademico } from '../../models/academico/programa';
import type { BloqueRecurrente } from '../../models/academico/jornada';

const basePrograma = {
  tenantId: 'tenant-1',
  nombre: 'Programa cinturón blanco',
  descripcion: 'Base técnica inicial',
  unidades: [
    {
      id: 'unidad-1',
      nombre: 'Fundamentos',
      orden: 1,
      objetivos: [
        { id: 'obj-1', descripcion: 'Saludo y postura', orden: 1 },
        { id: 'obj-2', descripcion: 'Patada frontal', orden: 2 },
      ],
    },
    {
      id: 'unidad-2',
      nombre: 'Control',
      orden: 2,
      objetivos: [
        { id: 'obj-3', descripcion: 'Desplazamiento básico', orden: 1 },
      ],
    },
  ],
};

describe('programaService', () => {
  it('crea programa academico en borrador con unidades ordenadas', () => {
    const programa = createPrograma(basePrograma);

    expect(programa).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      nombre: 'Programa cinturón blanco',
      estado: 'borrador',
      version: 1,
    }));
    expect(programa.unidades.map((unidad) => unidad.id)).toEqual(['unidad-1', 'unidad-2']);
  });

  it('crea programa con tags cuando se proveen y los conserva tal cual', () => {
    const programa = createPrograma({ ...basePrograma, tags: ['infantil', 'iniciación'] });

    expect(programa.tags).toEqual(['infantil', 'iniciación']);
  });

  it('crea programa sin tags cuando no se proveen, sin romper', () => {
    const programa = createPrograma(basePrograma);

    expect(programa.tags).toBeUndefined();
  });

  it('publica un programa solo si tiene unidades y objetivos', () => {
    const programa = createPrograma(basePrograma);

    expect(publishPrograma(programa)).toEqual(expect.objectContaining({
      estado: 'publicado',
    }));

    expect(() => publishPrograma({ ...programa, unidades: [] })).toThrow(/unidades/i);
  });

  it('asigna programa publicado a un grupo con posicion inicial', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });

    expect(ejecucion).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      programaId: programa.id,
      grupoId: 'grupo-infantil',
      estado: 'activo',
      unidadActualId: 'unidad-1',
      objetivoActualId: 'obj-1',
    }));
  });

  it('avanza ciclo cuando se completan objetivos actuales', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });

    const siguiente = advanceCiclo(programa, ejecucion, ['obj-1']);

    expect(siguiente.objetivosCompletados).toEqual(['obj-1']);
    expect(siguiente.unidadActualId).toBe('unidad-1');
    expect(siguiente.objetivoActualId).toBe('obj-2');
  });

  it('no avanza cuando la ejecucion esta cancelada', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = {
      ...assignProgramaToGrupo(programa, {
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        fechaInicio: '2026-06-27',
      }),
      estado: 'cancelado' as const,
    };

    expect(advanceCiclo(programa, ejecucion, ['obj-1'])).toEqual(ejecucion);
  });

  it('asigna programa con horario recurrente y fecha de fin', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const bloques: BloqueRecurrente[] = [{
      id: 'bloque-sabado',
      tenantId: 'tenant-1',
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      diaSemana: 6,
      horaInicio: '08:00',
      horaFin: '09:00',
      activo: true,
    }];

    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-01',
      bloques,
      fechaFin: '2026-06-30',
    });

    expect(ejecucion.bloques).toEqual(bloques);
    expect(ejecucion.fechaFin).toBe('2026-06-30');
  });

  it('genera jornadas reales para cada bloque recurrente de la ejecucion', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const bloques: BloqueRecurrente[] = [
      {
        id: 'bloque-sabado',
        tenantId: 'tenant-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        diaSemana: 6,
        horaInicio: '08:00',
        horaFin: '09:00',
        activo: true,
      },
      {
        id: 'bloque-domingo',
        tenantId: 'tenant-1',
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        espacioId: 'tatami-1',
        instructorId: 'maestro-1',
        diaSemana: 0,
        horaInicio: '10:00',
        horaFin: '11:00',
        activo: true,
      },
    ];
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-01',
      bloques,
      fechaFin: '2026-06-30',
    });

    const jornadas = generarJornadasDeEjecucion(programa, ejecucion);

    expect(jornadas).toHaveLength(8); // 4 sabados + 4 domingos en junio 2026
    expect(jornadas.every((jornada) => jornada.programaId === programa.id)).toBe(true);
    expect(jornadas.every((jornada) => jornada.ejecucionProgramaId === ejecucion.id)).toBe(true);
    expect(jornadas.filter((jornada) => jornada.horaInicio === '08:00')).toHaveLength(4);
    expect(jornadas.filter((jornada) => jornada.horaInicio === '10:00')).toHaveLength(4);
  });

  it('no genera jornadas si la ejecucion no tiene bloques o fechaFin', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-01',
    });

    expect(generarJornadasDeEjecucion(programa, ejecucion)).toEqual([]);
  });

  it('marca ejecucion completada cuando termina el ultimo objetivo', () => {
    const programa: ProgramaAcademico = publishPrograma(createPrograma(basePrograma));
    const ejecucion = {
      ...assignProgramaToGrupo(programa, {
        grupoId: 'grupo-infantil',
        sedeId: 'sede-principal',
        fechaInicio: '2026-06-27',
      }),
      objetivosCompletados: ['obj-1', 'obj-2'],
      unidadActualId: 'unidad-2',
      objetivoActualId: 'obj-3',
    };

    const completada = advanceCiclo(programa, ejecucion, ['obj-3']);

    expect(completada.estado).toBe('completado');
    expect(completada.objetivoActualId).toBeNull();
  });

  it('ignora objetivos impartidos que no existen en el programa', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });

    const resultado = advanceCiclo(programa, ejecucion, ['obj-1', 'obj-INEXISTENTE']);

    expect(resultado.objetivosCompletados).toEqual(['obj-1']);
    expect(resultado.objetivosCompletados).not.toContain('obj-INEXISTENTE');
    expect(resultado.estado).not.toBe('completado');
  });

  it('no marca completado si todos los objetivos pasados son inexistentes', () => {
    const programa = publishPrograma(createPrograma(basePrograma));
    const ejecucion = assignProgramaToGrupo(programa, {
      grupoId: 'grupo-infantil',
      sedeId: 'sede-principal',
      fechaInicio: '2026-06-27',
    });

    const resultado = advanceCiclo(programa, ejecucion, ['obj-FANTASMA-1', 'obj-FANTASMA-2']);

    expect(resultado.objetivosCompletados).toEqual([]);
    expect(resultado.estado).toBe('activo');
    expect(resultado.objetivoActualId).toBe('obj-1');
  });
});
