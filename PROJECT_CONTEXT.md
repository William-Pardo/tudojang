# Contexto del proyecto — Tudojang

Plataforma multi-tenant para academias de artes marciales (React + TypeScript + Firebase/Firestore, Cloud Functions en `functions/`). Este archivo cubre el contexto relevante para la sesión del 2026-07-08; para historia completa del módulo académico ver `CIERRE CENTRO DE ESTUDIOS.md` (documento maestro de cierre del "Centro de Estudios", en curso desde hace varias sesiones).

## Módulos activos relevantes a esta sesión

### Centro de Estudios (en curso, no es el foco de esta sesión)

Gran módulo académico: programas, jornadas, asignaciones de material, biblioteca (Google Drive), progreso de estudiantes. Estado documentado en `CIERRE CENTRO DE ESTUDIOS.md`, secciones 1–11. La sección 11 (rediseño UX unificado de Programa/Publicar material/Mis Clases) tiene sus 9 fases completas al momento de esta sesión.

### Agenda — módulo 12, foco de esta sesión

Requisito de negocio en `Mejora del módulo Agenda.txt`: convertir Agenda en una vista semanal tipo parrilla (7am–10pm, navegación entre semanas) con edición granular de una sola clase vía modal (pestañas Programa/Materiales), reutilizando la lógica de Centro de Estudios sin duplicarla, con permisos por rol, validación de disponibilidad, soft delete, auditoría y concurrencia.

**Hallazgo crítico de esta sesión**: existía un documento previo (`PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md`) que describía un sistema paralelo ("Sistema B") dado por completo en sus 10 etapas, pero que la auditoría confirmó **huérfano y roto** — nunca persiste en Firestore, sin consumidores reales en producción. El sistema real y vigente para Programa/Jornada/Asistencia es `models/academico/*` + `servicios/academico/*`. Ver `SESSION_SUMMARY.md` y `HANDOVER.md` para el detalle completo de esta decisión.

## Roles del sistema

`enum RolUsuario` (`tipos.ts`): `Admin`, `Editor`, `Asistente`, `Estudiante`, `Tutor`, `SuperAdmin`. No existe un rol "Maestro" separado — el maestro asignado a una jornada se identifica por el campo `instructorId` (uid de Firebase Auth) comparado contra el usuario autenticado, sin importar si su rol es Editor o Asistente. `isAdmin()` en `firestore.rules` = `Admin`/`SuperAdmin`; `isInstructor()` = `Admin`/`Editor`/`Asistente`/`SuperAdmin`.

## Convención de trazabilidad del proyecto

Todo trabajo relevante se registra en un archivo `CIERRE ____.md` correspondiente, con formato TDD obligatorio (RED/GREEN/REFACTOR/VERIFY/TRACE) y un bloque `### Registro de cierre` por tarea completada (fecha, responsable, ciclos, comandos, resultado, archivos, riesgos, estado final). Ver la cabecera de `CIERRE CENTRO DE ESTUDIOS.md` para el protocolo exacto — el módulo 12 (Agenda) sigue el mismo protocolo.

## Preferencias de trabajo del usuario (relevantes para cualquier sesión)

- Nunca ejecutar `npm run build` como parte de cada cambio chico.
- No commitear salvo pedido explícito; en el módulo 12 específicamente, el usuario pidió revisar el diff acumulado recién al terminar todo el módulo, no subtarea por subtarea.
- Prefiere que el trabajo de código real (no exploración/documentación) se delegue a subagentes, y que el orquestador verifique el resultado leyendo el diff antes de reportarlo como cerrado — no basta con el resumen que da el subagente.
