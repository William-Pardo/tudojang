import {
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { RegistroAsistencia } from '../../models/academico/asistencia';

interface AsistenciaRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  getDocs?: (queryRef: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
}

// Repositorio de solo lectura: la subcolección `asistencias` se escribe
// exclusivamente server-side por el callable `registrarAsistenciaJornada`
// (Admin SDK, Fase 1, `firestore.rules`: `allow write: if false`). El cliente
// nunca escribe aquí directamente — solo lista check-ins ya registrados
// (patrón mock-cuando-no-configurado de `jornadaRepository.ts`, adaptado a
// un repositorio sin escritura de cliente).
export interface AsistenciaRepository {
  listarPorJornada(tenantId: string, jornadaId: string): Promise<RegistroAsistencia[]>;
}

export interface CrearAsistenciaRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: AsistenciaRepositoryDeps;
}

let mockAsistencias: Array<RegistroAsistencia & { tenantId: string; jornadaId: string }> = [];

export const clearMockAsistencias = () => {
  mockAsistencias = [];
};

export const getMockAsistencias = () => mockAsistencias;

// Helper de test: como el cliente nunca escribe esta subcolección, no hay un
// método `registrar()` en la interfaz pública para sembrar datos en el modo
// "Firebase no configurado". Este helper simula que el callable server-side
// ya registró check-ins, para poder testear el wiring de lectura (Fase 2)
// sin configurar Firebase/emulador.
export const seedMockAsistencias = (
  tenantId: string,
  jornadaId: string,
  registros: RegistroAsistencia[],
) => {
  mockAsistencias = [
    ...mockAsistencias.filter((item) => !(item.tenantId === tenantId && item.jornadaId === jornadaId)),
    ...registros.map((registro) => ({ ...registro, tenantId, jornadaId })),
  ];
};

export function crearAsistenciaRepository(options: CrearAsistenciaRepositoryOptions = {}): AsistenciaRepository {
  const checkConfigured = () => (
    typeof window !== 'undefined' && (window as any).Cypress
      ? false
      :
    options.isFirebaseConfigured !== undefined
      ? options.isFirebaseConfigured
      : isFirebaseConfigured
  );
  const getDatabase = () => options.db || db;
  const deps: AsistenciaRepositoryDeps = options.deps || ({ collection, getDocs } as unknown as AsistenciaRepositoryDeps);

  return {
    async listarPorJornada(tenantId, jornadaId) {
      if (!checkConfigured()) {
        return mockAsistencias
          .filter((item) => item.tenantId === tenantId && item.jornadaId === jornadaId)
          .map(({ tenantId: _tenantId, jornadaId: _jornadaId, ...registro }) => registro);
      }

      if (!deps.collection || !deps.getDocs) return [];

      const asistenciasRef = deps.collection(
        getDatabase(),
        'tenants', tenantId,
        'jornadas', jornadaId,
        'asistencias',
      );
      const snap = await deps.getDocs(asistenciasRef);

      return snap.docs.map((item) => ({ ...(item.data() as object) } as RegistroAsistencia));
    },
  };
}

export const asistenciaRepository = crearAsistenciaRepository();
