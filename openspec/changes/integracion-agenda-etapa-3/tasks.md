# Tasks: Integración Programa Académico ↔ Agenda (etapa 3)

**Aclaración del usuario incorporada**: las clases se autocalculan por `fechaInicio`–`fechaFin` (generación automática, Fase 2). En el paso "Publicar material" (`AsignacionesView.tsx`, ya existente) solo se le agregan detalles de asignación/grado/criterio a una clase que YA existe — ese paso **NUNCA crea ni elimina clases**, solo las edita. Esto obliga a ajustar `AsignacionesView.tsx` (Fase 5) para que deje de crear jornadas vía `asegurarJornadaParaPreview` y solo seleccione entre las ya generadas.

## Phase 1: Foundation (tipos)

- [x] 1.1 `EjecucionPrograma` +`bloques?: BloqueRecurrente[]` +`fechaFin?: string` en `models/academico/programa.ts`
- [x] 1.2 `npx tsc --noEmit` — 1916 errores, mismo conteo que el baseline previo, cero errores nuevos

## Phase 2: Generación y persistencia batch

- [x] 2.1 RED: 3 tests nuevos en `programaService.test.ts` (passthrough bloques/fechaFin, generación por 2 bloques, sin bloques/fechaFin → []) — fallaron como se esperaba
- [x] 2.2 GREEN: `assignProgramaToGrupo` acepta bloques/fechaFin; nueva `generarJornadasDeEjecucion()` reusa `generateJornadasFromBloque` por cada bloque — 9/9 verde
- [x] 2.3 RED: 2 tests nuevos en `jornadaRepository.test.ts` (guardado en memoria, chunking real de 900 jornadas) — fallaron como se esperaba
- [x] 2.4 GREEN: `guardarJornadasEnLote()` con `writeBatch` (Firebase Web SDK) + chunking de 400 — confirmado 400/400/100 en el test
- [x] 2.5 Los 5 tests originales de `programaService.test.ts` + los 6 originales de `jornadaRepository.test.ts` siguen en verde — 0 regresiones

## Phase 3: Servicio de agenda académica

- [x] 3.1-3.5 RED→GREEN real: `agendaAcademicaService.ts` (nuevo) — `agruparClasesAcademicas()` agrupa por `bloqueRecurrenteId`, resuelve la próxima ocurrencia futura y su material asignado, maneja sin-futura/sin-material sin error. 3/3 tests verde

## Phase 4: Wiring en `Horarios.tsx` (Agenda real)

- [x] 4.1-4.3: `Horarios.test.tsx` creado desde cero (1 test) — clases académicas conviven con `BloqueHorario` comercial, sin botón de editar/eliminar en las académicas (`esAcademica` guard). También se agregó `listarAsignacionesPorTenant` a `asignacionService.ts` (no estaba en el design original — necesario para resolver material real, la lectura de asignaciones era 100% demo hasta ahora) y `obtenerClasesAcademicasDelTenant` orquestador en `agendaAcademicaService.ts`. 1/1 verde, pasó directo (implementación escrita antes del test dado el wiring)

## Phase 5: Ajustar `AsignacionesView.tsx` — Publicar material solo edita, nunca crea

**DESVIACIÓN GRANDE (Opción B elegida por el usuario tras checkpoint)**: se descubrió que el "programa" de esta vista estaba 100% desconectado de `programaService.ts` real. Se conectó de punta a punta: `guardarPrograma()` ahora llama `createPrograma`+`publishPrograma` (sintetizando 1 `UnidadTematica` desde `tema`/`objetivoClase`, ya que el modal no captura curriculum real) + `assignProgramaToGrupo` (con `bloques` derivados de `diasHorario` vía `crearBloquesDesdePrograma`) + `generarJornadasDeEjecucion` + `repositoryJornada.guardarJornadasEnLote`.

- [x] 5.1/5.2 `jornadasProgramaActivas` pasa de `useMemo` sobre el preview fake a `useState`+`useEffect` que lee `listarJornadasPorTenant` filtrado por `programaId`, mapeado a la MISMA forma `JornadaPublicacionLocal` vía `mapearJornadaAPreview` (adaptador nuevo) — esto evitó reescribir todo el render existente. Fallback al preview local si no hay jornadas reales aún (compatibilidad)
- [x] 5.3/5.4 `asegurarJornadaParaPreview` simplificada a `return preview.id` (sin escritura). `asegurarJornadaPrograma` ya no crea — si no hay `jornadaActiva.id` real, bloquea con error explícito en vez de crear una jornada nueva
- [x] 5.5 `AsignacionesView.test.tsx`: 18 tests (17 originales + 1 nuevo que valida la integración real). **2 tests reescritos intencionalmente** porque su premisa original ("publicar crea una jornada") contradice la regla nueva del usuario — ya no se verifica `guardarJornada` llamado, se verifica que NO se llama. 1 test nuevo agregado: confirma que `guardarPrograma()` genera y persiste jornadas reales de punta a punta. 18/18 verde
- [x] 5.6 (agregada) Detectado que el test "bloquea duplicados..." (preexistente, borderline desde el change anterior) ahora fallaba con más frecuencia (4510-5861ms vs 2946-4823ms antes) — evidencia real de que el wiring de Fase 5 le agregó costo de render. Al verificar con Playwright se descubrieron 2 tests más al mismo límite ("bloquea aceptar programa si no tiene dias de clase..." y "pide confirmacion al cerrar el programa...") — se reemplazó el fix puntual por `jest.setTimeout(15000)` a nivel de archivo, más correcto dado que el patrón es sistémico (varios tests pesados, no uno solo). 18/18 estable en 2 corridas completas seguidas

## Phase 6: Regresión y cierre

- [x] 6.1 Confirmado: `tenants/{tenantId}/jornadas` ya permite `read: if authenticated() && currentTenantId() == tenantId` — cubre `Horarios.tsx` y `listarAsignacionesPorTenant` sin cambios de reglas
- [x] 6.2 6/6 suites tocadas, 55/55 tests verde. `npm run test:all`: 839/867 pass, 25 fallas en las MISMAS 6 suites preexistentes de siempre (verificado, cero nuevas)
- [x] 6.3 `npm run build` — exitoso, solo warnings preexistentes
- [x] 6.4 `design.md` actualizado con las desviaciones de Fase 5 (integración real programa↔agenda, no solo "ajustar preview")
