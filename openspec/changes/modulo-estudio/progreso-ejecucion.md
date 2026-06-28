# Registro de ejecución — modulo-estudio

Este archivo registra tareas completadas durante la ejecución cuando `tasks.md`
presenta problemas de codificación/mojibake que impiden parchearlo con seguridad.

## Completadas

- [x] 9.1 Implementar funciones puras de cálculo de progreso para PDF, video y quiz.
  - Archivos: `utils/progreso/calculos.ts`, `utils/progreso/calculos.test.ts`
  - Evidencia: `npm run test:app -- utils/progreso/calculos.test.ts`

- [x] 9.2 Crear base de `useProgressSync` con acumulación local, sincronización por intervalo,
  flush al desmontar y flush por `visibilitychange`.
  - Archivos: `hooks/academico/useProgressSync.ts`, `hooks/academico/useProgressSync.test.ts`
  - Evidencia: `npm run test:app -- hooks/academico/useProgressSync.test.ts`

- [x] 9.3 Crear base testeable de `consolidateProgress` para backend académico.
  - Archivos: `functions/academico/progreso.js`, `functions/academico/progreso.test.js`
  - Evidencia: `node --test functions/academico/progreso.test.js`

- [x] 9.4 Crear visor PDF base con rastreo de páginas únicas conectado a `useProgressSync`.
  - Archivos: `components/academico/PdfViewer.tsx`, `components/academico/PdfViewer.test.tsx`
  - Evidencia: `npm run test:app -- components/academico/PdfViewer.test.tsx`

- [x] 9.5 Crear reproductor video base con rastreo de segundos unicos conectado a `useProgressSync`.
  - Archivos: `components/academico/VideoPlayer.tsx`, `components/academico/VideoPlayer.test.tsx`
  - Evidencia: `npm run test:app -- components/academico/VideoPlayer.test.tsx`

- [x] 10.4 Implementar reanudacion de progreso para recursos PDF/video desde almacenamiento local o Firestore.
  - Archivos: `hooks/academico/useProgressSync.ts`, `hooks/academico/useProgressSync.test.ts`, `components/academico/PdfViewer.tsx`, `components/academico/PdfViewer.test.tsx`, `components/academico/VideoPlayer.tsx`, `components/academico/VideoPlayer.test.tsx`, `servicios/academico/progresoRepository.ts`, `servicios/academico/progresoRepository.test.ts`
  - Evidencia: `npm run test:app -- hooks/academico/useProgressSync.test.ts components/academico/PdfViewer.test.tsx components/academico/VideoPlayer.test.tsx servicios/academico/progresoRepository.test.ts`

- [x] 11.1 Crear vista `TutorDashboardView` con selector de estudiantes vinculados, resumen, alertas y controles de solo lectura.
  - Archivos: `vistas/tutor/TutorDashboardView.tsx`, `vistas/tutor/TutorDashboardView.test.tsx`
  - Evidencia: `npm run test:app -- vistas/tutor/TutorDashboardView.test.tsx`

- [x] 11.2 Implementar Security Rules para rechazar escrituras de progreso por usuarios con rol `Tutor`.
  - Archivos: `firestore.rules`, `functions/test/firestore-rules.behavior.test.js`
  - Evidencia RED: `node --test functions/test/firestore-rules.behavior.test.js` fallo en ruta real `tenants/{tenantId}/progreso/{uid}/asignaciones/{asignacionId}` antes de actualizar reglas.
  - Evidencia GREEN/TRIANGULATE: `node --test functions/test/firestore-rules.behavior.test.js` con 9/9 tests pasando; cubre estudiante escribiendo progreso propio, tutor vinculado leyendo sin escribir y tutor no vinculado sin lectura.
  - Evidencia final: `npm run test:firestore-rules`

- [x] 12.1 Crear E2E pilotable del flujo estudiante activado hacia Centro de Estudios vacío.
  - Archivos: `cypress/e2e/modulo-estudio-invitacion.cy.ts`, `context/AuthContext.tsx`, `context/AuthContext.test.tsx`, `servicios/academico/asignacionService.ts`, `servicios/academico/asignacionService.test.ts`, `vistas/CentroEstudios.tsx`, `vistas/CentroEstudios.test.tsx`
  - Evidencia RED: `npm run test:app -- vistas/CentroEstudios.test.tsx`, `npm run test:app -- servicios/academico/asignacionService.test.ts`, `npm run test:app -- context/AuthContext.test.tsx` fallaron antes de implementar estado vacío, fixture Cypress y bypass E2E.
  - Evidencia GREEN/TRIANGULATE: `npm run test:app -- vistas/CentroEstudios.test.tsx servicios/academico/asignacionService.test.ts`, `npm run test:app -- context/AuthContext.test.tsx`, `npx cypress run --spec cypress/e2e/modulo-estudio-invitacion.cy.ts`.
  - Nota: cubre el corte E2E disponible sin email real; el flujo completo admin invita -> link público de aceptación -> estudiante autenticado queda pendiente hasta crear pantalla/ruta pública de aceptación.
