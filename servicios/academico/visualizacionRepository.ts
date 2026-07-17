// servicios/academico/visualizacionRepository.ts
// Tracking de visualización real de video de YouTube (IFrame Player API).
//
// Contexto: Tudojang decidió (análisis de costos, 2026-07) dejar de servir video de clase
// vía el proxy `proxyDriveMedia` (functions/academico/drive.js) -- ese proxy no tiene
// Cache-Control/ETag, así que cada reproducción redescarga el archivo completo de Drive,
// y no da visibilidad real de si el alumno miró el video. Para VIDEO (los PDF siguen
// igual, con Drive) se reemplaza por YouTube real (costo $0 de hosting) + eventos reales
// de reproducción vía la IFrame API, registrados acá.
//
// Estructura elegida: tenants/{tenantId}/visualizaciones/{recursoId}/alumnos/{estudianteId}
// (recurso -> alumno), DISTINTA de progresoRepository.ts (alumno -> asignación), porque el
// reporte de staff (components/academico/ReporteVisualizacionVideo.tsx) necesita listar
// TODOS los alumnos que vieron un recurso puntual sin una collectionGroup query.

export interface VisualizacionVideo {
  tenantId: string;
  recursoId: string;
  estudianteId: string;
  estudianteNombre?: string;
  /** Timestamp ISO de la primera reproducción registrada. Se fija una sola vez. */
  primeraReproduccion: string;
  ultimaPosicionSegundos: number;
  duracionSegundos: number;
  /** 0-100 */
  porcentajeVisto: number;
  /** true si porcentajeVisto >= UMBRAL_PORCENTAJE_COMPLETADO en algún momento. */
  completado: boolean;
  vecesIniciado: number;
  actualizadoEn: string;
}

export interface VisualizacionSyncInput {
  estudianteNombre?: string;
  posicionSegundos: number;
  duracionSegundos: number;
  /** true si este flush corresponde a una reproducción recién iniciada (incrementa vecesIniciado). */
  nuevoInicio?: boolean;
}

/** Porcentaje mínimo visto para considerar el video "completado" en el reporte de staff. */
export const UMBRAL_PORCENTAJE_COMPLETADO = 90;

export function calcularPorcentajeVisto(posicionSegundos: number, duracionSegundos: number): number {
  if (!Number.isFinite(duracionSegundos) || duracionSegundos <= 0) return 0;
  if (!Number.isFinite(posicionSegundos) || posicionSegundos <= 0) return 0;
  return Math.min(100, Math.round((posicionSegundos / duracionSegundos) * 100));
}

export function esVideoCompletado(porcentajeVisto: number): boolean {
  return porcentajeVisto >= UMBRAL_PORCENTAJE_COMPLETADO;
}

function fusionarVisualizacion(
  actual: VisualizacionVideo | null,
  tenantId: string,
  recursoId: string,
  estudianteId: string,
  input: VisualizacionSyncInput,
): VisualizacionVideo {
  const ahora = new Date().toISOString();
  const porcentajeVisto = Math.max(
    calcularPorcentajeVisto(input.posicionSegundos, input.duracionSegundos),
    actual?.porcentajeVisto ?? 0,
  );

  return {
    tenantId,
    recursoId,
    estudianteId,
    estudianteNombre: input.estudianteNombre ?? actual?.estudianteNombre,
    primeraReproduccion: actual?.primeraReproduccion ?? ahora,
    ultimaPosicionSegundos: Math.max(0, Math.round(input.posicionSegundos)),
    duracionSegundos: Math.max(0, Math.round(input.duracionSegundos)) || (actual?.duracionSegundos ?? 0),
    porcentajeVisto,
    completado: Boolean(actual?.completado) || esVideoCompletado(porcentajeVisto),
    vecesIniciado: (actual?.vecesIniciado ?? 0) + (input.nuevoInicio ? 1 : 0),
    actualizadoEn: ahora,
  };
}

