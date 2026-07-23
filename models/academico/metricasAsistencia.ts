/**
 * Métricas de ASISTENCIA FÍSICA acumuladas por estudiante (WS-2, `Módulo Clase en Vivo.txt`
 * §7/§11: "acumular horas reales de entrenamiento").
 *
 * Persistido en `tenants/{tenantId}/metricasAsistencia/{estudianteId}`.
 * Escrito exclusivamente server-side por el callable `registrarAsistenciaJornada` al hacer
 * check-out (Admin SDK). Es un ACUMULADO DERIVADO de los `RegistroAsistencia` con check-out
 * completo: si se corrompe, puede reconstruirse recorriendo las asistencias.
 *
 * A propósito NO reusa `Estudiante.horasAcumuladasGrado` (que consume la generación de
 * certificados y hoy es un valor manual): son dos cosas distintas — "horas de grado" vs
 * "horas reales de clase en vivo" — y mezclarlas rompería los certificados.
 */
export interface MetricasAsistencia {
  estudianteId: string;
  tenantId: string;
  /** Suma de `minutosAsistidos` de todas las clases con check-out completo. */
  minutosTotales: number;
  /** Cantidad de clases con entrada + salida registradas. */
  clasesAsistidas: number;
  /** ISO de la última acumulación. */
  actualizadoEn: string;
}
