# Tasks: Persistencia real de Programa/Ejecución + gestión de clases

## Phase 1: Foundation — `programaRepository.ts`

- [x] 1.1-1.6 RED→GREEN real: `programaRepository.ts` nuevo — `guardarPrograma`/`listarProgramasPorTenant`, memoria y Firestore real, mismo patrón que `jornadaRepository.ts`. Ruta confirmada `tenants/{tenantId}/programasAcademicos/{id}` (ya cubierta por reglas existentes). 4/4 tests verde

## Phase 2: Conectar persistencia real en `AsignacionesView.tsx`

- [x] 2.1-2.4 RED→GREEN real: nuevo prop `repositoryPrograma` (inyectable, default `programaRepository`); `guardarPrograma()` ahora llama `repositoryPrograma.guardarPrograma(programaReal)` + `repositoryJornada.guardarEjecucion(ejecucion)`
- [x] 2.5/2.6 RED→GREEN real: `useEffect` de montaje lee `listarProgramasPorTenant(tenantId)`, agrega programas reales a la lista sin duplicar, mantiene `programaInicial` si no hay reales. **Limitación anotada**: `ProgramaAcademico` persistido no guarda horario/sede/instructor (viven en `EjecucionPrograma`, no unido acá) — el programa releído muestra nombre/descripción reales pero horario en blanco por ahora
- [x] 2.7 `AsignacionesView.test.tsx` completo — **19/19 verde, 0 regresiones** sobre los 18 tests anteriores + 2 nuevos

## Phase 3: Vista "Mis clases" (`MisClasesView.tsx`)

- [x] 3.1-3.6 RED→GREEN real: `MisClasesView.tsx` nuevo — lista jornadas del programa (filtro por `programaId`, orden por fecha), muestra material asignado (filtro directo por `jornadaId`, no se reusó `agruparClasesAcademicas` porque esa colapsa por bloque recurrente y acá se necesita cada ocurrencia individual), botón de transición de estado (confirmar/iniciar/cerrar) según `jornadaService.ts`. 3/3 tests verde
- [x] 3.7 Wiring: componente separado (no sección embebida), montado dentro de `AsignacionesView.tsx` en modo `embedded`, pasando `programaSeleccionado.id`

## Phase 4: Investigar y fusionar flujos de publicar

- [x] 4.1 Confirmado con evidencia de código (dos `onClick={publicar}`): la duplicación real es "Clase activa" vs "Paso 3B · Envío" formulario plano coexistiendo en modo embedded — no embedded-vs-standalone (esa separación ya era limpia vía `if (embedded) { return... }`)
- [x] 4.2 Diseño actualizado en `design.md` — "Paso 3B" queda gateado a `!embedded`; "Clase activa" (carrusel + tarjeta/modal + lote) es el único flujo de publicar en Centro de Estudios embebido
- [x] 4.3-4.4 RED→GREEN real: `asignarRecursoSeleccionado()` ahora agrega el recurso a `recursosLoteIds` en vez de abrir un segundo flujo; botón viejo "Publicar material" gateado a `{asignacionEditandoId && (...)}` (solo visible editando); `asegurarJornadaParaPreview` gana `registrarAuditoria` (antes sin efectos secundarios); `publicarLote()` ahora también puebla `asignacionesPublicadas` (reconstruye desde `respuesta.created` + claves determinísticas) para preservar listado/duplicados/edición que antes solo alimentaba el flujo viejo
- [x] 4.5 `AsignacionesView.test.tsx` completo — **20/20 verde, 0 regresiones** (incluye 3 tests reescritos para usar el flujo de lote en su paso de creación)

## Phase 5: Regresión y cierre

- [x] 5.1 Confirmado: `firestore.rules:230-235` ya cubre `tenants/{tenantId}/programasAcademicos/{programaId}` — `read: authenticated() && tenant match`, `write: isAdmin() && tenant match` — sin cambios necesarios
- [x] 5.2 `npm test -- --runInBand` en verde: 7 suites tocadas (`programaRepository`, `MisClasesView`, `AsignacionesView`, `jornadaRepository`, `programaService`, `agendaAcademicaService`, `Horarios`) — **50/50 tests, 0 fallos**
- [x] 5.3 `npm run build` — build exitoso (warnings preexistentes de chunk-size y "use client", no relacionados a este change)
- [x] 5.4 `design.md` ya actualizado durante el apply con el hallazgo corregido de fusión de flujos; `spec.md` sin desviaciones adicionales detectadas

## Phase 6: Correcciones de sdd-verify (2 CRITICAL encontrados con ejecución real)

- [x] 6.1 Regresión confirmada: `vistas/CentroEstudios.test.tsx` (~líneas 201, 212) sigue esperando el botón "Publicar material" en modo embedded, removido en Fase 4. Actualizadas esas aserciones al flujo único (lote) fusionado: recurso queda `checked` en el checklist de Materiales, y "Publicar en lote" pasa de deshabilitado a habilitado. **9/9 verde**
- [x] 6.2 Bug confirmado (probado con test descartable real): `MisClasesView.tsx` llamaba `cerrarJornada()` directo, que exige `asistenciaRegistrada===true` y `objetivosImpartidos.length>0` — nunca seteados, así que "Cerrar" siempre lanzaba. RED→GREEN real: reusado el patrón de `JornadasView.tsx` (checkboxes de asistencia/objetivos por fila + `marcarPendienteCierre()` antes de `cerrarJornada()`) en vez de duplicar un formulario nuevo. 2 tests nuevos (cierre exitoso y error sin registrar). **5/5 verde** en `MisClasesView.test.tsx`
- [x] 6.3 Regresión corrida: 11 suites (Fase 5 + `CentroEstudios.test.tsx` + `JornadasView.test.tsx` + `jornadaService.test.ts` + `closeJornada.test.ts`) — **80/80 tests, 0 fallos**. `npm test -- --runInBand` completo también corrido: 850 passed/25 failed/3 skipped de 878 — los 25 fallos son en 6 suites no relacionadas (pagos, usuarios, ProgresoResumenCard, App routing) con archivos fuente ya modificados antes de esta sesión (confirmado con `git status`); ninguna referencia a `MisClasesView`/`jornadaService`/`CentroEstudios` — preexistentes, fuera de alcance de este change
- [x] 6.4 `design.md` actualizado: Data Flow de "Mis clases" corregido para reflejar `marcarPendienteCierre` + `cerrarJornada`, tabla de File Changes ampliada, y nueva sección "Corregido durante fix-up de sdd-verify (Fase 6)" documentando la desviación consciente de NO usar `cerrarJornadaConPrograma`/`advanceCiclo` (requeriría un getter de `EjecucionPrograma` por id que no existe hoy en `jornadaRepository.ts`) — queda anotado como limitación conocida, no bug
