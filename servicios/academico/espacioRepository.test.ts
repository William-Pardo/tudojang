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

  // Subtarea "espacios" (cierre Centro de Estudios): guardarEspacio soldó el lado de
  // escritura del repositorio, que en 12.7 se dejó deliberadamente como solo lectura.
  // Sin esto, EspaciosView.tsx solo guardaba en memoria local y el selector de la Agenda
  // siempre recibia [] (ver DT-0007).
  it('guardarEspacio persiste en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearEspacioRepository({ isFirebaseConfigured: false });
    const espacio = crearEspacioBase({ id: 'espacio-nuevo', tenantId: 'tenant-1' });

    await repository.guardarEspacio(espacio);

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');
    expect(resultado).toEqual([espacio]);
  });

  it('guardarEspacio hace upsert por id en memoria (no duplica un espacio existente)', async () => {
    const repository = crearEspacioRepository({ isFirebaseConfigured: false });
    seedMockEspacios([crearEspacioBase({ id: 'espacio-1', nombre: 'Tatami principal' })]);

    await repository.guardarEspacio(crearEspacioBase({ id: 'espacio-1', nombre: 'Tatami renovado' }));

    const resultado = await repository.listarEspaciosPorTenant('tenant-1');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].nombre).toBe('Tatami renovado');
  });

  it('guardarEspacio escribe en Firestore con setDoc merge en la coleccion del tenant', async () => {
    const espacio = crearEspacioBase({ id: 'espacio-1', tenantId: 'tenant-1' });
    const rutasDoc: any[][] = [];
    const setDocCalls: Array<{ data: unknown; options: unknown }> = [];
    const repository = crearEspacioRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        doc: (...path: any[]) => { rutasDoc.push(path); return path; },
        setDoc: async (_ref: unknown, data: unknown, options: unknown) => {
          setDocCalls.push({ data, options });
        },
      },
    });

    await repository.guardarEspacio(espacio);

    expect(rutasDoc).toEqual([['db-mock', 'tenants', 'tenant-1', 'espacios', 'espacio-1']]);
    expect(setDocCalls).toHaveLength(1);
    expect(setDocCalls[0].data).toEqual(espacio);
    expect(setDocCalls[0].options).toEqual({ merge: true });
  });
});
