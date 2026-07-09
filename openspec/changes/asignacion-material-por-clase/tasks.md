# Tasks: Asignación de materiales a clases (Camino A)

## Phase 1: Foundation (tipos)

- [x] 1.1 Agregar `jornadaId?: string` a `AsignacionAcademica` en `models/academico/asignacion.ts`
- [x] 1.2 Agregar `PublicarAsignacionesBatchRequest`/`Response` a `models/academico/asignacionService.types.ts`
- [x] 1.3 `npx tsc --noEmit` para verificar que el tipo nuevo no rompe consumidores existentes

## Phase 2: Cloud Function batch

- [x] 2.1 RED: test en `functions/academico/asignaciones.test.js` — batch de 2 recursos × 2 jornadas crea 4 docs
- [x] 2.2 GREEN: implementar `crearServicioPublishAsignacionesBatch` en `functions/academico/asignaciones.js` con `firestore.batch()`
- [x] 2.3 RED: test — combo duplicado se reporta en `skipped`, no aborta el resto *(pasó sin cambios de código — 2.2 ya cubría el dedup; no fue un RED real, ver Issues)*
- [x] 2.4 GREEN: query de dedup — ya implementada en 2.2, sin trabajo adicional
- [x] 2.5 RED: test — recurso no aprobado o jornada inexistente se saltea con `reason` *(mismo caso: pasó sin cambios, 2.2 ya lo cubría)*
- [x] 2.6 GREEN: clasificación por combo — ya implementada en 2.2, sin trabajo adicional
- [x] 2.7 Registrar el callable nuevo en `functions/index.js`
- [x] 2.8 `npm run test:functions:drive` y `npm run test:functions` en verde *(ambos en verde, pero NINGUNO ejecuta `academico/asignaciones.test.js` — gap de wiring preexistente, ver Issues; verificado directo con `node --test academico/asignaciones.test.js`, 6/6 verde)*
- [x] 2.9 (agregada durante Fase 4) **Bug fix**: `titulo` en el batch compartía el mismo valor de `asignacionBase` para TODOS los combos — si se publican recursos distintos en un lote, ahora cada uno usa `recurso.nombre` como fallback si `asignacionBase.titulo` no se especifica. RED→GREEN real, test nuevo en `asignaciones.test.js`, 7/7 verde

## Phase 3: Servicio cliente

- [x] 3.1 RED: test en `servicios/academico/asignacionService.test.ts` — `publicarAsignacionesBatch()` happy path (mock `httpsCallable`) *(falló como se esperaba: "not a function")*
- [x] 3.2 GREEN: implementar `publicarAsignacionesBatch()` en `servicios/academico/asignacionService.ts`
- [x] 3.3 RED: test — error de red/callable propaga sin romper la app *(falló junto con 3.1, mismo motivo)*
- [x] 3.4 GREEN: sin `try/catch` adicional — el error del callable propaga naturalmente, cubierto por la misma implementación de 3.2
- [x] 3.5 `npx jest --runInBand --testPathPattern servicios/academico/asignacionService.test.ts` — 12/12 verde

## Phase 4: UI — `vistas/admin/AsignacionesView.tsx`

