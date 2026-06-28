# Registro 7.3 — cierre de jornada

- [x] 7.3 Crear servicio base `closeJornada`: valida asistencia y objetivos, cierra jornada, llama a `advanceCiclo` del programa y soporta cierre parcial.

## Archivos

- `servicios/academico/closeJornada.ts`
- `servicios/academico/closeJornada.test.ts`

## Evidencia RED

- `npm run test:app -- servicios/academico/closeJornada.test.ts` fallo inicialmente porque `closeJornada` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- servicios/academico/closeJornada.test.ts` con 3/3 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Cierre completo de jornada y avance del ciclo.
- Cierre parcial con `refuerzoRequerido`.
- Rechazo de cierre sin asistencia.

## Nota de alcance

Se implemento como servicio puro reutilizable por Cloud Function.
La publicacion automatica de asignaciones de refuerzo queda para el bloque de asignaciones `8.x`.
