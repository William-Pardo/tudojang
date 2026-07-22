// RED tests for FirestoreCentroEstudiosRepository
import { FirestoreCentroEstudiosRepository } from '../centroEstudiosRepository';
import { prepararAsignacionesCentroEstudios } from '../centroEstudiosRepository';
import type { ProgresoRepository } from '../progresoRepository';

// Mock utilities
jest.mock('../../../utils/academico/centroEstudios', () => ({
  ordenarAsignacionesPorUrgencia: (asig: any) => asig,
}));
jest.mock('../asignacionService', () => ({
  aplicaAlEstudiante: jest.fn(),
  obtenerAsignacionesPorEstudiante: jest.fn(),
}));

import { aplicaAlEstudiante } from '../asignacionService';

describe('FirestoreCentroEstudiosRepository - RED', () => {
  const mockDb = {};
  const mockDoc = jest.fn();
  const mockGetDoc = jest.fn();
  const mockCollection = jest.fn();
  const mockQuery = jest.fn();
  const mockWhere = jest.fn();
  const mockGetDocs = jest.fn();

  // Fix 2026-07-21 (`npm run typecheck`): fake parcial deliberado. De todo
  // ProgresoRepository, FirestoreCentroEstudiosRepository solo llama
  // `aplicarAAsignaciones` (via prepararAsignacionesCentroEstudios, que hace
  // `'aplicarAAsignaciones' in progreso`), asi que se acota en vez de implementar
  // leerQuiz/guardarQuiz/leerSync/guardarSync sin uso en este test.
  const mockProgreso = {
    aplicarAAsignaciones: (asig: any) => asig,
  } as unknown as ProgresoRepository;

  const deps = {
    db: mockDb,
    doc: mockDoc,
    getDoc: mockGetDoc,
    collection: mockCollection,
    query: mockQuery,
    where: mockWhere,
    getDocs: mockGetDocs,
  };

  const repository = new FirestoreCentroEstudiosRepository(deps, mockProgreso);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when tenantId is missing', async () => {
    const result = await repository.obtenerAsignaciones({ tenantId: '', estudianteId: 'est1' });
    expect(result.asignaciones).toEqual([]);
  });

  it('returns empty array when estudiante does not exist', async () => {
    mockDoc.mockReturnValue({});
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await repository.obtenerAsignaciones({ tenantId: 't1', estudianteId: 'est1' });
    expect(result.asignaciones).toEqual([]);
    expect(mockGetDoc).toHaveBeenCalled();
  });

  it('filters assignments by tenantId, estado "publicada" and aplicaAlEstudiante', async () => {
    // Mock estudiante document
    mockDoc.mockReturnValue({});
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Juan' }) });

    // Mock collection and query chain
    const fakeCollectionRef = {};
    mockCollection.mockReturnValue(fakeCollectionRef);
    const fakeQueryRef = {};
    mockQuery.mockReturnValue(fakeQueryRef);
    mockWhere.mockImplementation((_, __, ___) => fakeQueryRef);

    // Mock assignments documents
    const docs = [
      { id: 'asig1', data: () => ({ tenantId: 't1', estado: 'publicada', destinatario: 'dest1' }) },
      { id: 'asig2', data: () => ({ tenantId: 't1', estado: 'borrador', destinatario: 'dest2' }) },
    ];
    mockGetDocs.mockResolvedValue({ docs });

    // Mock aplicaAlEstudiante: only first assignment passes
    (aplicaAlEstudiante as jest.Mock).mockImplementation((asig, estudiante) => asig.id === 'asig1');

    const result = await repository.obtenerAsignaciones({ tenantId: 't1', estudianteId: 'est1' });
    expect(result.asignaciones).toHaveLength(1);
    expect(result.asignaciones[0].id).toBe('asig1');
    // Ensure query was built with correct where clause
    expect(mockWhere).toHaveBeenCalledWith('estado', '==', 'publicada');
  });
});
