# Registro 7.2 — confirmacion de jornada

- [x] 7.2 Crear validador base `confirmJornada`: valida disponibilidad de maestro, espacio, grupo, autorizacion de sede, capacidad y compatibilidad disciplina-objetivo/espacio.

## Archivos

- `servicios/academico/confirmJornada.ts`
- `servicios/academico/confirmJornada.test.ts`

## Evidencia RED

- `npm run test:app -- servicios/academico/confirmJornada.test.ts` fallo inicialmente porque `confirmJornada` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- servicios/academico/confirmJornada.test.ts` con 6/6 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Jornada sin conflictos.
- Tenant incorrecto.
- Instructor sin autorizacion para la sede.
- Capacidad insuficiente del espacio.
- Disciplina no compatible con el espacio.
- Cruce de espacio, instructor y grupo.

## Nota de alcance

Se implemento como validador puro frontend/shared para mantener pruebas rapidas y reutilizables.
La envoltura Cloud Function real puede consumir este contrato sin reescribir la logica.
