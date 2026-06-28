import {
  crearProgresoRepository,
  FirestoreProgressRepository,
  ProgresoLocalRepository,
} from './progresoRepository';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import type { ProgresoQuizLocal } from '../../utils/academico/progresoLocal';

const progreso: ProgresoQuizLocal = {
  tenantId: 'tenant-1',
  asignacionId: 'quiz-1',
  puntaje: 100,
  aprobado: true,
  intentosUsados: 1,
  estadoPostQuiz: 'aprobado',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
};

const asignacionQuiz: AsignacionCentroEstudios = {
  id: 'quiz-1',
  tenantId: 'tenant-1',
  recursoId: 'r1',
  titulo: 'Quiz demo',
  descripcion: 'Evaluación demo',
  destinatario: { tipo: 'grupo', grupo: 'Infantil' },
  uso: 'evaluacion',
  momento: 'durante',
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'disponible',
  porcentajeProgreso: 0,
  urgencia: 'alta',
};

const progresoSync = {
  paginasVistas: [1, 3],
  segundosUnicos: [12, 30],
};

describe('ProgresoLocalRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda y lee progreso de quiz mediante el contrato de repositorio', () => {
    const repository = new ProgresoLocalRepository(localStorage);

    repository.guardarQuiz(progreso);

    expect(repository.leerQuiz('tenant-1', 'quiz-1')).toEqual(progreso);
  });

  it('aplica progreso guardado a asignaciones sin exponer localStorage a la vista', () => {
    const repository = new ProgresoLocalRepository(localStorage);
    repository.guardarQuiz(progreso);

    const [asignacion] = repository.aplicarAAsignaciones([asignacionQuiz]);

    expect(asignacion.estadoProgreso).toBe('aprobado');
    expect(asignacion.porcentajeProgreso).toBe(100);
  });

  it('guarda y lee progreso granular PDF/video local para reanudar recursos', () => {
    const repository = new ProgresoLocalRepository(localStorage);

    repository.guardarSync('tenant-1', 'asig-1', progresoSync);

    expect(repository.leerSync('tenant-1', 'asig-1')).toEqual(progresoSync);
  });
});

describe('FirestoreProgressRepository', () => {
  it('lee progreso de quiz desde la ruta acadÃ©mica por tenant, estudiante y asignaciÃ³n', async () => {
    const getDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => progreso,
    });
    const setDoc = jest.fn();
    const doc = jest.fn((...segments: string[]) => segments.join('/'));
    const repository = new FirestoreProgressRepository({
      db: 'db-mock',
      estudianteId: 'est-1',
      doc,
      getDoc,
      setDoc,
    });

    await expect(repository.leerQuiz('tenant-1', 'quiz-1')).resolves.toEqual(progreso);

    expect(doc).toHaveBeenCalledWith('db-mock', 'tenants', 'tenant-1', 'progreso', 'est-1', 'asignaciones', 'quiz-1');
    expect(getDoc).toHaveBeenCalledWith('db-mock/tenants/tenant-1/progreso/est-1/asignaciones/quiz-1');
  });

  it('guarda progreso de quiz con merge para no sobrescribir campos consolidados', async () => {
    const getDoc = jest.fn();
    const setDoc = jest.fn().mockResolvedValue(undefined);
    const doc = jest.fn((...segments: string[]) => segments.join('/'));
    const repository = new FirestoreProgressRepository({
      db: 'db-mock',
      estudianteId: 'est-1',
      doc,
      getDoc,
      setDoc,
    });

    await repository.guardarQuiz(progreso);

    expect(setDoc).toHaveBeenCalledWith(
      'db-mock/tenants/tenant-1/progreso/est-1/asignaciones/quiz-1',
      progreso,
      { merge: true }
    );
  });

  it('lee progreso granular PDF/video desde Firestore para reanudar recursos', async () => {
    const getDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        tenantId: 'tenant-1',
        asignacionId: 'asig-1',
        ...progresoSync,
      }),
    });
    const repository = new FirestoreProgressRepository({
      db: 'db-mock',
      estudianteId: 'est-1',
      doc: jest.fn((...segments: string[]) => segments.join('/')),
      getDoc,
      setDoc: jest.fn(),
    });

    await expect(repository.leerSync('tenant-1', 'asig-1')).resolves.toEqual(progresoSync);
  });

  it('guarda progreso granular PDF/video con merge para consolidacion posterior', async () => {
    const setDoc = jest.fn().mockResolvedValue(undefined);
    const repository = new FirestoreProgressRepository({
      db: 'db-mock',
      estudianteId: 'est-1',
      doc: jest.fn((...segments: string[]) => segments.join('/')),
      getDoc: jest.fn(),
      setDoc,
    });

    await repository.guardarSync('tenant-1', 'asig-1', progresoSync);

    expect(setDoc).toHaveBeenCalledWith(
      'db-mock/tenants/tenant-1/progreso/est-1/asignaciones/asig-1',
      expect.objectContaining({
        tenantId: 'tenant-1',
        asignacionId: 'asig-1',
        paginasVistas: [1, 3],
        segundosUnicos: [12, 30],
      }),
      { merge: true }
    );
  });

  it('ignora progreso si el documento no corresponde al tenant y asignaciÃ³n solicitados', async () => {
    const getDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...progreso,
        tenantId: 'otro-tenant',
      }),
    });
    const repository = new FirestoreProgressRepository({
      db: 'db-mock',
      estudianteId: 'est-1',
      doc: jest.fn((...segments: string[]) => segments.join('/')),
      getDoc,
      setDoc: jest.fn(),
    });

    await expect(repository.leerQuiz('tenant-1', 'quiz-1')).resolves.toBeNull();
  });
});

describe('crearProgresoRepository', () => {
  it('usa repositorio local si no hay estudiante autenticado', () => {
    const repository = crearProgresoRepository({
      modo: 'firestore',
      estudianteId: null,
      firestoreDeps: {
        db: 'db-mock',
        doc: jest.fn(),
        getDoc: jest.fn(),
        setDoc: jest.fn(),
      },
    });

    expect(repository).toBeInstanceOf(ProgresoLocalRepository);
  });

  it('usa Firestore si el modo y las dependencias estÃ¡n listas', () => {
    const repository = crearProgresoRepository({
      modo: 'firestore',
      estudianteId: 'est-1',
      firestoreDeps: {
        db: 'db-mock',
        doc: jest.fn(),
        getDoc: jest.fn(),
        setDoc: jest.fn(),
      },
    });

    expect(repository).toBeInstanceOf(FirestoreProgressRepository);
  });

  it('mantiene repositorio local cuando el modo solicitado es local', () => {
    const repository = crearProgresoRepository({
      modo: 'local',
      estudianteId: 'est-1',
      firestoreDeps: {
        db: 'db-mock',
        doc: jest.fn(),
        getDoc: jest.fn(),
        setDoc: jest.fn(),
      },
    });

    expect(repository).toBeInstanceOf(ProgresoLocalRepository);
  });
});
