# Tasks: Adaptive Material Preview & Fail-Safe Material Type Resolution

- [x] 1. Type Models & Domain Enrichment
  - [x] 1.1 Enrich `AsignacionAcademica` and `AsignacionCentroEstudios` with `mimeType` and `tipoRecurso` in `models/academico/asignacion.ts` and `models/academico/asignacionService.types.ts`.
  - [x] 1.2 Update `publishAsignacion` in `servicios/academico/asignacionService.ts` to propagate `mimeType` and `tipoRecurso`.

- [x] 2. TDD: Canonical Material Type Resolver Utility
  - [x] 2.1 Create unit test `utils/academico/resolverTipoMaterial.test.ts` with test cases for YouTube videos, Drive videos, PDFs, images, presentations, quizzes, and legacy titles without extensions.
  - [x] 2.2 Implement `utils/academico/resolverTipoMaterial.ts` satisfying all scenarios with zero regressions.

- [x] 3. Assignment Wizard & Publish Consistency
  - [x] 3.1 Update `AsignarMaterialWizard.tsx` to preserve and display canonical type in drafts.
  - [x] 3.2 Update tests in `AsignarMaterialWizard.test.tsx` and `asignacionService.test.ts`.

- [x] 4. Adaptive Presentation Modal
  - [x] 4.1 Refactor `MaterialPreviewModal.tsx` to use `resolverTipoMaterial`.
  - [x] 4.2 Implement adaptive rendering branches: video (YouTube / HTML5), document (PDF), image viewer, presentation viewer, quiz.
  - [x] 4.3 Update `MaterialPreviewModal.test.tsx` to verify adaptive rendering for video without extension in title and other material types.

- [x] 5. Verification & Deployment
  - [x] 5.1 Run full test suite (`npx jest`) and TypeScript typecheck (`npm run typecheck`).
  - [x] 5.2 Conventional commit and push to `main` for deployment via GitHub Actions.
