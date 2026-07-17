import {
  FirestoreVisualizacionRepository,
  VisualizacionLocalRepository,
  calcularPorcentajeVisto,
  esVideoCompletado,
  crearVisualizacionRepository,
} from './visualizacionRepository';

describe('calcularPorcentajeVisto', () => {
  it('calcula el porcentaje redondeado sobre la duracion total', () => {
    expect(calcularPorcentajeVisto(45, 90)).toBe(50);
  });

  it('nunca supera 100 aunque la posicion exceda la duracion', () => {
    expect(calcularPorcentajeVisto(120, 90)).toBe(100);
  });

  it('devuelve 0 si la duracion es 0 o invalida', () => {
    expect(calcularPorcentajeVisto(30, 0)).toBe(0);
    expect(calcularPorcentajeVisto(30, NaN)).toBe(0);
  });

  it('devuelve 0 si la posicion es 0 o negativa', () => {
    expect(calcularPorcentajeVisto(0, 90)).toBe(0);
    expect(calcularPorcentajeVisto(-5, 90)).toBe(0);
  });
});

describe('esVideoCompletado', () => {
  it('es true a partir de 90%', () => {
    expect(esVideoCompletado(90)).toBe(true);
    expect(esVideoCompletado(95)).toBe(true);
  });

  it('es false por debajo de 90%', () => {
    expect(esVideoCompletado(89)).toBe(false);
  });
});

describe('VisualizacionLocalRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('registra la primera reproduccion y calcula porcentaje/completado', async () => {
    const repository = new VisualizacionLocalRepository(localStorage);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      estudianteNombre: 'Juan Perez',
      posicionSegundos: 45,
      duracionSegundos: 90,
      nuevoInicio: true,
    });

    const guardado = await repository.leer('tenant-1', 'recurso-1', 'est-1');
    expect(guardado).toMatchObject({
      tenantId: 'tenant-1',
      recursoId: 'recurso-1',
      estudianteId: 'est-1',
      estudianteNombre: 'Juan Perez',
      ultimaPosicionSegundos: 45,
      duracionSegundos: 90,
      porcentajeVisto: 50,
      completado: false,
      vecesIniciado: 1,
    });
    expect(guardado?.primeraReproduccion).toBeTruthy();
  });

  it('marca completado cuando el porcentaje visto llega a 90% o mas', async () => {
    const repository = new VisualizacionLocalRepository(localStorage);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 85,
      duracionSegundos: 90,
    });

    const guardado = await repository.leer('tenant-1', 'recurso-1', 'est-1');
    expect(guardado?.porcentajeVisto).toBe(94);
    expect(guardado?.completado).toBe(true);
  });

  it('no retrocede el porcentaje visto ni el estado completado en syncs posteriores', async () => {
    const repository = new VisualizacionLocalRepository(localStorage);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 90,
      duracionSegundos: 90,
    });
    // El alumno rebobina y el proximo flush reporta una posicion menor.
    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 10,
      duracionSegundos: 90,
    });

    const guardado = await repository.leer('tenant-1', 'recurso-1', 'est-1');
    expect(guardado?.porcentajeVisto).toBe(100);
    expect(guardado?.completado).toBe(true);
  });

  it('conserva primeraReproduccion y acumula vecesIniciado en syncs sucesivos', async () => {
    const repository = new VisualizacionLocalRepository(localStorage);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 5,
      duracionSegundos: 90,
      nuevoInicio: true,
    });
    const primera = await repository.leer('tenant-1', 'recurso-1', 'est-1');

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 20,
      duracionSegundos: 90,
      nuevoInicio: true,
    });
    const segunda = await repository.leer('tenant-1', 'recurso-1', 'est-1');

    expect(segunda?.primeraReproduccion).toBe(primera?.primeraReproduccion);
    expect(segunda?.vecesIniciado).toBe(2);
  });

  it('lista todas las visualizaciones de un recurso para el reporte de staff', async () => {
    const repository = new VisualizacionLocalRepository(localStorage);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      estudianteNombre: 'Ana',
      posicionSegundos: 90,
      duracionSegundos: 90,
    });
    await repository.registrarSync('tenant-1', 'recurso-1', 'est-2', {
      estudianteNombre: 'Beto',
      posicionSegundos: 20,
      duracionSegundos: 90,
    });
    // De otro recurso -- no debe aparecer en el listado.
    await repository.registrarSync('tenant-1', 'recurso-2', 'est-1', {
      posicionSegundos: 30,
      duracionSegundos: 60,
    });

    const lista = await repository.listarPorRecurso('tenant-1', 'recurso-1');
    expect(lista).toHaveLength(2);
    expect(lista.map((v) => v.estudianteNombre).sort()).toEqual(['Ana', 'Beto']);
  });
});

