import type { RegistroAsistencia } from '../../models/academico/asistencia';

/**
 * Funciones puras sobre `RegistroAsistencia[]` (subcolección `asistencias` de una
 * `JornadaInstruccion`, escrita server-side por `registrarAsistenciaJornada`, Fase 1).
 * Consumidas por `JornadasView.cerrar()` (Fase 2) para derivar `asistenciaRegistrada`
 * a partir de check-ins reales en vez de un checkbox manual (design.md, Data Flow).
 */

// Cada documento de la subcoleccion representa un check-in (con o sin check-out todavia),
// asi que la cuenta de check-ins es simplemente la cantidad de registros existentes.
export function contarCheckIns(asistencias: RegistroAsistencia[]): number {
  return asistencias.length;
}

// Solo los registros que ya completaron check-out tienen `minutosAsistidos` calculado
// (functions/academico/asistencia.js, rama salida); los que siguen `en_curso` no aportan.
export function calcularMinutosAsistidos(asistencias: RegistroAsistencia[]): number {
  return asistencias.reduce((total, registro) => total + (registro.minutosAsistidos ?? 0), 0);
}
