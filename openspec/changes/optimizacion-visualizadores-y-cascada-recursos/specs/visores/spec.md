# Spec: Requisitos de Visores y Cascada de Recursos

## Requirements

### Requirement: Cascada de eliminación de asignaciones al suprimir recurso
Al eliminar un recurso académico de la biblioteca, el sistema MUST eliminar de inmediato y en la misma operación todas las asignaciones existentes asociadas a dicho recurso, de modo que deje de estar visible para cualquier estudiante o tutor.

#### Scenario: Eliminar un recurso retira sus asignaciones del panel de estudiantes
- GIVEN un recurso asignado a una o más clases y visible para estudiantes
- WHEN el instructor o administrador elimina el recurso de la biblioteca
- THEN el documento del recurso es eliminado de Firestore
- AND todas las asignaciones que referencian a dicho recurso son eliminadas automáticamente
- AND el material deja de aparecer en "Mis clases" o en el Centro de Estudios del estudiante.

### Requirement: Reproducción embebida de presentaciones sin forzar descarga
El visualizador de materiales para presentaciones MUST reproducir las diapositivas de forma interactiva en la interfaz web y MUST NOT forzar la descarga del archivo en el navegador del usuario.

#### Scenario: Abrir una presentación muestra el visor interactivo
- GIVEN una asignación o recurso clasificado como presentación o diapositivas
- WHEN el usuario abre el modal de visualización
- THEN se muestra el reproductor embebido de diapositivas dentro del modal
- AND el navegador no dispara la descarga de ningún archivo binario `.pptx` o similar.

### Requirement: Carga fluida y oportuna de imágenes de estudio
El visualizador de imágenes MUST presentar de inmediato el estado de carga y renderizar la imagen sin demoras excesivas causadas por intermediación síncrona innecesaria.

#### Scenario: Abrir un recurso de imagen
- GIVEN un material de tipo imagen en la biblioteca
- WHEN el usuario abre el modal de vista previa
- THEN la imagen se renderiza de manera progresiva y fluida con feedback visual.

### Requirement: Ajuste responsivo de página en visor de PDFs sin scroll vertical forzado
El visor de PDF MUST ajustar automáticamente las dimensiones de la página al contenedor visible del modal, evitando desbordamientos verticales innecesarios en documentos horizontales o apaisados.

#### Scenario: Documento PDF con orientación apaisada
- GIVEN un documento PDF con relación de aspecto horizontal
- WHEN se visualiza en `PdfViewer`
- THEN la página se escala adecuadamente para ser visible en su totalidad sin requerir desplazamiento vertical forzado.
