import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import type { ProgresoLocalSync } from '../../hooks/academico/useProgressSync';
import {
  aplicarProgresoQuizLocal,
  guardarProgresoQuizLocal,
  leerProgresoQuizLocal,
  type ProgresoQuizLocal,
} from '../../utils/academico/progresoLocal';

export interface ProgresoRepository {
  leerQuiz(tenantId: string, asignacionId: string): ProgresoQuizLocal | null;
  guardarQuiz(progreso: ProgresoQuizLocal): void;
  leerSync(tenantId: string, asignacionId: string): ProgresoLocalSync | null;
  guardarSync(tenantId: string, asignacionId: string, progreso: ProgresoLocalSync): void;
  aplicarAAsignaciones(asignaciones: AsignacionCentroEstudios[]): AsignacionCentroEstudios[];
}

function crearClaveProgressSync(tenantId: string, asignacionId: string): string {
  return `tudojang:centro-estudios:progress-sync:${tenantId}:${asignacionId}`;
}

function normalizarProgresoSync(progreso: Partial<ProgresoLocalSync> | null | undefined): ProgresoLocalSync {
  return {
    paginasVistas: Array.from(new Set(progreso?.paginasVistas ?? [])).sort((a, b) => a - b),
    segundosUnicos: Array.from(new Set(progreso?.segundosUnicos ?? [])).sort((a, b) => a - b),
  };
}

export class ProgresoLocalRepository implements ProgresoRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  leerQuiz(tenantId: string, asignacionId: string): ProgresoQuizLocal | null {
    return leerProgresoQuizLocal(tenantId, asignacionId, this.storage);
  }

  guardarQuiz(progreso: ProgresoQuizLocal): void {
    guardarProgresoQuizLocal(progreso, this.storage);
  }

  leerSync(tenantId: string, asignacionId: string): ProgresoLocalSync | null {
    const raw = this.storage.getItem(crearClaveProgressSync(tenantId, asignacionId));
    if (!raw) return null;

    try {
      return normalizarProgresoSync(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  guardarSync(tenantId: string, asignacionId: string, progreso: ProgresoLocalSync): void {
    this.storage.setItem(
      crearClaveProgressSync(tenantId, asignacionId),
      JSON.stringify(normalizarProgresoSync(progreso))
    );
  }

  aplicarAAsignaciones(asignaciones: AsignacionCentroEstudios[]): AsignacionCentroEstudios[] {
    return aplicarProgresoQuizLocal(asignaciones, this.storage);
  }
}

export interface FirestoreProgressRepositoryDeps {
  db: unknown;
  estudianteId: string;
  doc: (...segments: any[]) => unknown;
  // Fix 2026-07-21 (`npm run typecheck`): los parametros van en `any`, no en `unknown`.
  // Bajo `strictFunctionTypes` los parametros son CONTRAVARIANTES: una funcion que espera
  // `DocumentReference` (la real del SDK) NO es asignable a una declarada como
  // `(reference: unknown)`. Con `unknown` estas deps solo aceptaban fakes, nunca el SDK
  // real -- justo al reves de lo que se buscaba. `any` acepta ambos.
  getDoc: (reference: any) => Promise<{ exists: () => boolean; data: () => any }>;
  setDoc: (reference: any, data: any, options: { merge: boolean }) => Promise<void>;
}

export class FirestoreProgressRepository {
  constructor(private readonly deps: FirestoreProgressRepositoryDeps) {}

  async leerQuiz(tenantId: string, asignacionId: string): Promise<ProgresoQuizLocal | null> {
    const snap = await this.deps.getDoc(this.crearReferencia(tenantId, asignacionId));
    if (!snap.exists()) return null;

    const progreso = snap.data() as ProgresoQuizLocal;
    if (progreso.tenantId !== tenantId || progreso.asignacionId !== asignacionId) return null;

    return progreso;
  }

  async guardarQuiz(progreso: ProgresoQuizLocal): Promise<void> {
    await this.deps.setDoc(
      this.crearReferencia(progreso.tenantId, progreso.asignacionId),
      progreso,
      { merge: true }
    );
  }

  async leerSync(tenantId: string, asignacionId: string): Promise<ProgresoLocalSync | null> {
    const snap = await this.deps.getDoc(this.crearReferencia(tenantId, asignacionId));
    if (!snap.exists()) return null;

    const data = snap.data() as Partial<ProgresoLocalSync> & { tenantId?: string; asignacionId?: string };
    if (data.tenantId !== tenantId || data.asignacionId !== asignacionId) return null;

    return normalizarProgresoSync(data);
  }

  async guardarSync(tenantId: string, asignacionId: string, progreso: ProgresoLocalSync): Promise<void> {
    await this.deps.setDoc(
      this.crearReferencia(tenantId, asignacionId),
      {
        tenantId,
        asignacionId,
        ...normalizarProgresoSync(progreso),
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  private crearReferencia(tenantId: string, asignacionId: string): unknown {
    return this.deps.doc(
      this.deps.db,
      'tenants',
      tenantId,
      'progreso',
      this.deps.estudianteId,
      'asignaciones',
      asignacionId
    );
  }
}

export type ProgresoRepositoryModo = 'local' | 'firestore';

export interface CrearProgresoRepositoryOptions {
  modo?: ProgresoRepositoryModo;
  estudianteId?: string | null;
  storage?: Storage;
  firestoreDeps?: Omit<FirestoreProgressRepositoryDeps, 'estudianteId'>;
}

export function crearProgresoRepository(options: CrearProgresoRepositoryOptions = {}): ProgresoRepository | FirestoreProgressRepository {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (win?.Cypress) {
    return new ProgresoLocalRepository(options.storage);
  }

  if (options.modo === 'firestore' && options.estudianteId && options.firestoreDeps) {
    return new FirestoreProgressRepository({
      ...options.firestoreDeps,
      estudianteId: options.estudianteId,
    });
  }

  return new ProgresoLocalRepository(options.storage);
}

export const progresoRepository: ProgresoRepository = new ProgresoLocalRepository();
