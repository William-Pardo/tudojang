# Spec: Visor PDF Adaptativo a la Pantalla y Preload de Recursos

## Requirements

### Requirement: Ajuste responsivo de PDF al tamaño de pantalla sin doble scroll
El visor de PDF MUST escalar la página completa para que quepa exactamente dentro del viewport visible sin generar barras de desplazamiento vertical internas ni dobles scrolls en pantallas de escritorio ni móviles.

#### Scenario: Visualizar una diapositiva PDF horizontal en pantalla
- GIVEN un PDF con formato de diapositiva apaisada
- WHEN el usuario abre el modal de visualización en cualquier resolución o móvil
- THEN la página se escala automáticamente en ancho y alto al espacio disponible
- AND no se genera ninguna barra de scroll vertical para ver el contenido completo de la diapositiva.

### Requirement: Precarga (Preload) para inicio ágil de reproducción
El visualizador de materiales MUST admitir pre-carga o almacenamiento en caché de URLs temporales para evitar demoras perceptibles al abrir recursos académicos.
