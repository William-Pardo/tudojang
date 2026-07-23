# KNOWN_ISSUES — 2026-07-22

Problemas conocidos, sin resolver, al cierre de la sesión. (Los que se resolvieron esta sesión
están en `CHANGELOG.md` / `ERROR_LOG.md`.)

## 1. Permiso de Cloud Scheduler — verde ≠ verificado
El deploy de `functions` en `deploy.yml` históricamente falla por un permiso de Cloud Scheduler.
El PR #4 deployó **verde y completo**, PERO ese verde **no prueba** que el permiso esté
resuelto: probablemente ese deploy no tocó ninguna función programada (`iniciarJornadasPorHorario`,
`recordatoriosPagoDiarios`, etc.), así que Firebase nunca llamó al scheduler. **Sigue sin
verificarse de verdad.** Se confirmará el día que un deploy modifique una función programada.

## 2. Rol Tutor — resuelto en código, con una advertencia viva
El rol Tutor (padre/acudiente) fue arreglado end-to-end en sesiones previas (identidad por
`tutor.correo == token.email`). ESTA sesión encontró y cerró una causa raíz adicional: el correo
del acudiente se guardaba sin normalizar en la importación masiva. **Todo el sistema de
identidad asume minúsculas** — tanto la query cliente como `firestore.rules` (líneas 182, 183,
489, 496). Cualquier dato futuro con mayúsculas rompe las dos capas. El alta nueva ya normaliza;
el diagnóstico de prod dio 0 afectados.

## 3. Datos de demo en Gajog
2 de 3 alumnos de `escuela-gajog-001` no tienen objeto `tutor`. Confirmado por el usuario: son
**datos de demo**, no un hueco de carga real. No requiere acción.

## 4. `Tudojang.rar` (230 MB) bloquea una rama
La rama `codex/asistente-hibrido-catalogo` es impusheable para siempre por ese binario en el
historial. Requiere reescritura de historial o descartar la rama.

## 5. Wart de entorno (Windows + Codex)
`git commit` tira errores ruidosos `cannot lock ref refs/codex/turn-diffs/checkpoints/… Filename
too long`. Es un mecanismo de checkpoints de Codex cuyos paths exceden el límite de Windows. Los
commits **igual se completan** (verificar con `git log`). No afecta el repo; es solo ruido.

## 6. Ramas sin mergear
- `fix/hallazgos-producto-centro-estudios`: pusheada, PR pendiente.
- `test/integracion-progreso`: redundante (su commit ya viaja en la rama de fixes), borrar tras merge.
- `docs/permiso-scheduler`: ya mergeada vía PR #4; puede borrarse.

## 7. Centralizar `'America/Bogota'`
Sigue hardcodeado en varios lugares (schedulers, ventana de Clase en Vivo). Deuda menor.
