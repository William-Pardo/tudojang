import {
  collection,
  doc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { EspacioFisico } from '../../models/academico/espacio';

// Subtarea 12.7 (Parte 3): repositorio de SOLO LECTURA de espacios fisicos por tenant.
// Contexto: `jornadaContextService.ts` devolvia un unico espacio hardcodeado
// (`{ id: 'tatami-1', nombre: 'Tatami principal' }`) sin importar tenant ni sede. Las
// reglas de Firestore YA tienen provisionada la coleccion
// `tenants/{tenantId}/espacios/{espacioId}` (read: authenticated + mismo tenant; write:
// isAdmin + mismo tenant), pero no existia ningun repositorio que la leyera. Este archivo
// cubre exactamente ese hueco: leer los espacios reales del tenant para poblar el selector
// de espacio de la Agenda (JornadasView / PestanaProgramaJornada).
//
// ALCANCE (actualizado en cierre Centro de Estudios): lectura (listarEspaciosPorTenant) +
// escritura mínima (guardarEspacio: create/update por id, setDoc merge). El CRUD completo
// (activar/desactivar, conflictos de reserva reales) sigue fuera de alcance. Antes este repo
// era solo lectura y EspaciosView.tsx guardaba en memoria local: el selector de la Agenda
// siempre recibia `[]` (DT-0007). guardarEspacio soldó ese lado del caño. Para un tenant sin
// espacios cargados listarEspaciosPorTenant devuelve `[]` (lista vacia) — el consumidor debe
// tratar la lista vacia como caso valido, no como error. La write rule de Firestore para
// `tenants/{tenantId}/espacios/{espacioId}` exige isAdmin + mismo tenant (gating en la UI).

interface EspacioRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  // Ver nota en progresoRepository.ts: parametros en `any` por contravarianza.
  getDocs?: (queryRef: any) => Promise<{ docs: Array<{ id: string; data: () => any }> }>;
  doc?: (...path: any[]) => unknown;
  setDoc?: (ref: any, data: any, options?: any) => Promise<void>;
}

export interface EspacioRepository {
  listarEspaciosPorTenant(tenantId: string): Promise<EspacioFisico[]>;
  guardarEspacio(espacio: EspacioFisico): Promise<void>;
}

export interface CrearEspacioRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: EspacioRepositoryDeps;
}

// Store en memoria para el modo demo/mock (isFirebaseConfigured === false), coherente con el
// patron de `programaRepository`/`jornadaRepository`. `guardarEspacio` puebla este store en la
// rama mock; `seedMockEspacios` existe para que los tests (y un eventual seeding de demo)
// puedan cargar datos directamente.
let mockEspacios: EspacioFisico[] = [];

export const clearMockEspacios = () => {
  mockEspacios = [];
};

export const seedMockEspacios = (espacios: EspacioFisico[]) => {
  mockEspacios = [...espacios];
};

export const getMockEspacios = () => mockEspacios;

export function crearEspacioRepository(options: CrearEspacioRepositoryOptions = {}): EspacioRepository {
  const checkConfigured = () => (
    typeof window !== 'undefined' && (window as any).Cypress
      ? false
      :
    options.isFirebaseConfigured !== undefined
      ? options.isFirebaseConfigured
      : isFirebaseConfigured
  );
  const getDatabase = () => options.db || db;
  const deps: EspacioRepositoryDeps = options.deps || { collection, doc, getDocs, setDoc };

  return {
    async listarEspaciosPorTenant(tenantId) {
      if (!checkConfigured()) {
        return mockEspacios.filter((espacio) => espacio.tenantId === tenantId);
      }

      if (!deps.collection || !deps.getDocs) return [];

      const espaciosRef = deps.collection(getDatabase(), 'tenants', tenantId, 'espacios');
      const snap = await deps.getDocs(espaciosRef);

      return snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) } as EspacioFisico));
    },

    async guardarEspacio(espacio) {
      // Upsert por id. Mismo patron que guardarJornada: doc + setDoc({ merge: true }).
      if (!checkConfigured()) {
        const indice = mockEspacios.findIndex((item) => item.id === espacio.id);
        if (indice >= 0) {
          mockEspacios[indice] = espacio;
        } else {
          mockEspacios.push(espacio);
        }
        return;
      }

      if (!deps.doc || !deps.setDoc) return;

      const ref = deps.doc(getDatabase(), 'tenants', espacio.tenantId, 'espacios', espacio.id);
      await deps.setDoc(ref, espacio, { merge: true });
    },
  };
}

export const espacioRepository = crearEspacioRepository();
