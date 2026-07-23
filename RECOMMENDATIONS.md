# RECOMMENDATIONS — 2026-07-22

## Inmediato (esta sesión / próxima)
1. **Abrir y mergear el PR** de `fix/hallazgos-producto-centro-estudios` → `main`. Esperar el
   check verde, mergear (deploya a prod). Borrar `test/integracion-progreso` después.
2. **Mirar el run de `main` en Actions** tras el merge. Si el deploy de functions falla por
   Cloud Scheduler, es esperado (hosting + reglas igual quedan). Si esta vez toca un scheduler y
   falla, ahí sí hay que atender el permiso.

## Corto plazo
3. **Verificar de verdad el permiso de Cloud Scheduler** (deployar un cambio en una función
   programada y confirmar que no falla). Es la única deuda de infra con impacto real.
4. **Borrar ramas viejas ya mergeadas** (`docs/permiso-scheduler`) y limpiar el wart de Codex
   (`refs/codex/turn-diffs/…`) si molesta al commitear.

## Producto (no urgente, pero conviene decidir)
5. El mensaje del estado "vacío" del quiz para el estudiante dice "es posible que tu maestro lo
   haya quitado". Revisar con el usuario si el copy es el deseado en todos los casos (también
   cubre "nunca se configuró").
6. Definir si "Quitar de la agenda" (archivar) necesita un lugar para **ver/restaurar** jornadas
   archivadas (hoy solo se ocultan; el dato queda, pero no hay UI para revisarlas).

## Calidad / testing
7. Los tests de UI con `userEvent` que navegan wizards son lentos (5-10s). Considerar
   `userEvent.setup({ delay: null })` **junto con** perfilar el render de `AsignarMaterialWizard`
   si la lentitud molesta (el `jest.setTimeout` sube el techo, no acelera).
8. Regla de oro confirmada esta sesión: al verificar por **mutación**, mutar la rama que el test
   REALMENTE recorre (integración = rama Firestore, no la rama mock).

## Cosas que NO hace falta hacer
- Migrar correos: el diagnóstico de prod dio 0 afectados. El script queda para importación
  masiva / restauración de backup.
- Cargar tutores para los 2 alumnos "sin acudiente" de Gajog: son datos de demo.