- [x] 4.1 Agregar `listarJornadasPorTenant` a `JornadaRepository`/`jornadaRepository.ts` (no `jornadaService.ts` ni "por programaId" — desviación: la vista alinea con el vocabulario ya anticipado en el mock de `AsignacionesView.test.tsx`, y filtra por `programaId` client-side). De paso corregidos los 2 mocks preexistentes rotos en `AsignacionesView.test.tsx` (faltaba `guardarEjecucion`/`existeConflictoHorario`)
- [x] 4.2/4.3 **DESVIACIÓN (Opción B acordada con el usuario)**: `ProgramaAcademicoAsignacion`/`generarJornadasLocalesPrograma` NO se retiraron — se descubrió en apply que no son un modelo de jornada real sino una simulación 100% client-side (nunca persistida) usada para el preview/carrusel. Reemplazar esto por jornadas reales de Firestore habría requerido persistir hasta 60 `JornadaInstruccion` por programa por adelantado (fuera de alcance, ver checkpoint con el usuario). Se mantiene el preview client-side; cada jornada se persiste recién al publicarla (`asegurarJornadaParaPreview`, generaliza `asegurarJornadaPrograma` a cualquier jornada del preview, no solo la activa)
- [x] 4.4 Tests para multi-select de recursos y jornadas (checkboxes) — pasaron directo (implementación escrita antes que el test dado lo intrincado del archivo; no hubo RED real, ver Issues)
- [x] 4.5 **DESVIACIÓN**: NO se reemplazó `recursoId`/`jornadaActivaIndex` — se agregó `recursosLoteIds`/`jornadasLoteIds` (`Set<string>`) de forma ADITIVA, en una sección nueva "Publicación en lote", preservando el flujo de un-solo-material existente intacto (17/17 tests preexistentes del archivo siguen en verde)
- [x] 4.6/4.7 Filtro por tag (`filtroTagLote` + `recursosFiltradosPorTag`) implementado y testeado
- [x] 4.8/4.9 **DESVIACIÓN**: `publicarLote()` es una función NUEVA adicional, no reemplaza `publicar()`. No usa `crearClavePublicacionAsignacion` para dedup client-side (el dedup real ya lo hace el backend batch de la Fase 2); muestra resumen creados/saltados
- [x] 4.10 `npx jest --runInBand --testPathPattern vistas/admin/AsignacionesView.test.tsx` (no `CentroEstudios.test.tsx` — el archivo real es `AsignacionesView.test.tsx`) — 17/17 verde, sin regresiones. `tsc --noEmit` sin errores nuevos (los +15 son la misma clase de ruido preexistente de jest-dom, proporcional a las líneas de test agregadas)

## Phase 5: Regresión de seguridad y cierre

- [x] 5.1/5.2 Test de regresión agregado en `firestore-rules.behavior.test.js` (2 tests: instructor mismo tenant puede crear asignación con `jornadaId`; instructor de otro tenant no puede leer ni escribir). Corrido contra el emulador REAL vía `npm run test:firestore-rules` — 18/18 verde, confirma con evidencia (no solo razonamiento) que las reglas no necesitaban cambios
- [x] 5.3 **BLOQUEADO, aceptado por el usuario**: intenté verificación manual vía Cypress contra el dev server real (`npm run dev` + spec E2E usando el bypass `__TUDOJANG_E2E_USER__` ya existente en `modulo-estudio-cierre-jornada.cy.ts`). El binario de Cypress está corrupto en esta máquina (`cachedDataRejected`, luego `bad option: --smoke-test` incluso después de `cypress install --force`) — problema de entorno preexistente, no relacionado con este change. El usuario decidió aceptar la evidencia automatizada existente (17/17 tests + reglas Firestore contra emulador real) y probarlo manualmente él mismo más adelante con `npm run dev`
- [x] 5.4 **N/A — no aplica**: `ProgramaAcademicoAsignacion`/`JornadaPublicacionLocal`/`generarJornadasLocalesPrograma` siguen en uso activo (decisión Opción B de Fase 4), no son código muerto
- [x] 5.5 Marcar D7/D8 como resueltos en `Plan_de_Implementación_Refactor_Modal_Programa_Académico_y_Publicar_Material.md` — hecho (D7/D8 marcados `[x]` líneas 547-548), el checkbox había quedado desincronizado hasta la verificación de `sdd-verify`
- [x] 5.6 `npm run test:all` corrido — **853 tests, 825 pass, 25 fail, 6 test suites en rojo.** Verificado que las 6 suites que fallan (`App.routing.test.ts`, `components/FilaEstudiante.test.tsx`, `components/ModalImportacionMasiva.test.tsx`, `components/ModalRegistrarPago.test.tsx`, `components/academico/ProgresoResumenCard.test.tsx`, `servicios/pagosApi.complementaria.test.ts`) NO tienen ninguna dependencia de código de este change (grep confirmó cero imports de `asignacion`/`jornadaRepository`/`AsignacionesView`) — son fallas preexistentes del working tree del usuario (varios de esos archivos ya aparecían modificados en el git status inicial de la sesión, antes de tocar nada). No corregidas por estar fuera de alcance de este change