export interface VisualizacionRepository {
  leer(tenantId: string, recursoId: string, estudianteId: string): Promise<VisualizacionVideo | null>;
  listarPorRecurso(tenantId: string, recursoId: string): Promise<VisualizacionVideo[]>;
  registrarSync(
    tenantId: string,
    recursoId: string,
    estudianteId: string,
    input: VisualizacionSyncInput,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementación Firestore (producción)
// ---------------------------------------------------------------------------

export interface VisualizacionRepositoryDeps {
  db: unknown;
  doc: (...segments: any[]) => unknown;
  getDoc: (reference: unknown) => Promise<{ exists: () => boolean; data: () => unknown }>;
  setDoc: (reference: unknown, data: unknown, options: { merge: boolean }) => Promise<void>;
  collection: (...segments: any[]) => unknown;
  getDocs: (coleccion: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
}

export class FirestoreVisualizacionRepository implements VisualizacionRepository {
  constructor(private readonly deps: VisualizacionRepositoryDeps) {}

  private referencia(tenantId: string, recursoId: string, estudianteId: string): unknown {
    return this.deps.doc(
      this.deps.db,
      'tenants',
      tenantId,
      'visualizaciones',
      recursoId,
      'alumnos',
      estudianteId,
    );
  }

  async leer(tenantId: string, recursoId: string, estudianteId: string): Promise<VisualizacionVideo | null> {
    const snap = await this.deps.getDoc(this.referencia(tenantId, recursoId, estudianteId));
    if (!snap.exists()) return null;
    return snap.data() as VisualizacionVideo;
  }

  async listarPorRecurso(tenantId: string, recursoId: string): Promise<VisualizacionVideo[]> {
    const coleccion = this.deps.collection(this.deps.db, 'tenants', tenantId, 'visualizaciones', recursoId, 'alumnos');
    const snap = await this.deps.getDocs(coleccion);
    return snap.docs.map((item) => item.data() as VisualizacionVideo);
  }

  async registrarSync(
    tenantId: string,
    recursoId: string,
    estudianteId: string,
    input: VisualizacionSyncInput,
  ): Promise<void> {
    const actual = await this.leer(tenantId, recursoId, estudianteId);
    const siguiente = fusionarVisualizacion(actual, tenantId, recursoId, estudianteId, input);
    await this.deps.setDoc(this.referencia(tenantId, recursoId, estudianteId), siguiente, { merge: true });
  }
}

// ---------------------------------------------------------------------------
// Implementación local (localStorage) -- Cypress/tests, igual que ProgresoLocalRepository
// en progresoRepository.ts.
// ---------------------------------------------------------------------------

function claveLocal(tenantId: string, recursoId: string, estudianteId: string): string {
  return `tudojang:centro-estudios:visualizacion:${tenantId}:${recursoId}:${estudianteId}`;
}

export class VisualizacionLocalRepository implements VisualizacionRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  async leer(tenantId: string, recursoId: string, estudianteId: string): Promise<VisualizacionVideo | null> {
    const raw = this.storage.getItem(claveLocal(tenantId, recursoId, estudianteId));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as VisualizacionVideo;
    } catch {
      return null;
    }
  }

  async listarPorRecurso(tenantId: string, recursoId: string): Promise<VisualizacionVideo[]> {
    const prefijo = `tudojang:centro-estudios:visualizacion:${tenantId}:${recursoId}:`;
    const resultado: VisualizacionVideo[] = [];

    for (let i = 0; i < this.storage.length; i += 1) {
      const clave = this.storage.key(i);
      if (!clave || !clave.startsWith(prefijo)) continue;

      const raw = this.storage.getItem(clave);
      if (!raw) continue;

      try {
        resultado.push(JSON.parse(raw) as VisualizacionVideo);
      } catch {
        // Ignorar entradas corruptas.
      }
    }

    return resultado;
  }

  async registrarSync(
    tenantId: string,
    recursoId: string,
    estudianteId: string,
    input: VisualizacionSyncInput,
  ): Promise<void> {
    const actual = await this.leer(tenantId, recursoId, estudianteId);
    const siguiente = fusionarVisualizacion(actual, tenantId, recursoId, estudianteId, input);
    this.storage.setItem(claveLocal(tenantId, recursoId, estudianteId), JSON.stringify(siguiente));
  }
}

export type VisualizacionRepositoryModo = 'local' | 'firestore';

export interface CrearVisualizacionRepositoryOptions {
  modo?: VisualizacionRepositoryModo;
  storage?: Storage;
  firestoreDeps?: VisualizacionRepositoryDeps;
}

export function crearVisualizacionRepository(
  options: CrearVisualizacionRepositoryOptions = {},
): VisualizacionRepository {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (win?.Cypress) {
    return new VisualizacionLocalRepository(options.storage);
  }

  if (options.modo === 'firestore' && options.firestoreDeps) {
    return new FirestoreVisualizacionRepository(options.firestoreDeps);
  }

  return new VisualizacionLocalRepository(options.storage);
}

export const visualizacionRepository: VisualizacionRepository = new VisualizacionLocalRepository();
