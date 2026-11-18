# Proposal: Adaptive Material Preview & Fail-Safe Material Type Resolution

## Problem Statement
When students or tenant staff open academic materials in the Centro de Estudios modal (`MaterialPreviewModal.tsx`), the viewer type resolution relies on a brittle heuristic: matching file extensions at the end of the title string (`titulo.endsWith('.mp4')`). If a video resource is titled without a file extension (e.g. "VIDEO TUTOR" or "calse video"), or if a user inputs a non-standard title, the resolution silently falls back to `pdf`.
This results in:
1. Video resources displaying the `PdfViewer` UI ("VISOR PDF", "Paginas registradas: 1/3", blank preview).
2. Missing video controls (play, pause, timeline, fullscreen).
3. Assignments failing to carry the underlying resource's actual MIME type and canonical resource type (`tipoRecurso`), making the system vulnerable to human naming errors.

## Proposed Solution
Implement a multi-layered, fail-safe architecture for academic material resolution and presentation:

1. **Model & Contract Enrichment:**
   - Enrich `AsignacionAcademica` and `AsignacionCentroEstudios` with canonical metadata: `mimeType?: string` and `tipoRecurso?: 'video' | 'pdf' | 'imagen' | 'presentacion' | 'quiz' | 'generico'`.
   - In `publishAsignacion` (`asignacionService.ts`), propagate `mimeType` and `tipoRecurso` immutably from the approved `RecursoAcademico`.

2. **Canonical Type Resolver Utility (`resolverTipoMaterial`):**
   - Pure, deterministic utility that checks source-of-truth metadata in priority order:
     1. Evaluative usage (`uso === 'evaluacion'`) -> `'quiz'`
     2. Provider identifiers (`youtubeVideoId` exists) -> `'video'`
     3. Real MIME types (`video/*`, `application/pdf`, `image/*`, `presentation/*`)
     4. Secondary confirmation: `tipoRecurso` / `ficha.tipo`
     5. String extension fallback as last resort
     6. Default safe generic handler

3. **Validation Rule in Assignment Set (`AsignarMaterialWizard` & `asignacionService`):**
   - Ensure the material assignment draft captures and validates the real type of the selected resource.
   - Fail-safe matching preventing incongruous assignments.

4. **Polymorphic Adaptive Modal (`MaterialPreviewModal`):**
   - Dynamically render the appropriate player/viewer based on the resolved canonical type:
     - `'video'`: `YoutubePlayer` (if YouTube) or `VideoPlayer` (if Drive video with playback tracking).
     - `'pdf'`: `PdfViewer` with page navigation.
     - `'imagen'`: Responsive image preview viewer.
     - `'presentacion'`: Slide/presentation preview.
     - `'quiz'`: `QuizView`.
     - `'generico'`: Informative generic viewer.
   - Dynamic header subtitle indicating the exact material type.
