# Spec: Biblioteca y Validación de Video Directo

## User Scenarios

### Scenario 1: YouTube video with external embed restrictions is blocked upfront
- **GIVEN** an instructor opening `ModalClasificarVideo`
- **WHEN** the instructor inputs a YouTube URL whose video owner blocks third-party embedding (error code 150/101)
- **THEN** an error message is displayed: "El propietario de este video no permite su reproducción insertada en sitios externos."
- **AND** the "Guardar" button is disabled to prevent saving unplayable videos.

### Scenario 2: Valid YouTube video renders live preview and allows saving
- **GIVEN** an instructor opening `ModalClasificarVideo`
- **WHEN** the instructor enters a valid, embeddable YouTube URL
- **THEN** the video player mounts and verifies playback
- **AND** the status indicates the video is ready
- **AND** the instructor can save the video to the library.

### Scenario 3: Admin deletes direct video from library
- **GIVEN** an instructor viewing `BibliotecaView`
- **WHEN** looking at the list of direct videos (`recursosDirectos`)
- **THEN** a delete action button (`IconoEliminar`) is visible for each direct video
- **WHEN** the instructor confirms deletion
- **THEN** `bibliotecaService.eliminarRecurso` is invoked
- **AND** the video is removed from the visible library list.
