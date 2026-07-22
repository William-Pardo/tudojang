# Recomendaciones — al cierre de la sesión del módulo 12 (Agenda), 2026-07-08

## Inmediato (próxima sesión)

1. **Confirmar si continuar con 12.5** (auditoría completa: rol + valor anterior/nuevo + fuente del cambio) — quedó preguntado sin respuesta al cierre de esta sesión.
2. Seguir el orden ya planificado en `CIERRE CENTRO DE ESTUDIOS.md`: 12.5 → 12.6 → 12.7 → 12.8 → 12.9 → 12.10 → 12.11 → 12.12. El orden importa: 12.7 (componentes reutilizables) es prerequisito razonable de 12.9 (modal), y 12.8 (parrilla) es prerequisito de 12.9 también.

## Antes de tocar 12.6 (guardas de eliminación)

Revisar primero todos los usos actuales de `eliminarJornadasEnLote` (hoy solo en `AsignacionesView.tsx` para limpiar previews) antes de decidir si se extiende esa función con guardas o se crea una función separada `desactivarJornada` — el propio checklist de 12.6 ya sugiere esta segunda opción como más segura.

## Antes de tocar 12.7 (componentes reutilizables)

Resolver primero el hardcode de `jornadaContextService.ts:83` (`espacio` único `'tatami-1'`), porque el modal de edición (12.9) va a necesitar selección real de sede/espacio y hoy no la tiene disponible.

## Sobre el diff acumulado

El usuario pidió explícitamente NO revisar/commitear subtarea por subtarea, sino esperar a que el módulo 12 completo (12.1–12.12) esté cerrado. Recomendación: al llegar a 12.12 (validación final), antes de proponer un commit, generar un resumen del diff completo agrupado por subtarea (ya existe la base en `CHANGELOG.md`, que se puede ir actualizando en cada subtarea nueva) para facilitar la revisión humana de un diff que para entonces va a ser grande.

## Sobre `PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md` y el Sistema B

Más allá del banner "SUPERADO" ya agregado, considerar (a decisión del usuario, no ejecutado en esta sesión):
- Archivar formalmente el change `openspec/changes/clase-en-vivo-checkin-trigger-agenda/` (ya lo propone su propio `tasks.md`, Fase 5, sin implementar).
- Evaluar si eliminar directamente los 6 archivos huérfanos (`servicios/cohortesApi.ts`, `jornadasApi.ts`, `agendaManualApi.ts`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, `progresoClaseApi.ts`) y sus tipos en `tipos.ts`, dado que no tienen consumidores reales fuera de sus propios tests (confirmado en la auditoría 12.1) — esto es una decisión de limpieza de repo, no bloqueante para el módulo 12, y debería tratarse como una tarea aparte, explícitamente autorizada por el usuario antes de borrar código.

## Sobre la deuda de auditoría del código (no del módulo 12)

`jornadaContextService.test.ts` tiene una falla preexistente no relacionada con esta sesión. No se investigó a fondo por estar fuera de alcance — si 12.7 termina tocando ese archivo (por el hardcode de espacio), aprovechar para diagnosticar esa falla en la misma pasada.

## Meta-recomendación sobre el proceso de esta sesión

El patrón de "delegar a subagente con contexto completo + verificar el diff real antes de reportar como cerrado" funcionó bien las 3 veces que se usó (12.2, 12.3, 12.4) — se detectaron 0 discrepancias entre lo reportado por los subagentes y el código real verificado. Mantener este patrón para las subtareas restantes en vez de confiar ciegamente en los resúmenes.
