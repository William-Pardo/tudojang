// servicios/academico/bibliotecaService.propagarTitulo.test.ts
// Regresión: renombrar un recurso (tituloVisible) no actualizaba el nombre en cascada en
// las asignaciones ya publicadas que lo referencian (Agenda, Centro de Estudios, Progreso
// por Estudiante seguían mostrando el nombre viejo, ya que AsignacionAcademica.titulo es
// una copia tomada al momento de publicar, no una referencia en vivo al recurso).

const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockWriteBatch = jest.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit }));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...path: unknown[]) => ({ __path: path.join('/') })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: jest.fn((_db: unknown, ...path: unknown[]) => ({ __path: path.join('/') })),
  query: jest.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  setDoc: jest.fn(),
}));

jest.mock('../../firebase/config', () => ({
  isFirebaseConfigured: false,
  db: 'db-mock',
}));

import { crearBibliotecaService } from './bibliotecaService';

const TENANT_ID = 'tenant-real';
const RECURSO_ID = 'recurso-1';

function mockRecursoExistente(overrides: Record<string, unknown> = {}) {
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
      id: RECURSO_ID,
      tenantId: TENANT_ID,
      nombre: 'archivo-original.pdf',
      tituloVisible: 'Nombre viejo',
      estado: 'aprobado',
      ...overrides,
    }),
  });
}

function mockAsignacionesQueReferencianElRecurso(refs: string[]) {
  mockGetDocs.mockResolvedValue({
    empty: refs.length === 0,
    docs: refs.map((id) => ({ ref: { __id: id } })),
  });
}

describe('bibliotecaService.updateFicha — propaga el título nuevo a las asignaciones (modo Firestore real)', () => {
  const servicio = crearBibliotecaService({ db: 'db-fake' as any, isFirebaseConfigured: true });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('actualiza titulo en batch en todas las asignaciones que referencian el recurso renombrado', async () => {
    mockRecursoExistente();
    mockAsignacionesQueReferencianElRecurso(['asignacion-a', 'asignacion-b']);

    await servicio.updateFicha(
      TENANT_ID,
      RECURSO_ID,
      { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
      'Nombre nuevo'
    );

    expect(mockWriteBatch).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      { __id: 'asignacion-a' },
      expect.objectContaining({ titulo: 'Nombre nuevo' })
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      { __id: 'asignacion-b' },
      expect.objectContaining({ titulo: 'Nombre nuevo' })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('no toca Firestore de asignaciones si el recurso no tiene ninguna asignación publicada', async () => {
    mockRecursoExistente();
    mockAsignacionesQueReferencianElRecurso([]);

    await servicio.updateFicha(
      TENANT_ID,
      RECURSO_ID,
      { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
      'Nombre nuevo'
    );

    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('no propaga nada si no se pasa un tituloVisible nuevo (solo cambian tags/disciplina)', async () => {
    mockRecursoExistente();

    await servicio.updateFicha(
      TENANT_ID,
      RECURSO_ID,
      { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any
      // sin tituloVisible
    );

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('no propaga si el tituloVisible nuevo es igual al que ya tenía el recurso', async () => {
    mockRecursoExistente({ tituloVisible: 'Mismo nombre' });

    await servicio.updateFicha(
      TENANT_ID,
      RECURSO_ID,
      { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
      'Mismo nombre'
    );

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('si falla la propagación (Firestore caído), no revienta updateFicha -- el recurso ya se guardó', async () => {
    mockRecursoExistente();
    mockGetDocs.mockRejectedValue(new Error('Firestore caído'));

    await expect(
      servicio.updateFicha(
        TENANT_ID,
        RECURSO_ID,
        { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
        'Nombre nuevo'
      )
    ).resolves.toBeUndefined();

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
});
