# Progreso 9.3 - Cloud Function consolidateProgress

Fecha: 2026-06-27

## Alcance cerrado

- Se completo `functions/academico/progreso.js`.
- `crearServicioConsolidateProgress` valida:
  - usuario autenticado
  - `tenantId` consistente con custom claim
  - asignacion existente y del mismo tenant
  - asignacion activa/publicada
- Consolida progreso PDF y video.
- Persiste en `tenants/{tenantId}/progreso/{uid}/asignaciones/{asignacionId}`.
- Cuando el progreso queda `completado`, actualiza la asignacion con:
  - `ultimoEstadoProgreso`
  - `ultimoProgresoPorcentaje`
  - `ultimoProgresoEstudianteId`
  - `actualizadoEn`
- Se exporto callable `consolidateProgress` desde `functions/index.js`.
- Se agrego `crearAdaptadorConsolidateProgressFirestore` para conectar el servicio puro con Firestore.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `node --test functions/academico/progreso.test.js` fallo al exigir actualizacion de asignacion completada. |
| GREEN | El mismo comando paso con 4/4 tests. |
| REFACTOR | La logica se mantuvo inyectable: lectura de asignacion, escritura de progreso y actualizacion de asignacion son dependencias del servicio. |

## Verificacion

```powershell
node --test functions/academico/progreso.test.js
node --check functions/index.js
npm run build
```

Resultado:

```text
functions/academico/progreso.test.js
pass 4
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
