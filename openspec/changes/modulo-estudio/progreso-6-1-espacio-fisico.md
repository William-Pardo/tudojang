# Registro 6.1 — espacio fisico y disponibilidad

- [x] 6.1 Definir modelo `EspacioFisico`; crear `espacioService` con `createEspacio`, `updateEspacio`, `getDisponibilidad`; test de disponibilidad con espacios superpuestos.

## Archivos

- `models/academico/espacio.ts`
- `servicios/academico/espacioService.ts`
- `servicios/academico/espacioService.test.ts`

## Evidencia RED

- `npm run test:app -- servicios/academico/espacioService.test.ts` fallo inicialmente porque `espacioService` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- servicios/academico/espacioService.test.ts` con 5/5 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Creacion de espacio activo por tenant/sede.
- Actualizacion de campos editables sin cambiar tenant/sede.
- Disponibilidad sin solapamientos.
- Conflicto por reserva superpuesta en el mismo espacio.
- Ignorar reserva existente al editar la misma referencia.
