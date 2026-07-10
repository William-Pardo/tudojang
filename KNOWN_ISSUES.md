# Issues conocidos — módulo 12 (Agenda), al cierre de la sesión 2026-07-08

## Bloqueantes para cumplir `Mejora del módulo Agenda.txt` (pendientes, subtareas 12.5–12.12)

1. **No existe la parrilla semanal** (12.8). `vistas/Horarios.tsx` es una grilla por día sin franja horaria 7am–10pm ni navegación de semanas. No hay ruta `/agenda`.
2. **No existe el modal de edición granular** con pestañas Programa/Materiales (12.7/12.9). Ni `JornadasView.tsx` ni `MisClasesView.tsx` lo cubren hoy.
3. **Auditoría incompleta** (12.5): `registrarAuditoria` no guarda `rol` del usuario ni valor anterior/nuevo por campo, y sus fallos son silenciosos.
4. **Hard delete peligroso sin guardas** (12.6): `eliminarJornadasEnLote` es borrado físico real, usado hoy solo para limpiar previews; sin guarda de "no borrar si hay asistencia u operación en Clase en Vivo".
5. **Ventana de Clase en Vivo no configurable** (12.10): `App.tsx` tiene el placeholder permanente `showClaseEnVivo = true`; no existen las constantes `LIVE_CLASS_OPEN_BEFORE_MINUTES`/`CLOSE_AFTER_MINUTES`.
6. **Hub Estudiantes no existe** (12.11): sin roster estudiante-jornada real (bloqueado además por el change `clase-en-vivo-checkin-trigger-agenda`, Fase 0, sin implementar). Decisión ya tomada: exponer solo servicio de lectura, no construir UI completa en este módulo.
7. **Espacio único hardcodeado** `'tatami-1'` en `jornadaContextService.ts:83`, bloqueando selección real de sede/espacio en el modal futuro.

## Ya resueltos en esta sesión (no reabrir sin evidencia nueva)

- Permisos "maestro asignado" no aplicados ni en frontend ni en backend → resuelto en 12.2.
- Choque de instructor entre sedes distintas no detectado → resuelto en 12.3.
- Sin concurrencia optimista (último que guarda gana en silencio) → resuelto en 12.4.

## Cosméticos / bajo impacto, no atendidos (fuera de alcance del módulo 12)

- Mojibake preexistente en comentarios de `firestore.rules` (`acadÃ©mico` en vez de `académico`). Ver `ERROR_LOG.md`.
- Falla preexistente en `jornadaContextService.test.ts` ("instructores activos"), no relacionada con esta sesión, aislada con `git stash` durante la verificación de 12.3.
- Ruido de tipos Chai/Cypress sobre `expect` de Jest en `tsc --noEmit` para archivos `*.test.ts(x)` — documentado desde sesiones anteriores del proyecto.

## Riesgo operativo abierto

El repo tiene un volumen grande de cambios sin commitear acumulados de sesiones previas (visible en `git status`), sumado ahora a los cambios del módulo 12. El usuario pidió explícitamente revisar y commitear todo junto al terminar el módulo 12 completo — hasta entonces, el working tree permanece con cambios pendientes de forma intencional. Ver `RECOMMENDATIONS.md`.

## Cierre prematuro de esta sesión por hook compartido (2026-07-09)

Esta sesión no terminó por decisión del usuario de pausar el módulo 12: un hook `Stop` agregado desde otra ventana de Claude Code abierta en paralelo sobre el mismo repo (config de proyecto compartida y con recarga en vivo) empezó a dispararse acá también, sin respuesta del usuario, y esta sesión generó su documentación de cierre siguiendo esa instrucción. **12.5–12.12 quedan pendientes y son el próximo paso**, no trabajo descartado. Detalle completo en `ERROR_LOG.md` (ítems 5–6) y `HANDOVER.md`.
