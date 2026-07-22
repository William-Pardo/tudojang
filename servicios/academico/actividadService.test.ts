// servicios/academico/actividadService.test.ts
// Tests unitarios para actividadService.
// Usa modo local (isFirebaseConfigured: false) para evitar dependencias de Firestore.

import {
  crearActividadService,
  __resetMockStore,
  __getMockLogs,
  __getMockMetricas,
} from './actividadService';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...path: unknown[]) => path),
  doc: jest.fn((_db: unknown, ...path: unknown[]) => path),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  setDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn((...args: unknown[]) => args[0]),
  where: jest.fn(),
  orderBy: jest.fn(),
}));

jest.mock('../../firebase/config', () => ({
  isFirebaseConfigured: false,
  db: 'db-mock',
}));

// Servicio en modo local para tests
const service = crearActividadService({ isFirebaseConfigured: false });

beforeEach(() => {
  __resetMockStore();
});

describe('actividadService — modo local', () => {
  // ---- registrarActividad ------------------------------------------------

  describe('registrarActividad', () => {
    it('registra un log de apertura de imagen', async () => {
      const res = await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        estudianteNombre: 'Ana García',
        asignacionId: 'asig-1',
        recursoId: 'rec-1',
        tituloRecurso: 'Técnica de Pataleta.jpg',
        tipo: 'imagen',
        metadata: { duracionSegundos: 30 },
      });

      expect(res.ok).toBe(true);
      expect(res.logId).toBeTruthy();
      expect(__getMockLogs()).toHaveLength(1);
    });

    it('registra un log de video con porcentaje', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-2',
        recursoId: 'rec-2',
        tituloRecurso: 'Clase Magistral Ep.1',
        tipo: 'video',
        metadata: { porcentajeVisto: 75, checkpoints: [25, 50, 75] },
      });

      const logs = __getMockLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].tipo).toBe('video');
      expect((logs[0].metadata as any).porcentajeVisto).toBe(75);
    });

    it('registra un quiz con score', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-3',
        recursoId: 'rec-3',
        tituloRecurso: 'Evaluación Unidad 1',
        tipo: 'quiz',
        metadata: {
          totalPreguntas: 10,
          correctas: 8,
          incorrectas: 2,
          score: 80,
          tiempoSegundos: 300,
        },
      });

      const logs = __getMockLogs();
      expect(logs[0].tipo).toBe('quiz');
      expect((logs[0].metadata as any).score).toBe(80);
    });

    it('lanza error si faltan campos requeridos', async () => {
      await expect(
        service.registrarActividad({
          tenantId: '',
          estudianteId: 'est-1',
          asignacionId: 'asig-1',
          recursoId: 'rec-1',
          tipo: 'apertura',
          metadata: {},
        })
      ).rejects.toThrow('requeridos');
    });

    it('lanza error si falta estudianteId', async () => {
      await expect(
        service.registrarActividad({
          tenantId: 'tenant-1',
          estudianteId: '',
          asignacionId: 'asig-1',
          recursoId: 'rec-1',
          tipo: 'apertura',
          metadata: {},
        })
      ).rejects.toThrow('requeridos');
    });
  });

  // ---- calcular métricas (vía side effect de registrarActividad) ----------

  describe('métricas calculadas automáticamente', () => {
    it('calcula porcentajeConsumo=100 para imagen abierta', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-img',
        recursoId: 'rec-img',
        tipo: 'imagen',
        metadata: {},
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1', estudianteId: 'est-1' });
      expect(metricas).toHaveLength(1);
      const avance = metricas[0].avancePorAsignacion.find((a) => a.asignacionId === 'asig-img');
      expect(avance?.porcentajeConsumo).toBe(100);
    });

    it('calcula porcentajeConsumo=75 para video al 75%', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-vid',
        recursoId: 'rec-vid',
        tipo: 'video',
        metadata: { porcentajeVisto: 75 },
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1', estudianteId: 'est-1' });
      const avance = metricas[0].avancePorAsignacion.find((a) => a.asignacionId === 'asig-vid');
      expect(avance?.porcentajeConsumo).toBe(75);
    });

    it('calcula score del quiz correctamente', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-quiz',
        recursoId: 'rec-quiz',
        tipo: 'quiz',
        metadata: { totalPreguntas: 10, correctas: 9, incorrectas: 1, score: 90 },
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1', estudianteId: 'est-1' });
      const avance = metricas[0].avancePorAsignacion.find((a) => a.asignacionId === 'asig-quiz');
      expect(avance?.scoreUltimaEvaluacion).toBe(90);
      expect(metricas[0].totalEvaluacionesRealizadas).toBe(1);
      expect(metricas[0].promedioScoreEvaluaciones).toBe(90);
    });

    it('calcula promedio de score con múltiples quizzes', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-q1',
        recursoId: 'rec-q1',
        tipo: 'quiz',
        metadata: { totalPreguntas: 10, correctas: 6, incorrectas: 4, score: 60 },
      });
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-q2',
        recursoId: 'rec-q2',
        tipo: 'quiz',
        metadata: { totalPreguntas: 10, correctas: 8, incorrectas: 2, score: 80 },
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1', estudianteId: 'est-1' });
      expect(metricas[0].totalEvaluacionesRealizadas).toBe(2);
      expect(metricas[0].promedioScoreEvaluaciones).toBe(70);
    });

    it('asignacionesCompletadas = 1 cuando porcentaje >= 80', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-1',
        asignacionId: 'asig-vid',
        recursoId: 'rec-vid',
        tipo: 'video',
        metadata: { porcentajeVisto: 90 },
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1', estudianteId: 'est-1' });
      expect(metricas[0].asignacionesCompletadas).toBe(1);
    });

    it('no mezcla métricas entre estudiantes', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-A',
        asignacionId: 'asig-1',
        recursoId: 'rec-1',
        tipo: 'imagen',
        metadata: {},
      });
      await service.registrarActividad({
        tenantId: 'tenant-1',
        estudianteId: 'est-B',
        asignacionId: 'asig-1',
        recursoId: 'rec-1',
        tipo: 'imagen',
        metadata: {},
      });

      const { metricas } = await service.obtenerMetricas({ tenantId: 'tenant-1' });
      expect(metricas).toHaveLength(2);
      expect(metricas.map((m) => m.estudianteId).sort()).toEqual(['est-A', 'est-B'].sort());
    });
  });

  // ---- obtenerActividades ------------------------------------------------

  describe('obtenerActividades', () => {
    it('filtra por estudianteId', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1', estudianteId: 'est-A', asignacionId: 'a1',
        recursoId: 'r1', tipo: 'imagen', metadata: {},
      });
      await service.registrarActividad({
        tenantId: 'tenant-1', estudianteId: 'est-B', asignacionId: 'a1',
        recursoId: 'r1', tipo: 'imagen', metadata: {},
      });

      const { logs } = await service.obtenerActividades({ tenantId: 'tenant-1', estudianteId: 'est-A' });
      expect(logs).toHaveLength(1);
      expect(logs[0].estudianteId).toBe('est-A');
    });

    it('filtra por asignacionId', async () => {
      await service.registrarActividad({
        tenantId: 'tenant-1', estudianteId: 'est-A', asignacionId: 'asig-X',
        recursoId: 'r1', tipo: 'imagen', metadata: {},
      });
      await service.registrarActividad({
        tenantId: 'tenant-1', estudianteId: 'est-A', asignacionId: 'asig-Y',
        recursoId: 'r2', tipo: 'video', metadata: { porcentajeVisto: 50 },
      });

      const { logs } = await service.obtenerActividades({ tenantId: 'tenant-1', asignacionId: 'asig-X' });
      expect(logs).toHaveLength(1);
      expect(logs[0].asignacionId).toBe('asig-X');
    });
  });
});
