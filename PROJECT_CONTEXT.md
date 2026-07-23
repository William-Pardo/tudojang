# PROJECT_CONTEXT — Tudojang

## Qué es
Plataforma **multi-tenant** (SaaS) para academias de taekwondo / artes marciales. Cada club es
un `tenant`. Gestiona estudiantes, finanzas, agenda de clases, asistencia, y un **Centro de
Estudios** (biblioteca de material, asignaciones, quizzes, progreso del alumno visible para el
acudiente).

## Stack
- **Frontend**: React + TypeScript + Vite. Estado por contexto (`context/DataContext.tsx`).
  Tailwind. Build a `dist/`.
- **Backend**: Firebase — Firestore (datos), Auth (identidad), Storage, Cloud Functions
  (`functions/`, Node). Pagos con Wompi. Video vía YouTube (se dejó de proxear Drive por costo).
- **Tests**: Jest (app + 2 suites de functions), `node:test` (functions + scripts operativos),
  emulador de Firestore para reglas. Cypress (E2E, pausado).
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`). Push a `main` → gate de pruebas →
  deploy a producción (hosting + reglas + functions).

## Convenciones (importantes)
- Sistema académico REAL: `models/academico/*` + `servicios/academico/*` (`JornadaInstruccion`,
  `ProgramaAcademico`, `EjecucionPrograma`, `AsignacionAcademica`, `RecursoAcademico`). Un sistema
  paralelo viejo ("Sistema B": `cohortesApi`, `jornadasApi`, etc.) está **huérfano/superado** —
  no usar.
- Rol **Tutor** = padre/acudiente (nunca instructor). Identidad Tutor→Estudiante por
  `estudiante.tutor.correo == request.auth.token.email`. **Todo asume correos en minúsculas.**
- Colecciones por tenant: `tenants/{t}/{jornadas,asignaciones,recursos,quizzes,programasAcademicos,
  actividadLogs,metricasEstudiante,vinculos,…}`. `estudiantes` es colección RAÍZ (con `tenantId`).
- **Nunca** `npm run build` salvo pedido explícito. Commits en conventional commits, **sin**
  atribución de IA.

## Documento maestro del Centro de Estudios
`CIERRE CENTRO DE ESTUDIOS.md` — historia y cierre módulo por módulo (incluye el módulo 12,
Agenda). `ACCIONES_PENDIENTES.md` — registro vivo de hallazgos, decisiones y su estado.

## Estado al 2026-07-22
Las 7 cadenas del Centro de Estudios tienen cobertura de integración. Los 4 hallazgos de producto
abiertos fueron decididos e implementados. Ver `SESSION_SUMMARY.md`, `HANDOVER.md`.

## Testing — patrón de integración
`jest.mock('firebase/firestore', () => require('test-utils/fakeFirestore').crearApiFirestoreFake())`
+ mock de `firebase/config` (`isFirebaseConfigured: true`). El fake es un Firestore en memoria con
semántica real (paths, subcolecciones, `where` con field paths anidados, `orderBy`, `writeBatch`,
bloqueo optimista). Servicios/repositorios/componentes corren reales contra él.
