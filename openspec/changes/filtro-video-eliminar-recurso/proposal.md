# Proposal: YouTube Video Embeddability Pre-Validation & Direct Resource Deletion

## Problem Statement
1. **Unchecked External Embed Restrictions:**
   When an instructor or tenant administrator registers a YouTube video in `ModalClasificarVideo` or `BibliotecaView`, the system only verifies that the URL matches a valid syntax pattern (`parsearYoutubeVideoId`). However, YouTube videos frequently have syndication or Content ID restrictions set by copyright holders (e.g., LatinAutor - UMPG) or uploaders that disable embedded playback on third-party domains (error codes 150/101). The administrator is not alerted during resource registration, saving an unplayable video that fails when students access it in Centro de Estudios.

2. **Inability to Delete Direct Resources in Tenant Mode:**
   In `BibliotecaView.tsx`, resources synchronized from Google Drive have actions to edit and retire/delete (`IconoEliminar`). However, the list of `recursosDirectos` (direct videos) only renders preview and visualization report buttons. It lacks any deletion button or mechanism to remove broken or unwanted videos, and `bibliotecaService` lacks an `eliminarRecurso` deletion method.

## Proposed Changes
1. **Interactive Embeddability Pre-Validation (`ModalClasificarVideo`):**
   - Automatically mount an interactive preview player as soon as a syntactically valid YouTube ID is detected.
   - Capture YouTube Player API error codes (`onError` with codes 150/101 for embed/syndication blocks, 100 for private/not found, 2 for invalid ID).
   - If an error is detected, display a prominent error alert explaining the block and disable the "Guardar" button.
   - If valid, display a green verification badge and live preview confirming the video can be played.

2. **Direct Resource Deletion (`bibliotecaService` & `BibliotecaView`):**
   - Implement `eliminarRecurso(tenantId: string, recursoId: string)` in `bibliotecaService.ts` deleting from Firestore or memory.
   - Update `firestore.rules` to allow `isInstructor()` (Admin, Editor, Asistente, Maestro) within the tenant to delete resources.
   - Render `IconoEliminar` on direct video items in `BibliotecaView.tsx` with confirmation modal and local state refresh.

## Success Criteria
- [x] Admin cannot save a video in `ModalClasificarVideo` if YouTube reports code 150/101, 100, or 2.
- [x] Live player preview appears in `ModalClasificarVideo` when a valid YouTube URL is entered.
- [x] Tenant administrator can delete a direct video from `BibliotecaView.tsx`.
- [x] All unit and integration tests pass with 100% clean test suite.
