# CODEBASE_SUMMARY — 2026-07-22

Mapa de la porción del Centro de Estudios (lo tocado/relevante en esta sesión). No es un mapa
completo del repo.

## Modelos — `models/academico/`
- `actividad.ts` — `ActividadLog`, `MetricasEstudiante`, `AvanceAsignacion`, y **la regla de
  "completada"**: `avanceAsignacionCompletado`, `UMBRAL_APROBACION_QUIZ` (70),
  `UMBRAL_CONSUMO_COMPLETADO` (80).
- `jornada.ts` — `JornadaInstruccion` (incluye `archivada?`), `BloqueRecurrente`.
- `asignacion.ts` — `AsignacionAcademica`, estados `borrador|publicada|cerrada|vencida`.
- `recurso.ts` — `RecursoAcademico`, `FichaAcademica`. `quiz.ts`, `programa.ts`.

## Servicios — `servicios/academico/`
- `actividadService.ts` — registra actividad, recalcula métricas por estudiante (usa
  `avanceAsignacionCompletado`). `calcularScoreUltimoQuiz` (fix: recorre con `>=`).
- `analisisProgresoService.ts` — analítica PURA: cruce asignación→jornada→programa,
  `escalarMetricasAPrograma`, dashboard "Por Material".
- `bibliotecaService.ts` — ciclo de vida del recurso. `archiveRecurso` exige recurso **usado**
  (`recursoFuePublicado` / `RecursoNoPublicadoError`).
- `quizService.ts` — banco de preguntas por recurso (`tenants/{t}/quizzes/{recursoId}`).
- `jornadaRepository.ts` — CRUD de jornadas: conflicto horario, bloqueo optimista
  (`ConflictoConcurrenciaError`), `eliminarJornadaSegura` (`EliminacionNoPermitidaError`),
  `archivarJornada`, auditoría.
- `asignacionService.ts`, `programaRepository.ts`, `tutorStudentResolver.ts` (identidad del
  acudiente), `invitacionService.ts`, `vinculoService.ts`, `progresoRepository.ts`.

## Hooks — `hooks/academico/`
- `useEliminacionJornadaSegura.ts` — flujo eliminar/cancelar/**archivar** una clase, con
  `error.ofrecerCancelar` / `error.ofrecerArchivar`.
- `useRegistrarActividad.ts` — registro declarativo de actividad (apertura, video, pdf, quiz).

## Vistas / componentes
- `vistas/admin/AgendaView.tsx` — parrilla semanal; filtra `archivada`; botón "Quitar de la agenda".
- `components/academico/MaterialPreviewModal.tsx` — preview de material; quiz con estados
  cargando/error+reintentar/vacío.
- `QuizView.tsx`, `QuizEditorModal.tsx`, `AsignarMaterialWizard.tsx`, `ModalEdicionJornada.tsx`,
  `PanelMetricasEstudiantes.tsx`, `ProgresoEstudianteCard.tsx`, `BibliotecaView.tsx`.

## Cloud Functions — `functions/`
- `academico/estudiantes.js` — callable `crearEstudiante` (valida límite del plan + **normaliza
  correos**). `academico/asistencia.js`, `academico/jornadasScheduler.js`,
  `academico/datosDemoProgreso.js`. `index.js` — registro de callables/schedulers/triggers.

## Scripts — `scripts/`
- `normalizar-correos.js` — migración de `correo`/`tutor.correo` (dry-run, idempotente, cobertura).
- `verificar-bundle-seguro.test.js`, `infraestructura-pruebas.test.js`.

## Infra de tests
- `test-utils/fakeFirestore.ts` — Firestore en memoria (client + admin). `crearApiFirestoreFake`,
  `sembrarDoc`, `leerDoc`, `listarPaths`, `limpiarFirestoreFake`.
