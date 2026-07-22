# Log de errores/incidentes — sesión módulo 12 (Agenda), 2026-07-08

## 1. Subagente de 12.3 cortado por límite de sesión de API

- **Síntoma**: el subagente delegado para 12.3 terminó abruptamente con `You've hit your session limit · resets 9:50pm (America/Bogota)`, justo antes de escribir el test RED.
- **Causa**: límite de la plataforma, no un error de código.
- **Resolución**: se reanudó el mismo agente vía `SendMessage` (usando su `agentId`), con un mensaje que resumía exactamente dónde había quedado (decisión ya tomada: Opción A) y las instrucciones restantes. Terminó exitosamente en background.
- **Estado**: RESUELTO. No requiere acción futura salvo repetir el mismo patrón (reanudar, no relanzar desde cero) si vuelve a pasar.

## 2. Falla preexistente aislada durante el barrido de 12.3

- **Síntoma**: `jornadaContextService.test.ts` ("construye opciones reales... instructores activos") falla en el barrido amplio de `servicios/academico` + `vistas/admin`.
- **Causa**: preexistente, no relacionada con 12.3. El propio subagente lo confirmó con `git stash push` (aislando sus cambios) + re-run: la falla persiste igual sin los cambios de 12.3.
- **Resolución**: ninguna aplicada en esta sesión — está fuera de alcance de 12.2/12.3/12.4. Queda en `KNOWN_ISSUES.md` para atender en una subtarea futura (posiblemente 12.7, que ya toca `jornadaContextService.ts` por el hardcode de espacio único).
- **Estado**: NO RESUELTO, fuera de alcance, documentado.

## 3. Mojibake (codificación corrupta) preexistente en `firestore.rules`

- **Síntoma**: al revisar el diff completo de `firestore.rules` tras el cambio de 12.2, se encontraron comentarios con codificación corrupta: `acadÃ©mico` en vez de `académico`, `â€”` en vez de `—`, etc.
- **Causa**: no causada por esta sesión. El diff contra `HEAD` incluye una cantidad grande de cambios sin commitear de sesiones anteriores (visible en `git status` desde el inicio de esta sesión); el mojibake ya estaba en esas líneas antes de que el subagente de 12.2 tocara el archivo (confirmado línea por línea: las líneas "-" removidas del diff ya tenían el texto correcto, las líneas "+" con mojibake son parte del estado previo del working tree, no un cambio nuevo de 12.2).
- **Impacto**: cosmético únicamente — son comentarios, no afectan la lógica de seguridad ni la compilación de las reglas.
- **Resolución**: ninguna aplicada, fuera de alcance del módulo 12. Reportado al usuario en el chat.
- **Estado**: NO RESUELTO, cosmético, bajo impacto, documentado en `KNOWN_ISSUES.md`.

## 4. Puerto de emulador de Firestore ocupado (12.2)

- **Síntoma**: al re-correr el emulador tras un corte del ciclo RED, un proceso Java quedó ocupando el puerto 8080.
- **Resolución**: se mató el proceso (PID) y se volvió a correr sin problema.
- **Estado**: RESUELTO, sin impacto en el resultado final.

## 5. Sesión sin respuesta del usuario (no es un error de código)

- **Síntoma**: tras cerrar 12.4 y preguntar si continuar con 12.5, el mismo Stop hook se disparó 4 veces consecutivas sin contenido nuevo del usuario.
- **Interpretación**: la sesión quedó efectivamente idle/abandonada por el usuario en ese punto. No se avanzó 12.5 (no había confirmación), y se procedió a generar esta documentación de cierre según indica el propio hook.
- **Estado**: sin acción de código pendiente por este motivo; ver `HANDOVER.md` para continuidad.
- **Causa raíz identificada (2026-07-09, desde otra sesión)**: NO fue el usuario ignorando esta sesión. En paralelo, el usuario tenía otra ventana de Claude Code abierta sobre el mismo repo, configurando hooks de documentación de sesión (`SessionStart`/`Stop` en `.claude/settings.json`). Los hooks de proyecto son config **compartida y con recarga en vivo**: en el momento en que esa otra sesión guardó el hook `Stop`, empezó a aplicarse también acá, en esta sesión, de inmediato — sin que nadie la agregara desde esta conversación. Como el usuario estaba atendiendo la otra ventana, acá no hubo respuesta, el hook insistió, y esta sesión generó los 10 archivos de cierre siguiendo su propia instrucción, cortando el trabajo de 12.5–12.12 a mitad de camino.

## 6. Gotcha de infraestructura: hooks de proyecto son globales por repo, no por sesión

- **Síntoma**: ver ítem 5. Un hook agregado a `.claude/settings.json` desde una sesión afecta de inmediato a cualquier otra sesión de Claude Code abierta sobre el mismo repositorio (recarga en vivo del watcher de settings).
- **Impacto**: agregar un hook `Stop`/`SessionStart` mid-trabajo puede interrumpir sesiones ajenas en progreso sin aviso — no hay aislamiento por ventana/pestaña.
- **Resolución en esta sesión**: el hook `Stop` recién agregado se retiró de `.claude/settings.json`; se reemplazó por una instrucción en el `CLAUDE.md` del proyecto (mismo archivo compartido, pero sin ejecución forzada por turno — el modelo decide cuándo aplica, no se dispara mecánicamente en sesiones ajenas en medio de una tarea).
- **Estado**: RESUELTO para esta instancia. **Recomendación a futuro**: antes de agregar/editar hooks de `Stop`/`PreToolUse`/`PostToolUse` a nivel proyecto, confirmar si hay otras ventanas de Claude Code abiertas sobre el mismo repo.
