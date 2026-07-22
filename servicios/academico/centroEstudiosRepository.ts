import type {
  AsignacionCentroEstudios,
  ObtenerAsignacionesRequest,
  ObtenerAsignacionesResponse,
} from '../../models/academico/asignacionService.types';
import { ordenarAsignacionesPorUrgencia, calcularUrgenciaAsignacion } from '../../utils/academico/centroEstudios.ts';
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
  // Fix 2026-07-21 (`npm run typecheck`): `op` estaba tipado como `string`, pero el `where`
  // real del SDK lo declara como el union `WhereFilterOp` -- `string` no es asignable a un
  // union de literales, asi que la dep nunca aceptaba la funcion real.
  where: (field: string, op: any, value: any) => any;
  // Fix 2026-07-21: faltaba `empty` en el contrato, y sin embargo la linea 87 de este mismo
  // archivo lo usa (`if (!querySnap.empty)`). El tipo mentia sobre lo que el codigo exige.
  getDocs: (query: any) => Promise<{ empty: boolean; docs: Array<{ id: string; data: () => any }> }>;
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
        const data = docSnap.data() as Partial<AsignacionCentroEstudios>;
        // Fix (bug reportado: abrir un material real crasheaba MaterialPreviewModal con
        // "Cannot read properties of undefined (reading 'replace')"): un doc real de
        // `asignaciones` es un AsignacionAcademica -- NUNCA tiene estadoProgreso/
        // porcentajeProgreso/urgencia (son específicos de AsignacionCentroEstudios,
        // calculados). Antes de este fix quedaban `undefined` para cualquier asignación
        // real (solo el fixture demo los traía hardcodeados), y este era el primer
        // camino que llegaba a renderizar una asignación real end-to-end.
        const asignacion = {
          id: docSnap.id,
          ...data,
          estadoProgreso: data.estadoProgreso ?? 'disponible',
          porcentajeProgreso: data.porcentajeProgreso ?? 0,
          urgencia: calcularUrgenciaAsignacion(data.fechaCierre),
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
