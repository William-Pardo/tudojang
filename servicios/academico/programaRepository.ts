import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { ProgramaAcademico } from '../../models/academico/programa';

interface ProgramaRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  doc: (...path: any[]) => unknown;
  deleteDoc?: (ref: unknown) => Promise<void>;
  getDocs?: (queryRef: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
  setDoc: (ref: unknown, data: unknown, options?: unknown) => Promise<void>;
}

export interface ProgramaRepository {
  guardarPrograma(programa: ProgramaAcademico): Promise<void>;
  listarProgramasPorTenant(tenantId: string): Promise<ProgramaAcademico[]>;
  eliminarPrograma(tenantId: string, programaId: string): Promise<void>;
}

export interface CrearProgramaRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: ProgramaRepositoryDeps;
}

let mockProgramas: ProgramaAcademico[] = [];

export const clearMockProgramas = () => {
  mockProgramas = [];
};

export const getMockProgramas = () => mockProgramas;

function upsertById<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index === -1) return [...items, value];
  return items.map((item) => (item.id === value.id ? value : item));
}

export function crearProgramaRepository(options: CrearProgramaRepositoryOptions = {}): ProgramaRepository {
  const checkConfigured = () => (
    typeof window !== 'undefined' && (window as any).Cypress
      ? false
      :
    options.isFirebaseConfigured !== undefined
      ? options.isFirebaseConfigured
      : isFirebaseConfigured
  );
  const getDatabase = () => options.db || db;
  const deps: ProgramaRepositoryDeps = options.deps || ({ collection, doc, deleteDoc, getDocs, setDoc } as unknown as ProgramaRepositoryDeps);

  return {
    async guardarPrograma(programa) {
      if (!checkConfigured()) {
        mockProgramas = upsertById(mockProgramas, programa);
        return;
      }

      const ref = deps.doc(getDatabase(), 'tenants', programa.tenantId, 'programasAcademicos', programa.id);
      await deps.setDoc(ref, programa, { merge: true });
    },

    async listarProgramasPorTenant(tenantId) {
      if (!checkConfigured()) {
        return mockProgramas.filter((programa) => programa.tenantId === tenantId);
      }

      if (!deps.collection || !deps.getDocs) return [];

      const programasRef = deps.collection(getDatabase(), 'tenants', tenantId, 'programasAcademicos');
      const snap = await deps.getDocs(programasRef);

      // El ID real del documento SIEMPRE debe ganar sobre cualquier campo `id` que pueda
      // venir dentro de la data guardada -- mismo bug real ya encontrado y corregido en
      // sedesApi.ts (2026-07-16): `...doc.data()` va ANTES de `id: doc.id`, no despues.
      return snap.docs.map((item) => ({ ...(item.data() as object), id: item.id } as ProgramaAcademico));
    },

    async eliminarPrograma(tenantId, programaId) {
      if (!checkConfigured()) {
        mockProgramas = mockProgramas.filter(
          (programa) => !(programa.id === programaId && programa.tenantId === tenantId),
        );
        return;
      }

      if (!deps.deleteDoc) return;

      const ref = deps.doc(getDatabase(), 'tenants', tenantId, 'programasAcademicos', programaId);
      await deps.deleteDoc(ref);
    },
  };
}

export const programaRepository = crearProgramaRepository();
