import { collection, getDocs } from 'firebase/firestore';
import { obtenerIndicadoresPendientes, resolverHallazgo } from './indicadoresEstudianteApi';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'coleccion-mock'),
  getDocs: jest.fn(),
}));
jest.mock('../../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(() => mockCallable),
}));

const hallazgoSinResolver = {
  id: 'riesgo_desercion-2026-09-01', tipo: 'riesgo_desercion', severidad: 'media',
  fechaDeteccion: '2026-09-01T06:00:00.000Z', fechaActualizacion: '2026-09-08T06:00:00.000Z',
  metricas: {}, resuelto: false,
};
const hallazgoResuelto = {
  id: 'candidato_fidelizacion-2026-08-01', tipo: 'candidato_fidelizacion', severidad: 'media',
  fechaDeteccion: '2026-08-01T06:00:00.000Z', fechaActualizacion: '2026-08-01T06:00:00.000Z',
  metricas: {}, resuelto: true, resueltoEn: '2026-08-05T00:00:00.000Z', resueltoPor: 'admin-1',
};

describe('indicadoresEstudianteApi', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('obtenerIndicadoresPendientes', () => {
    it('trae los indicadores del tenant y filtra en memoria los que tienen al menos un hallazgo sin resolver', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [
          { data: () => ({ estudianteId: 'e1', tenantId: 't1', hallazgos: [hallazgoSinResolver], ultimaEvaluacion: 'x' }) },
          { data: () => ({ estudianteId: 'e2', tenantId: 't1', hallazgos: [hallazgoResuelto], ultimaEvaluacion: 'x' }) },
        ],
      });

      const resultado = await obtenerIndicadoresPendientes('t1');

      expect(collection).toHaveBeenCalledWith({}, 'tenants', 't1', 'indicadoresEstudiante');
      expect(resultado).toEqual([
        { estudianteId: 'e1', tenantId: 't1', hallazgos: [hallazgoSinResolver], ultimaEvaluacion: 'x' },
      ]);
    });

    it('no llama a Firestore sin tenantId', async () => {
      const resultado = await obtenerIndicadoresPendientes('');
      expect(resultado).toEqual([]);
      expect(getDocs).not.toHaveBeenCalled();
    });
  });

  describe('resolverHallazgo (wrapper sobre httpsCallable)', () => {
    it('llama a la Cloud Function con tenantId/estudianteId/hallazgoId/nota', async () => {
      mockCallable.mockResolvedValue({ data: { ok: true } });

      await resolverHallazgo('t1', 'e1', 'riesgo_desercion-2026-09-01', 'Ya se puso al día');

      expect(mockCallable).toHaveBeenCalledWith({
        tenantId: 't1', estudianteId: 'e1', hallazgoId: 'riesgo_desercion-2026-09-01', nota: 'Ya se puso al día',
      });
    });

    it('propaga el error que devuelva la Cloud Function', async () => {
      mockCallable.mockRejectedValue(new Error('No se encontró ese hallazgo'));
      await expect(resolverHallazgo('t1', 'e1', 'h1')).rejects.toThrow('No se encontró ese hallazgo');
    });
  });
});
