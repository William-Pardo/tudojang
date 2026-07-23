/**
 * Registro de asistencia por estudiante sobre una `JornadaInstruccion`.
 *
 * Persistido en `tenants/{tenantId}/jornadas/{jornadaId}/asistencias/{estudianteId}`,
 * con `estudianteId` como doc-id nativo (mismo patrón que `inscripcion.ts`).
 * Escrito exclusivamente server-side por el callable `registrarAsistenciaJornada`
 * (Admin SDK, ver `firestore.rules`: `allow write: if false` en esta subcolección).
 *
 * El callable hace toggle: 1er escaneo = check-in (`horaEntrada`), 2do = check-out
 * (`horaSalida` + `minutosAsistidos`), 3ro se rechaza (ver `design.md`, Decisión 2).
 *
 * Auditoría y puntualidad (WS-1, `Módulo Clase en Vivo.txt` §6/§7/§12): quién escaneó y si el
 * estudiante llegó tarde. Opcionales porque los registros creados ANTES de WS-1 no los tienen;
 * el callable siempre los escribe en los registros nuevos.
 */
export interface RegistroAsistencia {
  estudianteId: string;
  horaEntrada: string;
  horaSalida?: string;
  minutosAsistidos?: number;
  /** UID del usuario (maestro/admin) que registró el check-in. */
  checkedInBy?: string;
  /** UID del usuario que registró el check-out. */
  checkedOutBy?: string;
  /** `true` si el check-in fue después de `horaInicio` de la jornada. */
  isLate?: boolean;
  /** Minutos de retraso respecto de `horaInicio` (0 si llegó a tiempo o antes). */
  minutesLate?: number;
}
