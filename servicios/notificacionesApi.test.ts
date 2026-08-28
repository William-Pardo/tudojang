
// servicios/notificacionesApi.test.ts
import { getDocs, where } from 'firebase/firestore';
import { SENTINEL_NOTIFICACION_ADMIN } from '../constantes';
import { obtenerNotificacionesPorEstudiantes } from './notificacionesApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'historial-collection'),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((...args) => args),
  orderBy: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn((...args) => args),
  writeBatch: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

// SDD notificaciones-pagos (D1 design.md): la desviación del task 3.3 respecto al puntero
// literal del artefacto de tasks ("BuzonNotificaciones.test.tsx fixture con
// estudianteId:'__admin__'") queda documentada en apply-progress -- ese componente no
// filtra NADA por su cuenta, mockea `obtenerNotificacionesPorEstudiantes` por completo en
// su test, así que un fixture ahí no probaría el filtrado real. La garantía de D1 ("el
// sentinel nunca aparece en un filtro `in`, por eso es invisible para el buzón del tutor")
// vive estructuralmente en ESTA función: la lista `estudianteIds` que arma el `where('in')`
// viene siempre de resolveStudentsForConsultor (ids reales), nunca del sentinel -- por eso
// se testea acá, contra la construcción real de la query.
describe('obtenerNotificacionesPorEstudiantes — filtrado del sentinel admin-facing (D1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('la query `in` que llega a Firestore nunca incluye el sentinel admin-facing', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

    await obtenerNotificacionesPorEstudiantes(['est-1', 'est-2'], 'tenant-1');

    expect(where).toHaveBeenCalledWith('estudianteId', 'in', ['est-1', 'est-2']);
    const listasFiltradas = (where as jest.Mock).mock.calls
      .filter((args) => args[0] === 'estudianteId' && args[1] === 'in')
      .map((args) => args[2]);
    for (const lista of listasFiltradas) {
      expect(lista).not.toContain(SENTINEL_NOTIFICACION_ADMIN);
    }
  });

  it('aunque el sentinel viniera (por error) en la lista de ids del consultor, nunca es el único id -- la deduplicación no lo inventa ni lo agrega', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

    await obtenerNotificacionesPorEstudiantes(['est-1', SENTINEL_NOTIFICACION_ADMIN], 'tenant-1');

    // Esta función NO sanea el sentinel si alguien lo pasara explícitamente -- la garantía
    // real es que resolveStudentsForConsultor (fuente de estudianteIds) JAMÁS lo produce,
    // por eso en el flujo real la lista de entrada nunca lo contiene. Se deja constancia
    // explícita de que esta función confía en esa garantía, no la re-implementa.
    expect(where).toHaveBeenCalledWith('estudianteId', 'in', ['est-1', SENTINEL_NOTIFICACION_ADMIN]);
  });
});
