# Progreso 8.1 - Modelo y servicio de asignaciones academicas

Fecha: 2026-06-27

## Alcance cerrado

- Se evoluciono el modelo existente `AsignacionAcademica` / `DestinatarioAsignacion` sin romper la UX piloto de Centro de Estudios.
- Se agrego `getAsignacionesByEstudiante` para filtrar asignaciones publicadas por:
  - `tenantId`
  - grupo
  - grado
  - estudiante especifico
- Se agrego `validateAsignacion` para validar que:
  - recurso y asignacion pertenezcan al mismo tenant
  - la asignacion apunte al recurso correcto
  - el recurso este en estado `aprobado`
- Se agrego `publishAsignacion` para publicar una asignacion valida y rechazar recursos no aprobados.
- Se mantuvo compatible `obtenerAsignacionesPorEstudiante`, usado por la vista actual del Centro de Estudios.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- servicios/academico/asignacionService.test.ts` fallo con `getAsignacionesByEstudiante is not a function`, `validateAsignacion is not a function` y `publishAsignacion is not a function`. |
| GREEN | El mismo comando paso con 6/6 tests. |
| REFACTOR | Implementacion encapsulada en funciones puras, sin acoplarla todavia a Firestore ni romper el servicio demo existente. |

## Verificacion

```powershell
npm run test:app -- servicios/academico/asignacionService.test.ts
npm run build
```

Resultado:

```text
PASS servicios/academico/asignacionService.test.ts
Tests: 6 passed, 6 total
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
