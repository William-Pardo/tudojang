# Specification: Adaptive Material Preview & Resolution

## Capability: resolver-tipo-material

### Scenario 1: Video with YouTube ID without extension in title
- **GIVEN** an assignment with `titulo: "VIDEO TUTOR"` and `youtubeVideoId: "dQw4w9WgXcQ"`
- **WHEN** `resolverTipoMaterial` is called
- **THEN** it must return `'video'` regardless of the missing `.mp4` file extension.

### Scenario 2: Drive Video with video MIME type
- **GIVEN** an assignment with `titulo: "Defensa Personal"` and `mimeType: "video/mp4"`
- **WHEN** `resolverTipoMaterial` is called
- **THEN** it must return `'video'`.

### Scenario 3: PDF Document with PDF MIME type
- **GIVEN** an assignment with `mimeType: "application/pdf"`
- **WHEN** `resolverTipoMaterial` is called
- **THEN** it must return `'pdf'`.

### Scenario 4: Image Material
- **GIVEN** an assignment with `mimeType: "image/png"` or `tipoRecurso: "imagen"`
- **WHEN** `resolverTipoMaterial` is called
- **THEN** it must return `'imagen'`.

### Scenario 5: Evaluation / Quiz
- **GIVEN** an assignment with `uso: "evaluacion"` or `tipoRecurso: "quiz"`
- **WHEN** `resolverTipoMaterial` is called
- **THEN** it must return `'quiz'`.

## Capability: preview-modal-adaptativo

### Scenario 6: Video Modal Rendering
- **GIVEN** an assignment resolved as `'video'` with `youtubeVideoId`
- **WHEN** `MaterialPreviewModal` renders
- **THEN** it renders `YoutubePlayer` and does NOT render `PdfViewer`.

### Scenario 7: Assignment Publishing Metadata Propagation
- **GIVEN** an approved `RecursoAcademico` with `mimeType: "video/mp4"` and `ficha.tipo: "video"`
- **WHEN** `publishAsignacion` is called
- **THEN** the resulting `AsignacionAcademica` contains `mimeType: "video/mp4"` and `tipoRecurso: "video"`.
