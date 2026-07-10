# Checklist Staging Final – Centro de Estudios

Versión: 1.0 | Fecha: 2026-06-29 | Responsable: Antigravity/Gemini (A3.3)

Ejecutar este checklist antes de habilitar el módulo en producción o en el tenant piloto.
Debe ser firmado por quien lo ejecutó y aprobado por al menos un responsable técnico.

---

## Bloque 1: Infraestructura y Variables

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | GOOGLE_CLIENT_ID configurada en Firebase Functions (staging). | Devops | [ ] | |
| 1.2 | GOOGLE_CLIENT_SECRET configurada en Firebase Functions (staging). | Devops | [ ] | |
| 1.3 | GOOGLE_REDIRECT_URI configurada y coincide con Google Cloud Console. | Devops | [ ] | |
| 1.4 | VITE_RECAPTCHA_ENTERPRISE_SITE_KEY configurada en el build de staging. | Devops | [ ] | |
| 1.5 | App Check activo en Firebase Console para el proyecto staging. | Devops | [ ] | |
| 1.6 | Pantalla de consentimiento OAuth **no** está en modo borrador, o el tenant piloto está registrado como usuario de prueba. | Devops | [ ] | |

---

## Bloque 2: Aislamiento por Tenant (Cross-Tenant Check)

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Conectar Tenant A con Cuenta Google A. | QA | [ ] | |
| 2.2 | Conectar Tenant B con Cuenta Google B. | QA | [ ] | |
| 2.3 | Desde Tenant A, intentar listar archivos del Drive de Tenant B → debe fallar con error de permisos. | QA | [ ] | |
| 2.4 | Desde Tenant A, intentar aprobar un recurso del Tenant B → debe fallar con error de autorización. | QA | [ ] | |

---

## Bloque 3: Flujo OAuth y Drive

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Admin conecta Google Drive exitosamente (flujo OAuth completo). | QA | [ ] | |
| 3.2 | Estado de la UI pasa a "Conectado" con connectionId visible. | QA | [ ] | |
| 3.3 | Admin selecciona carpeta raíz y el explorador lista archivos correctamente. | QA | [ ] | |
| 3.4 | Admin importa un archivo real de Drive y aparece en Biblioteca como "Pendiente". | QA | [ ] | |
| 3.5 | Admin aprueba un recurso y pasa a estado "Aprobado". | QA | [ ] | |

---

## Bloque 4: Flujo Jornadas y Asignaciones

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Maestro crea y confirma jornada con instructor, grupo, sede y espacio. | QA | [ ] | |
| 4.2 | Admin publica asignación de un recurso aprobado a un estudiante. | QA | [ ] | |
| 4.3 | Estudiante ve la asignación en su panel. | QA | [ ] | |
| 4.4 | Estudiante abre el material con URL temporal segura. | QA | [ ] | |
| 4.5 | URL temporal expira en el tiempo configurado (máx. 1 hora) y queda inoperable. | QA | [ ] | |

---

## Bloque 5: Seguridad y Roles

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 5.1 | Estudiante no puede acceder al panel de administración ni a la Biblioteca global. | QA | [ ] | |
| 5.2 | Tutor no puede completar quizzes ni marcar actividades en nombre del estudiante. | QA | [ ] | |
| 5.3 | Maestro no puede modificar credenciales OAuth del tenant. | QA | [ ] | |
| 5.4 | Revocar el token desde Google → UI muestra "Conexión de Drive expirada" con botón "Reconectar". | QA | [ ] | |
| 5.5 | Simular permisos insuficientes → UI muestra "Permisos insuficientes en Drive". | QA | [ ] | |
| 5.6 | Simular carpeta inaccesible → UI muestra "Carpeta inaccesible". | QA | [ ] | |
| 5.7 | Firestore Rules tests pasan en staging. | Codex | [ ] | |

---

## Bloque 6: Tests Automatizados

| # | Verificación | Comando | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 6.1 | Unit tests del módulo. | `npm run test:app -- --silent vistas/CentroEstudios.test.tsx` | [ ] | |
| 6.2 | Tests de reglas Firestore. | `npm run test:firestore-rules` | [ ] | |
| 6.3 | Tests de Functions completos. | `npm run test:functions:full` | [ ] | |
| 6.4 | Build de producción. | `npm run build` | [ ] | |
| 6.5 | Tests Cypress E2E del módulo. | `npx cypress run --spec cypress/e2e/centroEstudios*` | [ ] | |

---

## Bloque 7: Feature Flag y Rollback

| # | Verificación | Responsable | Estado | Fecha |
| :--- | :--- | :--- | :--- | :--- |
| 7.1 | Feature flag `features.centroEstudios` existe y se puede desactivar sin reiniciar el servidor. | Devops | [ ] | |
| 7.2 | Desactivar la flag oculta completamente el módulo en la UI. | QA | [ ] | |
| 7.3 | Reactivar la flag restaura el módulo sin pérdida de datos. | QA | [ ] | |
| 7.4 | La guía de rollback (`docs/GUIA_ROLLBACK.md`) está publicada y accesible al equipo. | Devops | [ ] | |

---

## Firma de aprobación

| Rol | Nombre | Fecha | Firma |
| :--- | :--- | :--- | :--- |
| QA / Ejecutor | | | |
| Responsable técnico | | | |
| Responsable de producto | | | |
