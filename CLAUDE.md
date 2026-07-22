# CLAUDE.md — Tudojang

## Protocolo de cierre de sesión — documentos de sesión

Antes de terminar una sesión (el usuario dice "listo", "terminamos", "eso es todo",
o de cualquier otra forma indica que no sigue trabajando por ahora), regenerá estos
10 archivos en la raíz del proyecto con datos consistentes y coherentes entre sí,
reflejando el trabajo real hecho en la sesión (revisá `git status`/`git log`,
resultados de tests, y los cambios efectivamente aplicados):

- `SESSION_SUMMARY.md` — qué se hizo en esta sesión
- `HANDOVER.md` — estado para retomar en la próxima sesión
- `PROJECT_CONTEXT.md` — contexto general del proyecto (objetivo, stack, convenciones)
- `CODEBASE_SUMMARY.md` — mapa del código (módulos, responsabilidades)
- `TEST_REPORT.md` — estado de los tests (pass/fail, cobertura si aplica)
- `ERROR_LOG.md` — errores/bugs encontrados durante la sesión
- `CHANGELOG.md` — cambios de esta sesión en formato changelog
- `TECHNICAL_DEBT.md` — deuda técnica identificada o generada
- `KNOWN_ISSUES.md` — problemas conocidos sin resolver
- `RECOMMENDATIONS.md` — próximos pasos sugeridos

No es opcional si la sesión hizo cambios reales al código. Si no se hizo ningún
cambio sustantivo, no regenerar por regenerar — mantené los archivos existentes.

Al INICIO de sesión, un hook `SessionStart` ya chequea automáticamente si falta
alguno de estos 10 archivos y te lo va a recordar si corresponde — no hace falta
verificarlo manualmente.
