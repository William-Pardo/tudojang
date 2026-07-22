# Deuda técnica registrada — sesión módulo 12 (Agenda), 2026-07-08

Deuda declarada conscientemente por los subagentes (no descubierta por accidente), documentada en detalle en cada `### Registro de cierre` de `CIERRE CENTRO DE ESTUDIOS.md`. Resumen aquí para referencia rápida.

## De 12.2

- Ninguna deuda nueva relevante. `JornadasView.tsx` no se tocó porque construye siempre la jornada en memoria con `instructorId = usuario.id` — el gap de permisos no existe ahí (el gating sería un no-op).

## De 12.3

1. `confirmJornada.validarConfirmacionJornada` sigue desconectada de toda UI — **decisión consciente** (Opción A elegida en vez de Opción B), no un pendiente olvidado. Requeriría armar un `ContextoConfirmacionJornada` completo (capacidad, disciplinas, sedes permitidas, reservas) en cada call site.
2. Mocks de `AsignacionesView.test.tsx` y hermanos no actualizados al nuevo shape `{ hayConflicto, motivo }` de `existeConflictoHorario` (siguen devolviendo `boolean`). Sin impacto funcional — esa vista no invoca ese método (31/31 tests verdes).
3. Cuando coinciden instructor Y espacio a la vez, el motivo devuelto es `'instructor'` (prioridad de diseño). No hay un tercer motivo "ambos". Extensible con un tercer valor de union type si se necesita a futuro.
4. La query de `existeConflictoHorario` ahora trae todas las jornadas del tenant en esa fecha (antes filtraba también por sede/espacio) — trade-off inherente a la Opción A. Sin evidencia de problema de volumen/performance hoy.

## De 12.4

1. Ventana de carrera inherente al patrón `getDoc`+`setDoc` (vs. `runTransaction`) — aceptada conscientemente para el alcance de 12.4 (evitar pisado silencioso en escala de minutos, no atomicidad dura a nivel milisegundo). La atomicidad dura (sección 18 del documento de mejora) queda como item futuro que podría migrar a `runTransaction`.
2. `guardarEjecucion` (entidad `EjecucionPrograma`, no `JornadaInstruccion`) NO recibió bloqueo optimista — fuera de alcance de 12.4.
3. `JornadasView.tsx` es un flujo demo que construye la jornada en memoria sin leerla de Firestore antes — el conflicto real es casi imposible ahí, pero se cableó el mecanismo por consistencia.
4. Si un documento legado no tiene `actualizadoEn`, no se bloquea la escritura (no hay con qué comparar) — decisión deliberada para no romper documentos viejos.

## Preexistente (no de esta sesión, pero relevante para el módulo 12)

- `eliminarJornadasEnLote` en `jornadaRepository.ts` es **hard delete real**, hoy usado solo para limpiar previews en `AsignacionesView.tsx`. Riesgo directo si se reutiliza para "eliminar clase" desde el futuro modal de Agenda (12.6/12.9) sin las guardas que pide `Mejora del módulo Agenda.txt` (no borrar si hay asistencia registrada u operación previa en Clase en Vivo).
- `jornadaContextService.ts:83` hardcodea un único espacio `'tatami-1'`, pese a existir `EspaciosView.tsx`/`espacioService.ts` reales. Bloquea selección real de sede/espacio en el futuro modal de edición (12.7).
- `registrarAuditoria` no guarda `rol` del usuario ni valor anterior/nuevo por campo, solo el estado resultante; fallos de auditoría son silenciosos (`console.warn`, no bloquean el guardado). Pendiente de 12.5.
- Mojibake preexistente en comentarios de `firestore.rules` (ver `ERROR_LOG.md`) — cosmético, no bloqueante, no atendido por estar fuera de alcance.