describe('FirestoreVisualizacionRepository', () => {
  const crearDeps = () => ({
    db: 'db-mock',
    doc: jest.fn((...segments: string[]) => segments.join('/')),
    getDoc: jest.fn(),
    setDoc: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn((...segments: string[]) => segments.join('/')),
    getDocs: jest.fn(),
  });

  it('arma la referencia con la ruta tenants/{t}/visualizaciones/{recurso}/alumnos/{uid}', async () => {
    const deps = crearDeps();
    deps.getDoc.mockResolvedValue({ exists: () => false, data: () => null });
    const repository = new FirestoreVisualizacionRepository(deps);

    await repository.registrarSync('tenant-1', 'recurso-1', 'est-1', {
      posicionSegundos: 30,
      duracionSegundos: 60,
      nuevoInicio: true,
    });

    expect(deps.doc).toHaveBeenCalledWith(
      'db-mock', 'tenants', 'tenant-1', 'visualizaciones', 'recurso-1', 'alumnos', 'est-1'
    );
    expect(deps.setDoc).toHaveBeenCalledWith(
      'db-mock/tenants/tenant-1/visualizaciones/recurso-1/alumnos/est-1',
      expect.objectContaining({
        tenantId: 'tenant-1',
        recursoId: 'recurso-1',
        estudianteId: 'est-1',
        ultimaPosicionSegundos: 30,
        duracionSegundos: 60,
        porcentajeVisto: 50,
        vecesIniciado: 1,
      }),
      { merge: true }
    );
  });

  it('lee null cuando el documento no existe', async () => {
    const deps = crearDeps();
    deps.getDoc.mockResolvedValue({ exists: () => false, data: () => null });
    const repository = new FirestoreVisualizacionRepository(deps);

    await expect(repository.leer('tenant-1', 'recurso-1', 'est-1')).resolves.toBeNull();
  });

  it('listarPorRecurso mapea los docs de la coleccion alumnos', async () => {
    const deps = crearDeps();
    deps.getDocs.mockResolvedValue({
      docs: [
        { id: 'est-1', data: () => ({ estudianteId: 'est-1', porcentajeVisto: 100 }) },
        { id: 'est-2', data: () => ({ estudianteId: 'est-2', porcentajeVisto: 40 }) },
      ],
    });
    const repository = new FirestoreVisualizacionRepository(deps);

    const lista = await repository.listarPorRecurso('tenant-1', 'recurso-1');

    expect(deps.collection).toHaveBeenCalledWith(
      'db-mock', 'tenants', 'tenant-1', 'visualizaciones', 'recurso-1', 'alumnos'
    );
    expect(lista).toHaveLength(2);
    expect(lista[0].estudianteId).toBe('est-1');
  });
});

describe('crearVisualizacionRepository', () => {
  it('usa repositorio local si no se pide modo firestore', () => {
    const repository = crearVisualizacionRepository();
    expect(repository).toBeInstanceOf(VisualizacionLocalRepository);
  });

  it('usa Firestore si el modo y las dependencias estan listas', () => {
    const repository = crearVisualizacionRepository({
      modo: 'firestore',
      firestoreDeps: {
        db: 'db-mock',
        doc: jest.fn(),
        getDoc: jest.fn(),
        setDoc: jest.fn(),
        collection: jest.fn(),
        getDocs: jest.fn(),
      },
    });

    expect(repository).toBeInstanceOf(FirestoreVisualizacionRepository);
  });
});
