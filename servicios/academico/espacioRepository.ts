import {
  collection,
  getDocs,
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
// ALCANCE DELIBERADO: solo lectura. NO expone create/update/delete: la administracion de
// espacios (CRUD real, persistencia de `espacioService.ts`, `EspaciosView.tsx`) es un
// problema del modulo Centro de Estudios, fuera del alcance de 12.7. Hoy ninguna UI persiste
// espacios, asi que para un tenant sin espacios cargados este repositorio devuelve `[]`
// (lista vacia) — el consumidor debe tratar la lista vacia como caso valido, no como error.

interface EspacioRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  getDocs?: (queryRef: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
}

export interface EspacioRepository {
  listarEspaciosPorTenant(tenantId: string): Promise<EspacioFisico[]>;
}

export interface CrearEspacioRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: EspacioRepositoryDeps;
}

// Store en memoria para el modo demo/mock (isFirebaseConfigured === false), coherente con el
// patron de `programaRepository`/`jornadaRepository`. Como este repositorio es de solo
// lectura, no hay un `guardar*` que lo pueble desde produccion; `seedMockEspacios` existe
// para que los tests (y un eventual seeding de demo) puedan cargar datos en esta rama.
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
  const deps: EspacioRepositoryDeps = options.deps || { collection, getDocs };

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
  };
}

export const espacioRepository = crearEspacioRepository();
