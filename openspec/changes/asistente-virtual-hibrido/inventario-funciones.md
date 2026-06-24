# Current Product Function Inventory

Baseline reviewed from the current worktree on 2026-06-23. Roles: `A` Admin, `E` Editor, `AS` Asistente, `T` Tutor, `S` SuperAdmin, `P` public. `Estudiante` is reserved for a future authenticated role; its current journeys are public links.

Important: except for `/configuracion`, `/`, and `/aliant-control`, most authenticated routes rely mainly on navigation visibility or component conditions. Catalog roles describe intended visibility, not proof of backend authorization. Implementation must attach an `authorizationRef` and must not claim an action is permitted until its server/rules guard exists.

| ID | Surface and current actions | Audience | Code source |
|---|---|---|---|
| `shell.session` | Tenant onboarding guard, navigation, global student search, theme, profile, logout | A/E/AS/T/S | `App.tsx` |
| `admin.summary` | Operational dashboard, KPIs, payment/event summaries | A/E/AS/S | `vistas/Administracion.tsx`, `vistas/Dashboard.tsx` |
| `admin.late-fees` | Apply bulk overdue surcharges | A/E/AS/S currently; should be privileged | `vistas/Administracion.tsx` |
| `finance.ledger` | Filter ledger, create/edit movements, CSV control, daily/analytics views | A/E/AS/S | `vistas/Finanzas.tsx` |
| `finance.delete` | Delete financial movements | A | `vistas/Finanzas.tsx` |
| `finance.student-payments` | Register cash payment, list debtors, send debt notification, undo last payment | Register: A/E/AS; undo: A | `vistas/Finanzas.tsx`, `components/FilaEstudiante.tsx` |
| `finance.payment-validation` | Inspect receipt/AI extraction, approve and issue receipt, reject | A/E/AS/S currently; should be privileged | `components/Pagos/PanelValidacionPagos.tsx` |
| `agenda.read` | Filter weekly schedule by branch/instructor | A/E/AS/S | `vistas/Horarios.tsx` |
| `agenda.manage` | Create, edit and delete class blocks | A/S | `vistas/Horarios.tsx` |
| `students.directory` | Search/filter/page, view technical/payment data | A/E/AS | `vistas/Estudiantes.tsx`, `components/TablaEstudiantes.tsx` |
| `students.manage` | Create/edit, import/export CSV, share legal links, view signatures/QR | A/E/AS; destructive delete A | `vistas/Estudiantes.tsx`, `components/FilaEstudiante.tsx` |
| `students.kicho` | Activate/share census, inspect applicants, approve/reject | A/E | `vistas/MisionKicho.tsx` |
| `students.kicho-legalize` | Sign and legalize accepted batch | A | `vistas/MisionKicho.tsx` |
| `students.live-class` | QR entry, monitor attendance, mark ready, open WhatsApp, verify pickup | A/E/AS/T | `vistas/GestionClase.tsx` |
| `students.certificates` | Search and emit individual/group certificates | A/E/AS | `vistas/Certificaciones.tsx` |
| `students.cards` | Choose print format, generate batch PDF, mark generated/request production | A/E | `vistas/Carnetizacion.tsx` |
| `store.catalog` | Filter catalog, share public link, assign sale to student | A/E | `vistas/Tienda.tsx` |
| `store.inventory` | Create/edit/delete products and variants | A | `vistas/Tienda.tsx` |
| `events.catalog` | Filter and share events | A/E | `vistas/Eventos.tsx` |
| `events.manage` | Create/edit/delete events and approve/reject registrations | A | `vistas/Eventos.tsx`, `components/ModalGestionarSolicitudes.tsx` |
| `alerts.payment` | Generate/send debt reminders manually or through Relay | A/E | `vistas/Notificaciones.tsx` |
| `alerts.history` | Read history, mark one/all as read | A/E | `vistas/Notificaciones.tsx` |
| `config.identity-payments` | Institutional data, monthly fee, payment methods, logo/colors | A | `vistas/Configuracion.tsx` |
| `config.annual-enrollment-fee` | Activate annual enrollment/form fee, set its value and save changes | A | `vistas/Configuracion.tsx` |
| `config.branches` | Create/edit/delete branches within plan limit | A | `vistas/Configuracion.tsx` |
| `config.staff` | Create/edit/retire staff, roles, branch, contract | A | `vistas/Configuracion.tsx` |
| `config.programs` | Create/edit/delete extra programs and fees | A | `vistas/Configuracion.tsx` |
| `config.alerts` | Configure notification/push behavior | A | `vistas/Configuracion.tsx` |
| `config.license` | Inspect usage, select plan, buy capacity add-ons, restart onboarding | A | `vistas/Configuracion.tsx` |
| `profile.self` | View identity, branch, contract status, notifications and pay slips/PDF | A/E/AS/T/S | `vistas/MiPerfil.tsx` |
| `profile.attendance` | View worked hours; Tutor opens personal QR scanner | AS/T | `vistas/MiPerfil.tsx` |
| `license.renew` | View suspended license state and payment/support path | Authenticated | `vistas/LicenciaSuspendida.tsx` |
| `master.support` | Read active tickets, advance stage, create video room, resolve | Master email today; future S claim | `vistas/MasterDashboard.tsx`, `servicios/soporteApi.ts` |
| `master.tenants` | Inspect tenants and toggle subscription state | Master email today; future S claim | `vistas/MasterDashboard.tsx` |
| `master.kicho` | Create missions, inspect ready batches and inject homologated records | Master email today; future S claim | `vistas/MasterDashboard.tsx` |
| `master.analytics` | Review/clear UX heatmap data | Master email today; future S claim | `vistas/MasterDashboard.tsx` |
| `public.marketing` | Landing, school registration/payment activation | P | `vistas/PublicLanding.tsx`, `vistas/RegistroEscuela.tsx` |
| `public.auth` | Login and password recovery | P | `vistas/Login.tsx`, `components/ModalRecuperarContrasena.tsx` |
| `public.enrollment` | Legalize enrollment fee and submit student request | P | `vistas/PasarelaInscripcion.tsx` |
| `public.census` | Submit KICHO student/tutor/medical data | P | `vistas/CensoPublico.tsx` |
| `public.event` | View event and submit registration | P | `vistas/EventoPublico.tsx` |
| `public.legal-docs` | Sign service contract, risk consent and image authorization | P with signed link | `vistas/FirmaContrato.tsx`, `vistas/FirmaConsentimiento.tsx`, `vistas/FirmaImagen.tsx` |
| `public.payment-report` | Find student, upload receipt and report payment | P | `vistas/ReportarPagoPublico.tsx` |
| `public.pickup` | Query departure monitor by document | P | `vistas/SalidaPublica.tsx` |
| `public.help` | Search FAQ/PQRS guidance | P | `vistas/AyudaPqrs.tsx` |

## Catalog completion rule

An inventory row is complete only when its catalog intents have: stable IDs, current/future role status, route and UI label, aliases and actions, verified steps, sensitivity, escalation reason, source file, authorization reference, tests, owner, `introducedIn`, and `lastVerifiedAt`. CI must reject duplicate IDs, unknown roles/routes, missing sources, invalid versions, or generated client/function checksums that differ.
