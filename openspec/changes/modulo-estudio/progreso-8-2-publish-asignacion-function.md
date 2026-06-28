# Progreso 8.2 - Cloud Function publishAsignacion

Fecha: 2026-06-27

## Alcance cerrado

- Se creo `functions/academico/asignaciones.js`.
- Se implemento `crearServicioPublishAsignacion` como servicio inyectable para facilitar pruebas sin depender del emulador.
- Se exporto la callable `publishAsignacion` desde `functions/index.js`.
- La Function valida:
  - usuario autenticado
  - `tenantId` del request coincide con el custom claim
  - recurso existe y pertenece al tenant
  - recurso esta en estado `aprobado`
  - jornada existe y pertenece al tenant
  - el usuario autenticado es el maestro asignado a la jornada (`jornada.instructorId`)
- Si todo es valido, crea `tenants/{tenantId}/asignaciones/{asignacionId}` con estado `publicada`.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `node --test functions/academico/asignaciones.test.js` fallo inicialmente con `Cannot find module './asignaciones'`. |
| GREEN | El mismo comando paso con 3/3 tests. |
| REFACTOR | La logica quedo separada en funciones pequeñas: autenticacion, tenant, lectura de documentos, validacion de recurso, validacion de jornada y persistencia. |

## Verificacion

```powershell
node --test functions/academico/asignaciones.test.js
node --check functions/index.js
npm run build
```

Resultado:

```text
tests 3
pass 3
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
- No se cambio la logica existente de invitaciones, Drive, progreso ni pagos.
