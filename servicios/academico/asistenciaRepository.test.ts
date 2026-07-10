import type { RegistroAsistencia } from '../../models/academico/asistencia';
import {
  crearAsistenciaRepository,
  clearMockAsistencias,
  getMockAsistencias,
  seedMockAsistencias,
} from './asistenciaRepository';

function crearRegistro(overrides: Partial<RegistroAsistencia> = {}): RegistroAsistencia {
  return {
    estudianteId: 'estudiante-1',
    horaEntrada: '2026-07-08T13:00:00.000Z',
    ...overrides,
  };
}

describe('asistenciaRepository', () => {
  beforeEach(() => {
    clearMockAsistencias();
  });

  it('lista vacio en memoria cuando Firebase no esta configurado y no hay check-ins sembrados', async () => {
    const repository = crearAsistenciaRepository({ isFirebaseConfigured: false });

    const resultado = await repository.listarPorJornada('tenant-1', 'jornada-1');

    expect(resultado).toEqual([]);
  });

  // El cliente nunca escribe esta subcoleccion (solo el callable server-side, Fase 1); el
  // helper de siembra simula que el callable ya registro check-ins, para poder testear el
  // wiring de lectura sin configurar Firebase/emulador.
  it('lista los check-ins sembrados en memoria filtrados por tenant y jornada', async () => {
    seedMockAsistencias('tenant-1', 'jornada-1', [crearRegistro({ estudianteId: 'estudiante-1' })]);
    seedMockAsistencias('tenant-1', 'jornada-2', [crearRegistro({ estudianteId: 'estudiante-2' })]);
    seedMockAsistencias('tenant-2', 'jornada-1', [crearRegistro({ estudianteId: 'estudiante-3' })]);

    const repository = crearAsistenciaRepository({ isFirebaseConfigured: false });
    const resultado = await repository.listarPorJornada('tenant-1', 'jornada-1');

    expect(resultado).toEqual([crearRegistro({ estudianteId: 'estudiante-1' })]);
    expect(getMockAsistencias()).toHaveLength(3);
  });

  it('lista desde Firestore consultando la subcoleccion de la jornada', async () => {
    const registro = crearRegistro({ estudianteId: 'estudiante-1', horaSalida: '2026-07-08T13:45:00.000Z', minutosAsistidos: 45 });
    const repository = crearAsistenciaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        getDocs: async () => ({ docs: [{ id: registro.estudianteId, data: () => registro }] }),
      },
    });

    const resultado = await repository.listarPorJornada('tenant-1', 'jornada-1');

    expect(resultado).toEqual([registro]);
  });

  it('consulta la ruta correcta tenants/{t}/jornadas/{j}/asistencias', async () => {
    const rutasConsultadas: unknown[] = [];
    const repository = crearAsistenciaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => {
          rutasConsultadas.push(path);
          return path;
        },
        getDocs: async () => ({ docs: [] }),
      },
    });

    await repository.listarPorJornada('tenant-1', 'jornada-1');

    expect(rutasConsultadas).toEqual([
      ['db-mock', 'tenants', 'tenant-1', 'jornadas', 'jornada-1', 'asistencias'],
    ]);
  });
});
