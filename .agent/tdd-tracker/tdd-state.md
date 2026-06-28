# TDD State Tracker — Tudojang

> **Última actualización**: 2026-06-21
> **Baseline**: Stmts 73.75% | Branch 67.88% | Funcs 66.81% | Lines 73.65%
> **Suites**: 21 passed | **Tests**: 200 passed

---

## Fase 1 — Servicios SIN Tests (Prioridad Alta)

| # | Archivo | Estado | Coverage | Prompt |
|---|---------|--------|----------|--------|
| 1.1 | `servicios/configuracionApi.ts` (7KB) | ✅ Completado | Cobertura N/A | `prompts/fase-1-servicios-sin-tests.md` §1 |
| 1.2 | `servicios/usuariosApi.ts` (13KB) | ▶️ En progreso | — | `prompts/vertical-servicios-usuariosApi.md` |
| 1.3 | `servicios/censoApi.ts` (6KB) | ✅ Completado | Cobertura N/A | `prompts/fase-1-servicios-sin-tests.md` §3 |
| 1.4 | `servicios/finanzasApi.ts` (3KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §4 |
| 1.5 | `servicios/sedesApi.ts` (3KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §5 |
| 1.6 | `servicios/programasApi.ts` (4KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §6 |
| 1.7 | `servicios/notificacionesApi.ts` (6KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §7 |
| 1.8 | `servicios/tiendaApi.ts` (15KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §8 |
| 1.9 | `servicios/soporteApi.ts` (2KB) + `soporteService.ts` (5KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §9 |
| 1.10 | `servicios/emailService.ts` (4KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §10 |
| 1.11 | `servicios/pushService.ts` (2KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §11 |
| 1.12 | `servicios/plantillas.ts` (8KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §12 |
| 1.13 | `servicios/baseConocimiento.ts` (4KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §13 |
| 1.14 | `servicios/tudojangRelay.ts` (3KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §14 |
| 1.15 | `servicios/wompiWebhook.ts` (2KB) | ⬜ Pendiente | — | `prompts/fase-1-servicios-sin-tests.md` §15 |

## Fase 2 — Servicios CON Tests (Mejorar a 100%)

| # | Archivo | Estado | Coverage Actual | Prompt |
|---|---------|--------|-----------------|--------|
| 2.1 | `servicios/estudiantesApi.test.ts` | ⬜ Pendiente | ~95% (verificar) | `prompts/fase-2-servicios-mejorar-cobertura.md` §1 |
| 2.2 | `servicios/eventosApi.test.ts` | ⬜ Pendiente | ~80% (verificar) | `prompts/fase-2-servicios-mejorar-cobertura.md` §2 |
| 2.3 | `servicios/pagosApi.test.ts` | ⬜ Pendiente | ~70% (verificar) | `prompts/fase-2-servicios-mejorar-cobertura.md` §3 |
| 2.4 | `servicios/pagosEstudiantesApi.test.ts` | ⬜ Pendiente | verificar | `prompts/fase-2-servicios-mejorar-cobertura.md` §4 |
| 2.5 | `servicios/asistenciaApi.test.ts` | ⬜ Pendiente | verificar | `prompts/fase-2-servicios-mejorar-cobertura.md` §5 |
| 2.6 | `servicios/leadsEventosApi.test.ts` | ⬜ Pendiente | verificar | `prompts/fase-2-servicios-mejorar-cobertura.md` §6 |

## Fase 3 — Componentes SIN Tests (Prioridad Media)

| # | Archivo | Estado | Coverage | Prompt |
|---|---------|--------|----------|--------|
| 3.1 | `components/EmptyState.tsx` + `ErrorState.tsx` + `Loader.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §1 |
| 3.2 | `components/EstadoPagoBadge.tsx` + `FormInputError.tsx` + `ToggleSwitch.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §2 |
| 3.3 | `components/BotonVolverArriba.tsx` + `LogoDinamico.tsx` + `NotificacionToast.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §3 |
| 3.4 | `components/AutosavePrompt.tsx` + `BrandingProvider.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §4 |
| 3.5 | `components/FormularioSede.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §5 |
| 3.6 | `components/FormularioUsuario.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §6 |
| 3.7 | `components/FormularioImplemento.tsx` + `FormularioMovimiento.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §7 |
| 3.8 | `components/FilaUsuario.tsx` + `TablaUsuarios.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §8 |
| 3.9 | `components/TarjetaEventoAdmin.tsx` + `TarjetaEventoPublico.tsx` + `TarjetaHistorial.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §9 |
| 3.10 | `components/FiltrosTienda.tsx` + `HeatmapOverlay.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §10 |
| 3.11 | `components/GestionNotificacionesPush.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §11 |
| 3.12 | `components/ModalAgendarClase.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §12 |
| 3.13 | `components/ModalBusquedaGlobal.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §13 |
| 3.14 | `components/ModalCompartirEvento.tsx` + `ModalCompartirTienda.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §14 |
| 3.15 | `components/ModalGestionarSolicitudes.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §15 |
| 3.16 | `components/ModalImportacionMasiva.tsx` | ✅ Completado | — | `prompts/fase-3-componentes-sin-tests.md` §16 |
| 3.17 | `components/ModalRecuperarContrasena.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §17 |
| 3.18 | `components/ModalSeleccionarEstudiante.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §18 |
| 3.19 | `components/ModalSolicitarCompra.tsx` + `ModalSolicitarInscripcion.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §19 |
| 3.20 | `components/ModalVerFirma.tsx` | ✅ Completado | — | `prompts/fase-3-componentes-sin-tests.md` §20 |
| 3.21 | `components/AsistenteVirtual.tsx` | ⬜ Pendiente | — | `prompts/fase-3-componentes-sin-tests.md` §21 |

## Fase 4 — Vistas SIN Tests (Prioridad Media-Baja)

| # | Archivo | Estado | Coverage | Prompt |
|---|---------|--------|----------|--------|
| 4.1 | `vistas/Eventos.tsx` + `vistas/EventoPublico.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §1 |
| 4.2 | `vistas/Configuracion.tsx` (71KB) | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §2 |
| 4.3 | `vistas/Administracion.tsx` + `vistas/MasterAccess.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §3 |
| 4.4 | `vistas/MasterDashboard.tsx` (43KB) | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §4 |
| 4.5 | `vistas/Carnetizacion.tsx` + `vistas/Certificaciones.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §5 |
| 4.6 | `vistas/GestionClase.tsx` + `vistas/Horarios.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §6 |
| 4.7 | `vistas/MiPerfil.tsx` + `vistas/PerfilTutor.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §7 |
| 4.8 | `vistas/PasarelaInscripcion.tsx` + `vistas/PasarelaPagos.tsx` + `vistas/ReportarPagoPublico.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §8 |
| 4.9 | `vistas/Tienda.tsx` + `vistas/VistaTiendaPublica.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §9 |
| 4.10 | `vistas/CensoPublico.tsx` + `vistas/MisionKicho.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §10 |
| 4.11 | `vistas/PublicLanding.tsx` + `vistas/RegistroEscuela.tsx` + `vistas/SalidaPublica.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §11 |
| 4.12 | `vistas/AyudaPqrs.tsx` + `vistas/Notificaciones.tsx` + `vistas/LicenciaSuspendida.tsx` + `vistas/404.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §12 |
| 4.13 | `vistas/FirmaConsentimiento.tsx` + `vistas/FirmaContrato.tsx` + `vistas/FirmaImagen.tsx` | ⬜ Pendiente | — | `prompts/fase-4-vistas-sin-tests.md` §13 |

## Fase 5 — Refactors (OpenSpec: cobertura-y-refactor-estudiantes)

| # | Descripción | Estado | Prompt |
|---|-------------|--------|--------|
| 5.1 | Implementar watch `fechaNacimiento` → `grupo` con TDD | ⬜ Pendiente | `prompts/fase-5-refactors-estudiantes.md` §1 |
| 5.2 | Corregir formato selector de sedes (paréntesis vacíos) | ⬜ Pendiente | `prompts/fase-5-refactors-estudiantes.md` §2 |

---

## Resumen de Progreso

| Fase | Total | Completados | % |
|------|-------|-------------|---|
| 1 - Servicios sin tests | 15 | 0 | 0% |
| 2 - Servicios mejorar | 6 | 0 | 0% |
| 3 - Componentes sin tests | 21 | 0 | 0% |
| 4 - Vistas sin tests | 13 | 0 | 0% |
| 5 - Refactors | 2 | 0 | 0% |
| **TOTAL** | **57** | **0** | **0%** |
