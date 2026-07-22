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
 */
export interface RegistroAsistencia {
  estudianteId: string;
  horaEntrada: string;
  horaSalida?: string;
  minutosAsistidos?: number;
}
