import type { ProgramaAcademico } from '../../models/academico/programa';
import { crearProgramaRepository, clearMockProgramas, getMockProgramas } from './programaRepository';

function crearProgramaBase(overrides: Partial<ProgramaAcademico> = {}): ProgramaAcademico {
  const ahora = '2026-06-27T00:00:00.000Z';
  return {
    id: 'programa-1',
    tenantId: 'tenant-1',
    nombre: 'Programa cinturón blanco',
    descripcion: 'Base técnica inicial',
    version: 1,
    estado: 'publicado',
    unidades: [],
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

describe('programaRepository', () => {
  beforeEach(() => {
    clearMockProgramas();
  });

  it('guarda programa en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearProgramaRepository({ isFirebaseConfigured: false });
    const programa = crearProgramaBase();

    await repository.guardarPrograma(programa);

    expect(getMockProgramas()).toHaveLength(1);
    expect(getMockProgramas()[0]).toMatchObject({ id: 'programa-1', tenantId: 'tenant-1' });
  });

  it('guarda programa en Firestore con ruta por tenant', async () => {
    const writes: Array<{ path: string[]; data: unknown; options?: unknown }> = [];
    const repository = crearProgramaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [] }),
        setDoc: async (ref: string[], data: unknown, options?: unknown) => {
          writes.push({ path: ref, data, options });
        },
      },
    });
    const programa = crearProgramaBase();

    await repository.guardarPrograma(programa);

    expect(writes).toEqual([{
      path: ['db-mock', 'tenants', 'tenant-1', 'programasAcademicos', 'programa-1'],
      data: programa,
      options: { merge: true },
    }]);
  });

  it('lista programas en memoria filtrados por tenant cuando Firebase no esta configurado', async () => {
    const repository = crearProgramaRepository({ isFirebaseConfigured: false });
    const programaTenant1 = crearProgramaBase({ id: 'programa-1', tenantId: 'tenant-1' });
    const programaOtroTenant = crearProgramaBase({ id: 'programa-2', tenantId: 'tenant-2' });

    await repository.guardarPrograma(programaTenant1);
    await repository.guardarPrograma(programaOtroTenant);

    const resultado = await repository.listarProgramasPorTenant('tenant-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('programa-1');
  });

  it('lista programas desde Firestore consultando la coleccion del tenant', async () => {
    const programa = crearProgramaBase();
    const repository = crearProgramaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [{ id: programa.id, data: () => programa }] }),
        setDoc: async () => {},
      },
    });

    const resultado = await repository.listarProgramasPorTenant('tenant-1');

    expect(resultado).toEqual([programa]);
  });

  it('elimina un programa en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearProgramaRepository({ isFirebaseConfigured: false });
    const programaTenant1 = crearProgramaBase({ id: 'programa-1', tenantId: 'tenant-1' });
    const programaOtroTenant = crearProgramaBase({ id: 'programa-2', tenantId: 'tenant-2' });
    await repository.guardarPrograma(programaTenant1);
    await repository.guardarPrograma(programaOtroTenant);

    await repository.eliminarPrograma('tenant-1', 'programa-1');

    expect(getMockProgramas()).toHaveLength(1);
    expect(getMockProgramas()[0].id).toBe('programa-2');
  });

  it('elimina un programa en Firestore con la ruta por tenant', async () => {
    const deletes: unknown[][] = [];
    const repository = crearProgramaRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        getDocs: async () => ({ docs: [] }),
        setDoc: async () => {},
        deleteDoc: async (ref: unknown[]) => {
          deletes.push(ref);
        },
      },
    });

    await repository.eliminarPrograma('tenant-1', 'programa-1');

    expect(deletes).toEqual([
      ['db-mock', 'tenants', 'tenant-1', 'programasAcademicos', 'programa-1'],
    ]);
  });
});
