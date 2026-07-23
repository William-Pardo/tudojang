# CHANGELOG

## [2026-07-22] — Integración Centro de Estudios + 2 bugs de prod + 4 hallazgos de producto

### Added
- Pruebas de integración de las 7 cadenas del Centro de Estudios (Biblioteca, Quiz, Identidad
  del acudiente, Agenda, Progreso/analítica, y las ya existentes de publicación y generación de
  jornadas). 12 suites / ~147 pruebas.
- `scripts/normalizar-correos.js` + test: migración idempotente de `correo`/`tutor.correo` en
  `estudiantes`, dry-run por defecto, con reporte de cobertura por tenant.
- `models/academico/actividad.ts`: `avanceAsignacionCompletado`, `UMBRAL_APROBACION_QUIZ` (70),
  `UMBRAL_CONSUMO_COMPLETADO` (80).
- `JornadaInstruccion.archivada?`, `jornadaRepository.archivarJornada()`, acción de auditoría
  `archivar`, `useEliminacionJornadaSegura.archivar()` + `error.ofrecerArchivar`, botón "Quitar
  de la agenda" en `AgendaView`.
- `bibliotecaService`: `RecursoNoPublicadoError`, `recursoFuePublicado` (inyectable),
  `recursoFuePublicadoEnFirestore`.
- `MaterialPreviewModal`: estado de error de carga del quiz + botón Reintentar.

### Fixed
- **`scoreUltimaEvaluacion`** devolvía el primer intento en vez del último (`sort` estable +
  empate de milisegundos). Ahora recorre con `>=`.
- **Normalización del correo del acudiente** en la importación masiva (antes solo el del alumno).
  Centralizado en el callable `crearEstudiante`.
- **Quiz reprobado ya no cuenta como asignación completada** (regla ≥70%).
- **Callejón sin salida en Agenda**: clase operada que no se puede eliminar ni cancelar → ahora
  se puede archivar (ocultar de la parrilla sin borrar ni cambiar estado).
- **`MaterialPreviewModal`**: fallo de carga del quiz ya no se confunde con "quiz sin preguntas".
- **Archivar recurso de Biblioteca**: exige que el recurso se haya usado (publicado en una clase).
- **Flake** de `AsignarMaterialWizard.test.tsx` por timeout → `jest.setTimeout(30000)`.

### Verified
- Diagnóstico de correos contra producción: 11 documentos, 0 afectados. No hay migración pendiente.
- Regresión final: 154 suites / 1628 pruebas / 0 fallos; typecheck 0.

### Commits (rama `fix/hallazgos-producto-centro-estudios`, pendiente de PR)
`51e70aa` progreso · `c7deb9c` quiz ≥70 · `39f4101` archivar jornada · `21f1738` estados del
quiz · `6faeb13` archivar recurso usado · `02b998c` fix del flake.

### Ya en `main` (PR #4 mergeado y deployado)
Cobertura de integración de Biblioteca/Quiz/Identidad/Agenda + los 2 bugs de producción + el
script de migración.

---

_(El changelog del módulo 12 — Agenda, sesiones de julio 08–19 — se movió al historial de
`CIERRE CENTRO DE ESTUDIOS.md`.)_
