/**
 * Roster explícito de matrícula por `EjecucionPrograma`.
 *
 * Nombre deliberadamente distinto de `InscripcionPrograma` (`tipos.ts:196`,
 * modelo legacy sin relación con `ProgramaAcademico`/`EjecucionPrograma`) para
 * no confundir ambos espacios de IDs (ver `design.md`, Decisión 5).
 *
 * Persistido en `tenants/{tenantId}/ejecucionesPrograma/{ejecucionProgramaId}/inscripciones/{estudianteId}`,
 * con `estudianteId` como doc-id nativo (evita duplicados sin índice extra).
 */
export type EstadoInscripcionEjecucionPrograma = 'activa' | 'retirada';

export interface InscripcionEjecucionPrograma {
  estudianteId: string;
  ejecucionProgramaId: string;
  tenantId: string;
  estado: EstadoInscripcionEjecucionPrograma;
  fechaInscripcion: string;
  inscritoPorUid: string;
}
