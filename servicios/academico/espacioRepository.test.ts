import type { EspacioFisico } from '../../models/academico/espacio';
import {
  crearEspacioRepository,
  clearMockEspacios,
  seedMockEspacios,
  getMockEspacios,
} from './espacioRepository';

function crearEspacioBase(overrides: Partial<EspacioFisico> = {}): EspacioFisico {
  const ahora = '2026-07-01T00:00:00.000Z';
  return {
    id: 'espacio-1',
    tenantId: 'tenant-1',
    sedeId: 'sede-1',
    nombre: 'Tatami principal',
    capacidad: 30,
    disciplinasPermitidas: ['taekwondo'],
    activo: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

describe('espacioRepository', () => {
  beforeEach(() => {
    clearMockEspacios();
  });

  it('devuelve lista vacia cuando el tenant no tiene espacios cargados (caso esperado hoy)', async () => {
    // Hoy ninguna UI persiste espacios (EspaciosView es demo con estado local), asi que el
    // caso normal es "tenant sin espacios reales": el selector debe recibir [] sin romperse.
    const repository = crearEspacioRepository({ isFirebaseConfigured: false });

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');

    expect(resultado).toEqual([]);
  });

  it('lista espacios en memoria filtrados por tenant cuando Firebase no esta configurado', async () => {
    const repository = crearEspacioRepository({ isFirebaseConfigured: false });
    seedMockEspacios([
      crearEspacioBase({ id: 'espacio-1', tenantId: 'tenant-1' }),
      crearEspacioBase({ id: 'espacio-2', tenantId: 'tenant-2' }),
    ]);

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('espacio-1');
    // seedMockEspacios no muta el arreglo original (copia defensiva).
    expect(getMockEspacios()).toHaveLength(2);
  });

  it('lista espacios desde Firestore consultando la coleccion del tenant', async () => {
    const espacio = crearEspacioBase();
    const consultas: string[][] = [];
    const repository = crearEspacioRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => {
          consultas.push(path);
          return path;
        },
        getDocs: async () => ({ docs: [{ id: espacio.id, data: () => espacio }] }),
      },
    });

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');

    expect(resultado).toEqual([espacio]);
    expect(consultas).toEqual([['db-mock', 'tenants', 'tenant-1', 'espacios']]);
  });

  it('devuelve [] desde Firestore cuando la coleccion del tenant esta vacia', async () => {
    const repository = crearEspacioRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        getDocs: async () => ({ docs: [] }),
      },
    });

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');

    expect(resultado).toEqual([]);
  });
});
