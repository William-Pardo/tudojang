# TEST_REPORT — 2026-07-22

Todos los números verificados corriendo los comandos al cierre de la sesión.

## Resumen

| Suite | Comando | Resultado |
|---|---|---|
| App (Jest) | `npx jest --runInBand` | **154 suites / 1628 pass / 0 fail** (3 skipped) |
| Functions (node:test) | `npm --prefix functions test` | 267 pass |
| Functions (Jest: drive, invitaciones) | (dentro de `test:functions:full`) | 111 pass |
| Scripts operativos | `npm run test:node` | 25 pass |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **0 errores** |

## Cobertura de integración del Centro de Estudios (12 suites, ~147 pruebas)

| Suite | Foco |
|---|---|
| `biblioteca.integracion.test.ts` | importar → clasificar → aprobar → publicar; regla de archivado |
| `quiz.integracion.test.ts` | configurar banco → responder → métrica; regla de "completada" ≥70 |
| `vinculoIdentidad.integracion.test.ts` | resolución de hijos por email del acudiente (case-sensitivity) |
| `agendaJornada.integracion.test.ts` | conflicto horario, bloqueo optimista, eliminación segura, archivar |
| `progresoAnalitica.integracion.test.ts` | cruce métricas → asignación → jornada → programa |
| `publicarMaterial.integracion.test.ts` | cadena de publicación |
| `generacionJornadas.integracion.test.ts` | programa → generación de jornadas |
| `CentroEstudios.integracion.test.tsx` | identidad del consultor |
| `MisClasesView.integracion.test.tsx` | cierre de jornada |
| `claseEnVivo.integracion.test.ts` | scheduler ↔ ventana |
| `checkInQr.integracion.test.ts` | scanner → callable → repositorio |
| `ClaseEnVivoView.integracion.test.tsx` | ventana → habilitación del scanner |

## Verificación por mutación (esta sesión)
Cada bug/regla se verificó rompiendo el código a propósito y confirmando que la suite se pone
en rojo. Casos: score-último-quiz, deduplicación de biblioteca, normalización de correos (5º
param + regla), guard de ficha, bloqueo optimista de jornada, `archivarJornada` (rama
Firestore), regla de quiz ≥70, error-vs-vacío del preview, guard de "recurso usado" (×2),
cruce de programa en analítica, lectura por tenant.

## Nota de estabilidad
`AsignarMaterialWizard.test.tsx` tenía un **flake preexistente** por timeout (tests de 5-10s
contra el default de 5s de jest, bajo carga del run completo). Reproducido 3/5. Corregido con
`jest.setTimeout(30000)`; 6 corridas consecutivas verdes tras el fix, y la regresión completa
final salió limpia.
