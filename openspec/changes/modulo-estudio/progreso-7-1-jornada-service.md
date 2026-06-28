# Registro 7.1 — jornada de instruccion y ciclo local

- [x] 7.1 Definir modelo `JornadaInstruccion` y `BloqueRecurrente`; crear `jornadaService` con metodos de lectura/transicion local. Test del modelo de ciclo de vida.

## Archivos

- `models/academico/jornada.ts`
- `servicios/academico/jornadaService.ts`
- `servicios/academico/jornadaService.test.ts`

## Evidencia RED

- `npm run test:app -- servicios/academico/jornadaService.test.ts` fallo inicialmente porque `jornadaService` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- servicios/academico/jornadaService.test.ts` con 6/6 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Creacion de jornada en borrador.
- Transicion normal: borrador -> confirmada -> en_curso -> pendiente_cierre -> cerrada.
- Rechazo de cierre sin asistencia.
- Rechazo de cierre sin objetivos impartidos.
- Cancelacion antes de cierre.
- Rechazo de transiciones invalidas.

## Nota

La generacion desde `BloqueRecurrente` queda pendiente para 7.5.
