import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';

interface InscripcionRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  doc: (...path: any[]) => unknown;
  // Ver nota en progresoRepository.ts: parametros en `any` por contravarianza.
  deleteDoc?: (ref: any) => Promise<void>;
  getDoc?: (ref: any) => Promise<{ exists: () => boolean; data?: () => any }>;
  getDocs?: (queryRef: any) => Promise<{ docs: Array<{ id: string; data: () => any }> }>;
  setDoc: (ref: any, data: any, options?: any) => Promise<void>;
}

export interface InscripcionRepository {
  matricular(inscripcion: InscripcionEjecucionPrograma): Promise<void>;
  retirar(tenantId: string, ejecucionProgramaId: string, estudianteId: string): Promise<void>;
  listarPorEjecucion(tenantId: string, ejecucionProgramaId: string): Promise<InscripcionEjecucionPrograma[]>;
  estaInscritoEnEjecucion(tenantId: string, ejecucionProgramaId: string, estudianteId: string): Promise<boolean>;
}

export interface CrearInscripcionRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: InscripcionRepositoryDeps;
}

let mockInscripciones: InscripcionEjecucionPrograma[] = [];

export const clearMockInscripciones = () => {
  mockInscripciones = [];
};

export const getMockInscripciones = () => mockInscripciones;

function mismaInscripcion(a: InscripcionEjecucionPrograma, b: { tenantId: string; ejecucionProgramaId: string; estudianteId: string }): boolean {
  return a.tenantId === b.tenantId
    && a.ejecucionProgramaId === b.ejecucionProgramaId
    && a.estudianteId === b.estudianteId;
}

function upsertInscripcion(items: InscripcionEjecucionPrograma[], value: InscripcionEjecucionPrograma): InscripcionEjecucionPrograma[] {
  const index = items.findIndex((item) => mismaInscripcion(item, value));
  if (index === -1) return [...items, value];
  return items.map((item, i) => (i === index ? value : item));
}

export function crearInscripcionRepository(options: CrearInscripcionRepositoryOptions = {}): InscripcionRepository {
  const checkConfigured = () => (
    typeof window !== 'undefined' && (window as any).Cypress
      ? false
      :
    options.isFirebaseConfigured !== undefined
      ? options.isFirebaseConfigured
      : isFirebaseConfigured
  );
  const getDatabase = () => options.db || db;
  const deps: InscripcionRepositoryDeps = options.deps || { collection, doc, deleteDoc, getDoc, getDocs, setDoc };

  return {
    async matricular(inscripcion) {
      if (!checkConfigured()) {
        mockInscripciones = upsertInscripcion(mockInscripciones, inscripcion);
        return;
      }

      const ref = deps.doc(
        getDatabase(),
        'tenants', inscripcion.tenantId,
        'ejecucionesPrograma', inscripcion.ejecucionProgramaId,
        'inscripciones', inscripcion.estudianteId,
      );
      await deps.setDoc(ref, inscripcion, { merge: true });
    },

    async retirar(tenantId, ejecucionProgramaId, estudianteId) {
      if (!checkConfigured()) {
        mockInscripciones = mockInscripciones.filter(
          (item) => !mismaInscripcion(item, { tenantId, ejecucionProgramaId, estudianteId }),
        );
        return;
      }

      if (!deps.deleteDoc) return;

      const ref = deps.doc(
        getDatabase(),
        'tenants', tenantId,
        'ejecucionesPrograma', ejecucionProgramaId,
        'inscripciones', estudianteId,
      );
      await deps.deleteDoc(ref);
    },

    async listarPorEjecucion(tenantId, ejecucionProgramaId) {
      if (!checkConfigured()) {
        return mockInscripciones.filter(
          (item) => item.tenantId === tenantId && item.ejecucionProgramaId === ejecucionProgramaId,
        );
      }

      if (!deps.collection || !deps.getDocs) return [];

      const inscripcionesRef = deps.collection(
        getDatabase(),
        'tenants', tenantId,
        'ejecucionesPrograma', ejecucionProgramaId,
        'inscripciones',
      );
      const snap = await deps.getDocs(inscripcionesRef);

      return snap.docs.map((item) => ({ ...(item.data() as object) } as InscripcionEjecucionPrograma));
    },

    async estaInscritoEnEjecucion(tenantId, ejecucionProgramaId, estudianteId) {
      if (!checkConfigured()) {
        return mockInscripciones.some(
          (item) => mismaInscripcion(item, { tenantId, ejecucionProgramaId, estudianteId }),
        );
      }

      if (!deps.getDoc) return false;

      const ref = deps.doc(
        getDatabase(),
        'tenants', tenantId,
        'ejecucionesPrograma', ejecucionProgramaId,
        'inscripciones', estudianteId,
      );
      const snap = await deps.getDoc(ref);
      return snap.exists();
    },
  };
}

export const inscripcionRepository = crearInscripcionRepository();
