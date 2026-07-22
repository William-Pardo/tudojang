/**
 * Firestore falso en memoria, para PRUEBAS DE INTEGRACION.
 *
 * Diferencia con los mocks unitarios que ya usa el repo (`jest.mock('firebase/firestore',
 * () => ({ getDocs: jest.fn() }))`): esos devuelven un valor preparado por el test, asi
 * que la capa de arriba nunca ejerce la logica de consulta real. Este modulo implementa
 * la SEMANTICA de Firestore (paths, subcolecciones, where con field paths anidados,
 * orderBy, limit) sobre un Map, de modo que servicios + repositorios + componentes corran
 * de verdad entre si y lo unico simulado sea el SDK.
 *
 * Uso desde un test:
 *
 *   jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').crearApiFirestoreFake());
 *   jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
 *
 *   import { sembrarDoc, limpiarFirestoreFake } from '../test-utils/fakeFirestore';
 *
 * El store es un singleton de modulo (no una instancia por test) porque la factory de
 * `jest.mock` se evalua antes que el cuerpo del test y no puede capturar variables
 * locales: ambos lados comparten estado via el registro de modulos de Jest.
 */

type DocumentoFake = Record<string, any>;

const store = new Map<string, DocumentoFake>();

// --- Manipulacion del store desde el test -----------------------------------------

/** Siembra un documento. `path` es la ruta completa: 'estudiantes/est-1' o 'tenants/t1/asignaciones/a1'. */
export const sembrarDoc = (path: string, data: DocumentoFake): void => {
  store.set(normalizarPath(path), { ...data });
};

/** Siembra varios documentos de una coleccion: sembrarColeccion('estudiantes', { 'est-1': {...} }). */
export const sembrarColeccion = (
  pathColeccion: string,
  documentos: Record<string, DocumentoFake>
): void => {
  Object.entries(documentos).forEach(([id, data]) => {
    sembrarDoc(`${pathColeccion}/${id}`, data);
  });
};

/** Lee un documento tal cual quedo en el store (para assertions sobre escrituras). */
export const leerDoc = (path: string): DocumentoFake | undefined => store.get(normalizarPath(path));

/** Lista los paths de los documentos de una coleccion (para assertions sobre altas). */
export const listarPaths = (pathColeccion?: string): string[] => {
  const paths = [...store.keys()];
  if (!pathColeccion) return paths.sort();
  return paths.filter((p) => esHijoDirecto(p, normalizarPath(pathColeccion))).sort();
};

export const limpiarFirestoreFake = (): void => {
  store.clear();
};

// --- Helpers internos --------------------------------------------------------------

const normalizarPath = (path: string): string =>
  path.split('/').filter(Boolean).join('/');

const unirSegmentos = (segmentos: any[]): string =>
  normalizarPath(segmentos.filter((s) => typeof s === 'string').join('/'));

/** true si `path` es un documento directo de `pathColeccion` (no de una subcoleccion). */
const esHijoDirecto = (path: string, pathColeccion: string): boolean => {
  if (!path.startsWith(`${pathColeccion}/`)) return false;
  const resto = path.slice(pathColeccion.length + 1);
  return !resto.includes('/');
};

/** Resuelve un field path de Firestore, incluyendo anidados ('tutor.correo'). */
const valorEnCampo = (data: DocumentoFake, campo: string): any =>
  campo.split('.').reduce<any>((acc, parte) => (acc == null ? undefined : acc[parte]), data);

const comparar = (valor: any, operador: string, referencia: any): boolean => {
  switch (operador) {
    case '==':
      return valor === referencia;
    case '!=':
      return valor !== referencia;
    case '>':
      return valor > referencia;
    case '>=':
      return valor >= referencia;
    case '<':
      return valor < referencia;
    case '<=':
      return valor <= referencia;
    case 'in':
      return Array.isArray(referencia) && referencia.includes(valor);
    case 'not-in':
      return Array.isArray(referencia) && !referencia.includes(valor);
    case 'array-contains':
      return Array.isArray(valor) && valor.includes(referencia);
    case 'array-contains-any':
      return Array.isArray(valor) && Array.isArray(referencia) && referencia.some((r) => valor.includes(r));
    default:
      throw new Error(`fakeFirestore: operador no soportado "${operador}"`);
  }
};

const snapshotDoc = (path: string) => {
  const data = store.get(path);
  const id = path.split('/').pop() as string;
  return {
    id,
    ref: { __tipo: 'doc' as const, path },
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : { ...data }),
  };
};

const snapshotQuery = (paths: string[]) => {
  const docs = paths.map(snapshotDoc);
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (d: (typeof docs)[number]) => void) => docs.forEach(cb),
  };
};

// --- API que reemplaza a 'firebase/firestore' --------------------------------------

