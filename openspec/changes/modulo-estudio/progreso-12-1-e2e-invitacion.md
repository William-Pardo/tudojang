# Progreso 12.1 - E2E invitación y Centro de Estudios vacío

Fecha: 2026-06-27

## Resultado

Tarea 12.1 cerrada. El flujo E2E de estudiante activado con Centro de Estudios vacío queda verificado en Cypress.

## Cambio aplicado

Se completó el fixture del test E2E con `__TUDOJANG_E2E_TENANT__` para simular un tenant activo, con onboarding completo y `features.centroEstudios` habilitado.

## Archivos relacionados

- `cypress/e2e/modulo-estudio-invitacion.cy.ts`

## Evidencia TDD

| Fase | Evidencia |
| --- | --- |
| RED | `npx cypress run --spec cypress/e2e/modulo-estudio-invitacion.cy.ts` falló porque el flujo caía en “Plataforma en configuración” y no renderizaba `Centro de Estudios`. |
| GREEN | Se agregó fixture E2E de tenant configurado. El spec pasó: 1 test passing, 0 failing. |
| REFACTOR | Cambio mínimo limitado al setup E2E; no se modificó lógica productiva. |

## Comando de verificación

```powershell
npx cypress run --spec cypress/e2e/modulo-estudio-invitacion.cy.ts
```

Resultado:

- Tests: 1
- Passing: 1
- Failing: 0
