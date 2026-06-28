import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { RecursoAcademico } from '../../models/academico/recurso';
import {
  getAsignacionesByEstudiante,
  obtenerAsignacionesPorEstudiante,
  publishAsignacion,
  resolverEstadoTemporalAsignacion,
  transicionarAsignacionesVencidas,
  validateAsignacion,
} from './asignacionService';

describe('asignacionService', () => {
  it('devuelve asignaciones demo del tenant solicitado para visualizar Centro de Estudios', async () => {
    const respuesta = await obtenerAsignacionesPorEstudiante({
      tenantId: 'tenant-cocodrilos',
      estudianteId: 'estudiante-1',
    });

    expect(respuesta.asignaciones).toHaveLength(3);
    expect(respuesta.asignaciones.every((a) => a.tenantId === 'tenant-cocodrilos')).toBe(true);
    expect(respuesta.asignaciones.every((a) => typeof a.porcentajeProgreso === 'number')).toBe(true);
    expect(respuesta.asignaciones.map((a) => a.titulo)).toEqual([
      'Fundamentos técnicos del dojang',
      'Quiz: seguridad y conducta',
      'Refuerzo: patada frontal y control',
    ]);
  });

  it('no devuelve datos si falta tenant o estudiante', async () => {
    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: '', estudianteId: 'estudiante-1' })
    ).resolves.toEqual({ asignaciones: [] });

    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: 'tenant-cocodrilos', estudianteId: '' })
    ).resolves.toEqual({ asignaciones: [] });
  });

  it('usa fixture Cypress si existe para simular Centro de Estudios vacio', async () => {
    (window as any).Cypress = true;
    (window as any).__CENTRO_ESTUDIOS_ASIGNACIONES__ = [];

    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: 'tenant-cocodrilos', estudianteId: 'estudiante-1' })
    ).resolves.toEqual({ asignaciones: [] });

    delete (window as any).Cypress;
    delete (window as any).__CENTRO_ESTUDIOS_ASIGNACIONES__;
  });

  it('filtra asignaciones publicadas por grupo, grado y estudiante', () => {
    const asignaciones: AsignacionAcademica[] = [
      crearAsignacion({ id: 'grupo-infantil', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
      crearAsignacion({ id: 'grado-blanco', destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Blanco'] } }),
      crearAsignacion({ id: 'directa', destinatario: { tipo: 'estudiante', estudianteIds: ['est-1'] } }),
      crearAsignacion({ id: 'otro-grado', destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Rojo'] } }),
      crearAsignacion({ id: 'otro-tenant', tenantId: 'tenant-2', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
      crearAsignacion({ id: 'cerrada', estado: 'cerrada', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
    ];

    expect(getAsignacionesByEstudiante({
      tenantId: 'tenant-1',
      estudiante: { id: 'est-1', grupo: 'Infantil', grado: 'Blanco' },
      asignaciones,
    }).map((asignacion) => asignacion.id)).toEqual(['grupo-infantil', 'grado-blanco', 'directa']);
  });

  it('rechaza publicacion si el recurso no esta aprobado', () => {
    const asignacion = crearAsignacion({ id: 'pendiente-recurso' });
    const recurso = crearRecurso({ estado: 'pendiente' });

    expect(validateAsignacion({ asignacion, recurso })).toEqual({
      valid: false,
      reason: 'recurso_no_aprobado',
    });
    expect(() => publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toThrow(/recurso aprobado/i);
  });

  it('publica asignacion valida usando recurso aprobado', () => {
    const asignacion = crearAsignacion({ id: 'asignacion-valida', estado: 'borrador' });
    const recurso = crearRecurso({ estado: 'aprobado' });

    expect(publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toMatchObject({
      id: 'asignacion-valida',
      estado: 'publicada',
      creadoPorUid: 'maestro-1',
      recursoId: recurso.id,
    });
  });

  it('bloquea asignacion antes de la fecha de apertura', () => {
    expect(resolverEstadoTemporalAsignacion(
      crearAsignacion({
        fechaApertura: '2026-07-01T00:00:00.000Z',
        fechaCierre: '2026-07-10T23:59:59.000Z',
      }),
      new Date('2026-06-30T12:00:00.000Z')
    )).toBe('bloqueada');
  });

  it('marca asignacion publicada como vencida despues de la fecha de cierre', () => {
    const asignacion = crearAsignacion({
      id: 'asignacion-vencida',
      fechaApertura: '2026-06-01T00:00:00.000Z',
      fechaCierre: '2026-06-10T23:59:59.000Z',
    });

    expect(transicionarAsignacionesVencidas(
      [asignacion],
      new Date('2026-06-11T00:00:00.000Z')
    )[0]).toMatchObject({
      id: 'asignacion-vencida',
      estado: 'vencida',
    });
  });

  it('mantiene publicada la asignacion dentro de la ventana activa', () => {
    const asignacion = crearAsignacion({
      fechaApertura: '2026-06-01T00:00:00.000Z',
      fechaCierre: '2026-06-30T23:59:59.000Z',
    });

    expect(resolverEstadoTemporalAsignacion(asignacion, new Date('2026-06-15T00:00:00.000Z'))).toBe('publicada');
    expect(transicionarAsignacionesVencidas([asignacion], new Date('2026-06-15T00:00:00.000Z'))[0].estado).toBe('publicada');
  });
});

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-27T00:00:00.000Z';

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
    creadoPorUid: 'admin-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearRecurso(overrides: Partial<RecursoAcademico> = {}): RecursoAcademico {
  const ahora = '2026-06-27T00:00:00.000Z';

  return {
    id: 'recurso-1',
    tenantId: 'tenant-1',
    proveedor: 'google_drive',
    externalFileId: 'drive-file-1',
    nombre: 'Material tecnico.pdf',
    mimeType: 'application/pdf',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}