export const crearApiFirestoreFake = () => {
  const doc = (...args: any[]) => {
    // doc(db, 'coleccion', 'id', ...) — el primer argumento es `db` (o una ref de coleccion).
    const [primero, ...resto] = args;
    const base = primero && primero.__tipo === 'collection' ? primero.path : '';
    const path = normalizarPath([base, unirSegmentos(resto)].filter(Boolean).join('/'));
    return { __tipo: 'doc' as const, path };
  };

  const collection = (...args: any[]) => {
    const [primero, ...resto] = args;
    const base = primero && primero.__tipo === 'doc' ? primero.path : '';
    const path = normalizarPath([base, unirSegmentos(resto)].filter(Boolean).join('/'));
    return { __tipo: 'collection' as const, path };
  };

  const where = (campo: string, operador: string, valor: any) =>
    ({ __restriccion: 'where' as const, campo, operador, valor });

  const orderBy = (campo: string, direccion: 'asc' | 'desc' = 'asc') =>
    ({ __restriccion: 'orderBy' as const, campo, direccion });

  const limit = (cantidad: number) => ({ __restriccion: 'limit' as const, cantidad });

  const query = (ref: any, ...restricciones: any[]) => ({
    __tipo: 'query' as const,
    path: ref.path,
    restricciones: [...(ref.restricciones ?? []), ...restricciones],
  });

  const getDoc = async (ref: any) => snapshotDoc(normalizarPath(ref.path));

  const getDocs = async (refOQuery: any) => {
    const path = normalizarPath(refOQuery.path);
    const restricciones = refOQuery.restricciones ?? [];

    let paths = [...store.keys()].filter((p) => esHijoDirecto(p, path));

    restricciones
      .filter((r: any) => r.__restriccion === 'where')
      .forEach((r: any) => {
        paths = paths.filter((p) => comparar(valorEnCampo(store.get(p)!, r.campo), r.operador, r.valor));
      });

    const orden = restricciones.filter((r: any) => r.__restriccion === 'orderBy');
    if (orden.length > 0) {
      paths.sort((a, b) => {
        for (const r of orden) {
          const va = valorEnCampo(store.get(a)!, r.campo);
          const vb = valorEnCampo(store.get(b)!, r.campo);
          if (va === vb) continue;
          const signo = r.direccion === 'desc' ? -1 : 1;
          return (va > vb ? 1 : -1) * signo;
        }
        return 0;
      });
    } else {
      paths.sort();
    }

    const tope = restricciones.find((r: any) => r.__restriccion === 'limit');
    if (tope) paths = paths.slice(0, tope.cantidad);

    return snapshotQuery(paths);
  };

  const setDoc = async (ref: any, data: DocumentoFake, opciones?: { merge?: boolean }) => {
    const path = normalizarPath(ref.path);
    const previo = opciones?.merge ? (store.get(path) ?? {}) : {};
    store.set(path, { ...previo, ...data });
  };

  const updateDoc = async (ref: any, data: DocumentoFake) => {
    const path = normalizarPath(ref.path);
    if (!store.has(path)) throw new Error(`fakeFirestore: updateDoc sobre doc inexistente ${path}`);
    store.set(path, { ...store.get(path), ...data });
  };

  const deleteDoc = async (ref: any) => {
    store.delete(normalizarPath(ref.path));
  };

  const addDoc = async (ref: any, data: DocumentoFake) => {
    const id = `auto-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${normalizarPath(ref.path)}/${id}`;
    store.set(path, { ...data });
    return { id, path };
  };

  const writeBatch = () => {
    const operaciones: Array<() => Promise<void>> = [];
    const lote = {
      set: (ref: any, data: DocumentoFake, opciones?: { merge?: boolean }) => {
        operaciones.push(() => setDoc(ref, data, opciones));
        return lote;
      },
      update: (ref: any, data: DocumentoFake) => {
        operaciones.push(() => updateDoc(ref, data));
        return lote;
      },
      delete: (ref: any) => {
        operaciones.push(() => deleteDoc(ref));
        return lote;
      },
      commit: async () => {
        for (const operacion of operaciones) await operacion();
      },
    };
    return lote;
  };

  return {
    doc,
    collection,
    collectionGroup: collection,
    query,
    where,
    orderBy,
    limit,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    writeBatch,
    // Exports que algunos modulos del grafo importan pero que estas pruebas no ejercen.
    getFirestore: () => ({}),
    onSnapshot: () => () => {},
    serverTimestamp: () => new Date().toISOString(),
    increment: (n: number) => n,
    arrayUnion: (...valores: any[]) => valores,
    arrayRemove: (...valores: any[]) => valores,
    Timestamp: {
      now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
      fromDate: (fecha: Date) => ({ toDate: () => fecha, toMillis: () => fecha.getTime() }),
    },
    enableIndexedDbPersistence: async () => {},
    initializeFirestore: () => ({}),
  };
};
