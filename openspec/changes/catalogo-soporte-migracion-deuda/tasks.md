# Tasks: Migración de la deuda congelada del catálogo de soporte

Un ítem de checklist por cada uno de los 25 archivos en `shared/soporte/deuda-catalogo.json`'s `deuda[]` (línea base congelada de `catalogo-soporte-marcadores-vivos`, Fase 6). El orden sigue exactamente el orden de `deuda[]` en el JSON. Cada ítem lista el/los id(s) de entry (`shared/soporte/catalogo.v1.ts`) que ese archivo cubre hoy de forma manual — cruzado archivo por archivo contra `sourceFiles` de cada `entry(...)`.

Este `tasks.md` es de **planificación**: ningún ítem se ejecuta en este PR. Quedan sin marcar `[ ]` hasta que un `sdd-apply` de este change los implemente.

**Total de ítems: 25 — debe coincidir exactamente con `deuda-catalogo.json`'s `deuda[].length` (condición de cierre, spec del change padre).**

## Phase 1: Migrar cada archivo de deuda a `soporteMeta` co-locado

- [ ] 1.1 `vistas/ActivarCuenta.tsx` — entry `public.activation`.
- [ ] 1.2 `vistas/AyudaPqrs.tsx` — entry `public.help`.
- [ ] 1.3 `vistas/CensoPublico.tsx` — entry `public.census`.
- [ ] 1.4 `vistas/CentroEstudios.tsx` — entry `centro-estudios.consultor`.
- [ ] 1.5 `vistas/ClaseEnVivoView.tsx` — entry `clase-en-vivo.checkpoint`.
- [ ] 1.6 `vistas/Configuracion.tsx` — entries `config.identity-payments`, `config.annual-enrollment-fee`, `config.branches`, `config.staff`, `config.programs`, `config.alerts`, `config.license` (7 entradas, mismo archivo — migrar juntas en una sola tarea de implementación).
- [ ] 1.7 `vistas/Estudiantes.tsx` — entries `students.directory`, `students.manage`.
- [ ] 1.8 `vistas/EventoPublico.tsx` — entry `public.event`.
- [ ] 1.9 `vistas/Eventos.tsx` — entries `events.catalog`, `events.manage`.
- [ ] 1.10 `vistas/FirmaConsentimiento.tsx` — entry `public.consent-signature`.
- [ ] 1.11 `vistas/FirmaContrato.tsx` — entry `public.contract-signature`.
- [ ] 1.12 `vistas/FirmaContratoColaborador.tsx` — entry `public.collaborator-contract-signature`.
- [ ] 1.13 `vistas/FirmaImagen.tsx` — entry `public.image-signature`.
- [ ] 1.14 `vistas/LicenciaSuspendida.tsx` — entry `license.renew`.
- [ ] 1.15 `vistas/Login.tsx` — entry `public.auth`.
- [ ] 1.16 `vistas/MasterAccess.tsx` — entry `master.access`.
- [ ] 1.17 `vistas/MiPerfil.tsx` — entries `profile.self`, `profile.attendance`.
- [ ] 1.18 `vistas/Notificaciones.tsx` — entries `alerts.payment`, `alerts.history`.
- [ ] 1.19 `vistas/PasarelaInscripcion.tsx` — entry `public.enrollment`.
- [ ] 1.20 `vistas/PublicLanding.tsx` — entry `public.marketing` (⚠ compartida con `vistas/RegistroEscuela.tsx`, ver 1.21 — resolver en `design.md` cómo declarar `soporteMeta` para una entrada con dos `sourceFiles` antes de migrar cualquiera de los dos).
- [ ] 1.21 `vistas/RegistroEscuela.tsx` — entry `public.marketing` (⚠ misma entrada compartida que 1.20; no migrar de forma independiente — resolver conjuntamente).
- [ ] 1.22 `vistas/ReportarPagoPublico.tsx` — entry `public.payment-report`.
- [ ] 1.23 `vistas/RestablecerClave.tsx` — entry `public.password-reset`.
- [ ] 1.24 `vistas/SalidaPublica.tsx` — entry `public.pickup`.
- [ ] 1.25 `vistas/Tienda.tsx` — entries `store.catalog`, `store.inventory`.

## Out of Scope Reminder (no checklist items)

- `exentosPermanentes[]` (`App.tsx`, `vistas/MasterDashboard.tsx`) — núcleo estructural permanente, nunca migra vía este change.
- Las 15 entradas manuales de archivos que `App.tsx` no enruta directamente (`admin.*`, `finance.*`, `students.kicho*`, `students.live-class`, `centro-estudios.material`/`biblioteca`/`progreso`, `students.certificates`, `students.cards`) — fuera del alcance del gate por completo, no aplican a este change.
