# Lista de Evidencias para Despliegue – Centro de Estudios

Versión: 1.0 | Fecha: 2026-06-29 | Responsable: Antigravity/Gemini (A3.4)

Este documento define las evidencias obligatorias que deben existir y estar accesibles antes de autorizar el despliegue a producción del módulo Centro de Estudios.

---

## 1. Evidencias de código y tests

| # | Evidencia | Archivo o artefacto | Estado | Verificado por |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Unit tests del módulo pasando (CI o ejecución local). | `npm run test:app -- --silent vistas/CentroEstudios.test.tsx vistas/admin/BibliotecaView.test.tsx App.routing.test.ts services/storage/driveService.test.ts` -> 4 suites / 32 tests passed | [x] | Codex 2026-06-29 |
| 1.2 | Firestore Rules tests pasando. | Emulador activo `127.0.0.1:8080` + `node --test functions/test/firestore-rules.security.test.js functions/test/firestore-rules.behavior.test.js` -> 12 tests passed | [x] | Codex 2026-06-29 |
| 1.3 | Functions tests completos pasando (76 base + 50 Drive). | `npm run test:functions:full` -> 76 base + 50 Drive passed | [x] | Codex 2026-06-29 |
| 1.4 | Build de producción sin errores. | `npm run build` -> passed | [x] | Codex 2026-06-29 |
| 1.5 | Cypress E2E del módulo pasando en staging. | Output/video de `npx cypress run --spec cypress/e2e/centroEstudios*` | [ ] | |
| 1.6 | Índices Firestore críticos declarados. | `node --test scripts/centro-estudios-indexes.test.cjs` -> 1 test passed | [x] | Codex 2026-06-29 |

---

## 2. Evidencias de documentación

| # | Evidencia | Archivo | Estado | Verificado por |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Guía de conexión Google Drive y activación por tenant. | docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md | [x] | Antigravity A1 |
| 2.2 | Matriz de roles y accesos. | docs/MATRIZ_ROLES_CENTRO_ESTUDIOS.md | [x] | Antigravity A2 |
| 2.3 | Copy final de Biblioteca Drive (11 estados). | docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md § 5 | [x] | Antigravity A2 |
| 2.4 | Estados vacíos reales documentados (11 estados). | docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md § 6 | [x] | Antigravity A2 |
| 2.5 | Revisión de textos demo/piloto (7 entradas). | docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md § 7 | [x] | Antigravity A2 |
| 2.6 | Checklist manual video/demo (18 acciones x 4 columnas). | docs/CHECKLIST_VIDEO_DEMO.md | [x] | Antigravity A2 |
| 2.7 | Guía final de uso por rol (Admin, Maestro, Estudiante, Tutor). | docs/GUIA_USO_POR_ROL.md | [x] | Antigravity A3 |
| 2.8 | Guía final de rollback. | docs/GUIA_ROLLBACK.md | [x] | Antigravity A3 |
| 2.9 | Checklist staging final (7 bloques, firma de aprobación). | docs/CHECKLIST_STAGING_FINAL.md | [x] | Antigravity A3 |

---

## 3. Evidencias de staging

| # | Evidencia | Formato esperado | Estado | Verificado por |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Checklist staging firmado por QA y responsable técnico. | docs/CHECKLIST_STAGING_FINAL.md completado | [ ] | |
| 3.2 | Video de demo del flujo completo (conexión Drive → asignación → estudiante). | Archivo de video o link | [ ] | |
| 3.3 | Captura de pantalla del estado "Drive conectado" en staging. | Imagen o link | [ ] | |
| 3.4 | Captura de pantalla del aislamiento cross-tenant (Tenant A no ve datos de Tenant B). | Imagen o log de error esperado | [ ] | |
| 3.5 | Captura de URL temporal expirada mostrando error esperado. | Imagen o log | [ ] | |
| 3.6 | Log de la simulación de token revocado mostrando el mensaje correcto en UI. | Imagen o log | [ ] | |

---

## 4. Evidencias de seguridad

| # | Evidencia | Formato esperado | Estado | Verificado por |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | App Check configurado y activo en Firebase Console (staging). | Captura de Firebase Console | [ ] | |
| 4.2 | Variables secretas configuradas en Firebase Functions (no en código). | Confirmación devops | [ ] | |
| 4.3 | No hay datos de producción en el entorno staging. | Confirmación devops | [ ] | |
| 4.4 | Reglas de Firestore bloquean acceso cross-tenant (test automatizado). | Output de `npm run test:firestore-rules` | [ ] | |

---

## 5. Autorización de despliegue

El despliegue a producción solo puede ejecutarse cuando **todas las evidencias anteriores estén marcadas como completas**.

| Sección | Estado actual |
| :--- | :--- |
| 1. Código y tests | Parcial: unitarias, rules, functions, build e índices OK; E2E Cypress staging pendiente |
| 2. Documentación | COMPLETA |
| 3. Staging | Pendiente de ejecución |
| 4. Seguridad | Pendiente de ejecución |

### Firma de autorización

| Rol | Nombre | Fecha | Firma |
| :--- | :--- | :--- | :--- |
| Responsable técnico | | | |
| Responsable de producto | | | |
