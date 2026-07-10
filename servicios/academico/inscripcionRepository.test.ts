import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';
import { crearInscripcionRepository, clearMockInscripciones, getMockInscripciones } from './inscripcionRepository';

function crearInscripcionBase(overrides: Partial<InscripcionEjecucionPrograma> = {}): InscripcionEjecucionPrograma {
  return {
    estudianteId: 'estudiante-1',
    ejecucionProgramaId: 'ejecucion-1',
    tenantId: 'tenant-1',
    estado: 'activa',
    fechaInscripcion: '2026-07-08T00:00:00.000Z',
    inscritoPorUid: 'instructor-1',
    ...overrides,
  };
}

describe('inscripcionRepository', () => {
  beforeEach(() => {
    clearMockInscripciones();
  });

  it('matricula en memoria cuando Firebase no esta configurado', async () => {
    const repository = crearInscripcionRepository({ isFirebaseConfigured: false });
    const inscripcion = crearInscripcionBase();

    await repository.matricular(inscripcion);

    expect(getMockInscripciones()).toHaveLength(1);
    expect(getMockInscripciones()[0]).toMatchObject({
      estudianteId: 'estudiante-1',
      ejecucionProgramaId: 'ejecucion-1',
      tenantId: 'tenant-1',
    });
  });

  it('no duplica al matricular dos veces al mismo estudiante en la misma ejecucion', async () => {
    const repository = crearInscripcionRepository({ isFirebaseConfigured: false });
    const inscripcion = crearInscripcionBase();

    await repository.matricular(inscripcion);
    await repository.matricular({ ...inscripcion, fechaInscripcion: '2026-07-09T00:00:00.000Z' });

    expect(getMockInscripciones()).toHaveLength(1);
    expect(getMockInscripciones()[0].fechaInscripcion).toBe('2026-07-09T00:00:00.000Z');
  });

  it('retira una inscripcion en memoria', async () => {
    const repository = crearInscripcionRepository({ isFirebaseConfigured: false });
    await repository.matricular(crearInscripcionBase());

    await repository.retirar('tenant-1', 'ejecucion-1', 'estudiante-1');

    expect(getMockInscripciones()).toHaveLength(0);
  });

  it('lista inscripciones en memoria filtradas por tenant y ejecucion', async () => {
    const repository = crearInscripcionRepository({ isFirebaseConfigured: false });
    await repository.matricular(crearInscripcionBase());
    await repository.matricular(crearInscripcionBase({ estudianteId: 'estudiante-2' }));
    await repository.matricular(crearInscripcionBase({ estudianteId: 'estudiante-3', ejecucionProgramaId: 'ejecucion-2' }));
    await repository.matricular(crearInscripcionBase({ estudianteId: 'estudiante-4', tenantId: 'tenant-2' }));

    const resultado = await repository.listarPorEjecucion('tenant-1', 'ejecucion-1');

    expect(resultado).toHaveLength(2);
    expect(resultado.map((i) => i.estudianteId).sort()).toEqual(['estudiante-1', 'estudiante-2']);
  });

  it('confirma pertenencia en memoria via estaInscritoEnEjecucion', async () => {
    const repository = crearInscripcionRepository({ isFirebaseConfigured: false });
    await repository.matricular(crearInscripcionBase());

    await expect(repository.estaInscritoEnEjecucion('tenant-1', 'ejecucion-1', 'estudiante-1')).resolves.toBe(true);
    await expect(repository.estaInscritoEnEjecucion('tenant-1', 'ejecucion-1', 'estudiante-ausente')).resolves.toBe(false);
    await expect(repository.estaInscritoEnEjecucion('tenant-1', 'ejecucion-2', 'estudiante-1')).resolves.toBe(false);
  });

  it('matricula en Firestore con ruta por tenant/ejecucion/estudiante', async () => {
    const writes: Array<{ path: string[]; data: unknown; options?: unknown }> = [];
    const repository = crearInscripcionRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        deleteDoc: async () => {},
        getDoc: async () => ({ exists: () => false }),
        getDocs: async () => ({ docs: [] }),
        setDoc: async (ref: string[], data: unknown, options?: unknown) => {
          writes.push({ path: ref, data, options });
        },
      },
    });
    const inscripcion = crearInscripcionBase();

    await repository.matricular(inscripcion);

    expect(writes).toEqual([{
      path: ['db-mock', 'tenants', 'tenant-1', 'ejecucionesPrograma', 'ejecucion-1', 'inscripciones', 'estudiante-1'],
      data: inscripcion,
      options: { merge: true },
    }]);
  });

  it('retira en Firestore borrando el documento de la ruta correcta', async () => {
    const deletes: string[][] = [];
    const repository = crearInscripcionRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        deleteDoc: async (ref: string[]) => { deletes.push(ref); },
        getDoc: async () => ({ exists: () => false }),
        getDocs: async () => ({ docs: [] }),
        setDoc: async () => {},
      },
    });

    await repository.retirar('tenant-1', 'ejecucion-1', 'estudiante-1');

    expect(deletes).toEqual([
      ['db-mock', 'tenants', 'tenant-1', 'ejecucionesPrograma', 'ejecucion-1', 'inscripciones', 'estudiante-1'],
    ]);
  });

  it('lista desde Firestore consultando la subcoleccion de la ejecucion', async () => {
    const inscripcion = crearInscripcionBase();
    const repository = crearInscripcionRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        deleteDoc: async () => {},
        getDoc: async () => ({ exists: () => false }),
        getDocs: async () => ({ docs: [{ id: inscripcion.estudianteId, data: () => inscripcion }] }),
        setDoc: async () => {},
      },
    });

    const resultado = await repository.listarPorEjecucion('tenant-1', 'ejecucion-1');

    expect(resultado).toEqual([inscripcion]);
  });

  it('confirma pertenencia en Firestore via getDoc().exists()', async () => {
    const repository = crearInscripcionRepository({
      isFirebaseConfigured: true,
      db: 'db-mock' as any,
      deps: {
        collection: (...path: any[]) => path,
        doc: (...path: any[]) => path,
        deleteDoc: async () => {},
        getDoc: async () => ({ exists: () => true }),
        getDocs: async () => ({ docs: [] }),
        setDoc: async () => {},
      },
    });

    await expect(repository.estaInscritoEnEjecucion('tenant-1', 'ejecucion-1', 'estudiante-1')).resolves.toBe(true);
  });
});
