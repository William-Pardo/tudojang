# Tasks: YouTube Video Embeddability Pre-Validation & Direct Resource Deletion

## Phase 1: TDD - YouTube Player Callbacks & Embeddability Detection
- [x] 1.1 Add tests to `YoutubePlayer.test.tsx` verifying `onErrorDetectado` and `onListo` callbacks when error or ready occurs.
- [x] 1.2 Update `components/academico/YoutubePlayer.tsx` to emit `onErrorDetectado` and `onListo`.

## Phase 2: TDD - ModalClasificarVideo Real-time Embed Validation
- [x] 2.1 Add tests in `ModalClasificarVideo.test.tsx` verifying live preview mounting, error blocking on code 150/101, and disabled submit button.
- [x] 2.2 Update `components/academico/ModalClasificarVideo.tsx` with live preview and validation guard.

## Phase 3: TDD - bibliotecaService.eliminarRecurso & Firestore Rules
- [x] 3.1 Add unit tests in `bibliotecaService.test.ts` for `eliminarRecurso`.
- [x] 3.2 Implement `eliminarRecurso` in `servicios/academico/bibliotecaService.ts`.
- [x] 3.3 Update `firestore.rules` to allow `isInstructor()` deletion of resources.

## Phase 4: TDD - Direct Resource Deletion in BibliotecaView
- [x] 4.1 Add test in `BibliotecaView.test.tsx` for deleting a direct video via `IconoEliminar`.
- [x] 4.2 Update `vistas/admin/BibliotecaView.tsx` to render `IconoEliminar` on `recursosDirectos` and handle deletion.

## Phase 5: Verification & Deploy
- [x] 5.1 Run full academic test suite (`npm run test:app`).
- [x] 5.2 Validate TypeScript compilation (`npx tsc --noEmit`).
- [ ] 5.3 Commit with conventional commit, push to main, and verify production deployment.
