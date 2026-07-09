import type {
  AsignacionCentroEstudios,
  ObtenerAsignacionesRequest,
  ObtenerAsignacionesResponse,
} from '../../models/academico/asignacionService.types';
import { ordenarAsignacionesPorUrgencia } from '../../utils/academico/centroEstudios.ts';
import { obtenerAsignacionesPorEstudiante, aplicaAlEstudiante } from './asignacionService';
import { progresoRepository, type ProgresoRepository, type FirestoreProgressRepository } from './progresoRepository';

import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';


export const obtenerAsignaciones = async (request: any) => {
  // RED stub: force error when tenantId is provided
  if (request.tenantId) {
    throw new Error('Filtro de tenantId requerido');
  }
  // Delegate to the repository implementation for other cases
  return centroEstudiosRepository.obtenerAsignaciones(request);
};

export interface CentroEstudiosRepository {
  obtenerAsignaciones(request: ObtenerAsignacionesRequest): Promise<ObtenerAsignacionesResponse>;
}

export class CentroEstudiosDemoRepository implements CentroEstudiosRepository {
  async obtenerAsignaciones(request: ObtenerAsignacionesRequest): Promise<ObtenerAsignacionesResponse> {
    const respuesta = await obtenerAsignacionesPorEstudiante(request);
    return {
      asignaciones: prepararAsignacionesCentroEstudios(respuesta.asignaciones),
    };
  }
}

export interface FirestoreCentroEstudiosRepositoryDeps {
  db: any;
  doc: (...segments: any[]) => any;
  getDoc: (reference: any) => Promise<{ exists: () => boolean; data: () => any }>;
  collection: (...segments: any[]) => any;
  query: (...args: any[]) => any;
  where: (field: string, op: string, value: any) => any;
  getDocs: (query: any) => Promise<{ docs: Array<{ id: string; data: () => any }> }>;
}

export class FirestoreCentroEstudiosRepository implements CentroEstudiosRepository {
  constructor(
    private readonly deps: FirestoreCentroEstudiosRepositoryDeps,
    private readonly progreso: ProgresoRepository | FirestoreProgressRepository = progresoRepository
  ) {}

  async obtenerAsignaciones(request: ObtenerAsignacionesRequest): Promise<ObtenerAsignacionesResponse> {
    const { tenantId, estudianteId } = request;
    if (!tenantId || !estudianteId) {
      return { asignaciones: [] };
    }

    try {
      let estudianteData: any = null;
      let estudianteDocId: string = estudianteId;

      // 1. Intentar búsqueda directa por UID
      const estudianteRef = this.deps.doc(this.deps.db, 'estudiantes', estudianteId);
      const estudianteSnap = await this.deps.getDoc(estudianteRef);

      if (estudianteSnap.exists()) {
        estudianteData = estudianteSnap.data();
      } else {
        // 2. Fallback: Obtener el correo del usuario logueado
        const usuarioRef = this.deps.doc(this.deps.db, 'usuarios', estudianteId);
        const usuarioSnap = await this.deps.getDoc(usuarioRef);

        if (usuarioSnap.exists()) {
          const usuarioData = usuarioSnap.data();
          const email = usuarioData.email?.toLowerCase().trim();

          if (email) {
            // 3. Buscar en /estudiantes por correo electrónico
            const estudiantesRef = this.deps.collection(this.deps.db, 'estudiantes');
            const q = this.deps.query(
              estudiantesRef,
              this.deps.where('tenantId', '==', tenantId),
              this.deps.where('correo', '==', email)
            );
            const querySnap = await this.deps.getDocs(q);

            if (!querySnap.empty) {
              estudianteData = querySnap.docs[0].data();
              estudianteDocId = querySnap.docs[0].id;
            }
          }
        }
      }

      if (!estudianteData) {
        return { asignaciones: [] };
      }

      const estudiante = {
        id: estudianteDocId,
        ...estudianteData,
      };

      const asignacionesRef = this.deps.collection(this.deps.db, 'tenants', tenantId, 'asignaciones');
      const q = this.deps.query(asignacionesRef, this.deps.where('estado', '==', 'publicada'));
      const snap = await this.deps.getDocs(q);

      const asignacionesValidas: AsignacionCentroEstudios[] = [];
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const asignacion = {
          id: docSnap.id,
          ...data,
        } as AsignacionCentroEstudios;

        if (aplicaAlEstudiante(asignacion, estudiante)) {
          asignacionesValidas.push(asignacion);
        }
      }

      return {
        asignaciones: prepararAsignacionesCentroEstudios(asignacionesValidas, this.progreso),
      };
    } catch (error) {
      console.error('Error al obtener asignaciones de Firestore:', error);
      return { asignaciones: [] };
    }
  }
}

export type CentroEstudiosRepositoryModo = 'demo' | 'firestore';

export interface CrearCentroEstudiosRepositoryOptions {
  modo?: CentroEstudiosRepositoryModo;
  firestoreDeps?: FirestoreCentroEstudiosRepositoryDeps;
  progresoRepository?: ProgresoRepository | FirestoreProgressRepository;
}

export function crearCentroEstudiosRepository(
  options: CrearCentroEstudiosRepositoryOptions = {}
): CentroEstudiosRepository {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (win?.Cypress && Array.isArray(win.__CENTRO_ESTUDIOS_ASIGNACIONES__)) {
    return new CentroEstudiosDemoRepository();
  }

  if (options.modo === 'firestore' && options.firestoreDeps) {
    return new FirestoreCentroEstudiosRepository(
      options.firestoreDeps,
      options.progresoRepository
    );
  }
  return new CentroEstudiosDemoRepository();
}

export function prepararAsignacionesCentroEstudios(
  asignaciones: AsignacionCentroEstudios[],
  progreso: ProgresoRepository | FirestoreProgressRepository = progresoRepository
): AsignacionCentroEstudios[] {
  if ('aplicarAAsignaciones' in progreso) {
    return ordenarAsignacionesPorUrgencia(progreso.aplicarAAsignaciones(asignaciones));
  }
  return ordenarAsignacionesPorUrgencia(asignaciones);
}

export const centroEstudiosRepository: CentroEstudiosRepository = crearCentroEstudiosRepository({
  modo: (typeof isFirebaseConfigured !== 'undefined' && isFirebaseConfigured) ? 'firestore' : 'demo',
  firestoreDeps: {
    db,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
  }
});
