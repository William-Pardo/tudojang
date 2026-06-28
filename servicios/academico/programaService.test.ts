import {
  advanceCiclo,
  assignProgramaToGrupo,
  createPrograma,
  publishPrograma,
} from './programaService';
import type { ProgramaAcademico } from '../../models/academico/programa';

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
});
