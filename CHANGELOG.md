# Changelog — Módulo 12 (Mejora del módulo Agenda)

Formato: por subtarea, no por commit (nada de esto está commiteado todavía — ver `HANDOVER.md`, sección "reglas de trabajo", punto 3).

## [12.4] — 2026-07-08 — Concurrencia optimista al guardar jornada

### Added
- `ConflictoConcurrenciaError` (clase) y `MENSAJE_CONFLICTO_CONCURRENCIA` en `servicios/academico/jornadaRepository.ts`.
- `GuardarJornadaOpciones` con `actualizadoEnEsperado?: string`; `guardarJornada` ahora acepta un 2do parámetro opcional.

### Changed
- `guardarJornada` rechaza la escritura (en vez de sobrescribir en silencio) si el `actualizadoEn` vivo en Firestore difiere del que la vista tenía al leer la jornada.
- `MisClasesView.tsx` (3 call sites: `transicionar`, `cancelarClase`, `reprogramarClase`) y `JornadasView.tsx` (`registrarCambio`) capturan `ConflictoConcurrenciaError` y muestran el mensaje de negocio.

### Notes
- Retrocompatible: sin el 2do parámetro, comportamiento idéntico al anterior.

## [12.3] — 2026-07-08 — Disponibilidad de maestro y sede unificada

### Fixed
- `existeConflictoHorario` no detectaba choques del mismo instructor en sedes/espacios distintos (la query filtraba por `sedeId`+`espacioId`, excluyendo esos documentos antes de evaluarlos). Ahora filtra solo por `fecha` y evalúa el solape en memoria.

### Changed
- `existeConflictoHorario`: `Promise<boolean>` → `Promise<{ hayConflicto: boolean; motivo?: 'instructor' | 'espacio' }>`.
- Nuevo helper exportado `mensajeConflictoHorario(resultado, jornada)` con textos específicos: "El maestro ya tiene una clase asignada en este horario." / "La sede seleccionada no está disponible entre HH:MM y HH:MM."
- `JornadasView.tsx` y `MisClasesView.tsx` actualizados a los 3 call sites del nuevo shape.

## [12.2] — 2026-07-08 — Permisos "maestro asignado"

### Fixed
- `firestore.rules`, bloque `jornadas`: cualquier `isInstructor()` del tenant podía editar/cancelar la clase de cualquier otro maestro. Ahora exige `resource.data.instructorId == request.auth.uid`, salvo `isAdmin()`.

### Added
- Helper `puedeEditarJornada(jornada, usuarioId, esAdmin)` en `MisClasesView.tsx`, gateando 4 bloques interactivos.
- Prop `esAdmin` en `MisClasesView`, alimentada desde `AsignacionesView.tsx`.
- 6 tests nuevos de reglas en `functions/test/firestore-rules.behavior.test.js`.

## [12.1] — 2026-07-08 — Auditoría técnica del módulo Agenda

### Added
- Sección "## 12. Mejora modulo Agenda" en `CIERRE CENTRO DE ESTUDIOS.md`, con diagnóstico completo, tabla de estado real por requisito, y 12 subtareas registradas.
- Banner "SUPERADO" en `PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md`.

### Discovered
- El "Sistema B" (`servicios/cohortesApi.ts` y hermanos) está huérfano y no es el sistema real en producción — ver `PROJECT_CONTEXT.md`.
