# TECHNICAL_DEBT — 2026-07-22

Deuda identificada o generada esta sesión. Registro para referencia rápida; el detalle vive en
`ACCIONES_PENDIENTES.md`.

## Generada esta sesión (consciente, acotada)
- **`archiveRecurso` — chequeo de "usado" permisivo en modo mock.** El guard real (recurso debe
  haberse publicado en una clase) corre en la rama Firestore, cubierto por integración. En modo
  local sin Firebase queda permisivo (no hay asignaciones que consultar). Aceptable: modo mock =
  local/demo, no producción. Inyectable vía `deps.recursoFuePublicado` para tests.
- **"Quitar de la agenda" (archivar) no tiene UI de revisión/restauración.** El flag `archivada`
  oculta la jornada de la parrilla; el dato queda y los reportes la ven, pero no hay pantalla
  para listar/restaurar archivadas. Suficiente para el caso de uso pedido; ampliable.

## Preexistente, confirmada esta sesión
- **La identidad asume minúsculas en dos capas.** La query cliente Y `firestore.rules` (182,
  183, 489, 496) comparan correos como strings case-sensitive. El alta ya normaliza; falta una
  garantía estructural (p.ej. índice/campo normalizado) para que datos futuros no puedan romperlo.
- **`'America/Bogota'` hardcodeado** en varios lugares (schedulers, ventana de Clase en Vivo).
  Centralizar en una constante.
- **Tests de UI lentos** (`AsignarMaterialWizard`: 5-10s por navegar el wizard con userEvent).
  Se subió el timeout; no se aceleró el render. Deuda de performance de tests, no de correctitud.
- **`Tudojang.rar` (230 MB)** en el historial de `codex/asistente-hibrido-catalogo` la hace
  impusheable. Requiere reescritura de historial.

## Wart de entorno (no es deuda del código)
- `git commit` en Windows falla al crear refs `refs/codex/turn-diffs/checkpoints/…` por longitud
  de path. Los commits se completan igual. Limpiar/desactivar ese mecanismo si molesta.

## Saldada esta sesión
- Definición de "asignación completada" **duplicada** en 3 lugares → unificada en
  `avanceAsignacionCompletado`.
- Fallo de red del quiz **indistinguible** de "sin preguntas" → tres estados separados.
