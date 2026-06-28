# Progreso 8.4 - Bloqueo y vencimiento automatico de asignaciones

Fecha: 2026-06-27

## Alcance cerrado

- Se agrego el estado `vencida` al modelo `EstadoAsignacionAcademica`.
- Se implemento `resolverEstadoTemporalAsignacion` para determinar:
  - `bloqueada` antes de `fechaApertura`
  - `publicada` dentro de la ventana activa
  - `vencida` despues de `fechaCierre`
- Se implemento `transicionarAsignacionesVencidas` para convertir asignaciones publicadas vencidas a estado `vencida`.
- Se creo `functions/academico/asignacionesScheduler.js` con `crearServicioVencerAsignaciones`.
- Se exporto `vencerAsignacionesAcademicas` como tarea programada diaria en `functions/index.js`.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED servicio | `npm run test:app -- servicios/academico/asignacionService.test.ts` fallo con `resolverEstadoTemporalAsignacion is not a function` y `transicionarAsignacionesVencidas is not a function`. |
| GREEN servicio | El mismo comando paso con 9/9 tests. |
| RED scheduler | `node --test functions/academico/asignacionesScheduler.test.js` fallo con `Cannot find module './asignacionesScheduler'`. |
| GREEN scheduler | El mismo comando paso con 2/2 tests. |
| REFACTOR | La logica de fechas quedo en funciones puras y el scheduler quedo inyectable para probar sin emulador. |

## Verificacion

```powershell
npm run test:app -- servicios/academico/asignacionService.test.ts
node --test functions/academico/asignacionesScheduler.test.js
node --check functions/index.js
npm run build
```

Resultado:

```text
PASS servicios/academico/asignacionService.test.ts
Tests: 9 passed, 9 total
functions/academico/asignacionesScheduler.test.js
pass 2
✓ built
```

Notas:

- El scheduler usa `collectionGroup('asignaciones')` filtrando `estado == publicada`.
- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
