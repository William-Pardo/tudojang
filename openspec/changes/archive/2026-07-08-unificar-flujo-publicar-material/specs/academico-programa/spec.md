# Delta for Academico Programa

## REMOVED Requirements

### Requirement: Publicación en grupos independientes

(Reason: reemplazada por el asistente unificado de 3 pasos; ya no existen grupos independientes.)

## MODIFIED Requirements

### Requirement: Publicación de material unificada

El sistema MUST ofrecer un único asistente modal de 3 pasos (Material → Configurar → Grados) como entrada exclusiva para publicar material, en creación y edición. MUST NOT reintroducir "Clase activa" ni "Publicación en lote". La navegación por viñetas y su lógica de 4 colores (gris/azul/rojo/verde) MUST mantenerse sin cambios.
(Previously: el lote se organizaba en grupos independientes.)

#### Scenario: Un único punto de entrada por clase

- GIVEN la clase activa
- WHEN el usuario busca publicar material
- THEN MUST encontrar únicamente "+ Agregar material"

### Requirement: Priorización de materiales por tags del programa

El Paso 1 SHOULD mostrar la cantidad de tags coincidentes por material, y MUST excluir los ya asignados a la clase activa.
(Previously: solo ordenaba, sin excluir duplicados ni mostrar conteo.)

#### Scenario: Badge de coincidencia y exclusión de duplicados

- GIVEN el Paso 1 abierto, con un material ya asignado a la clase activa
- THEN cada material MUST mostrar su cantidad de tags coincidentes
- AND ese material MUST NOT ser seleccionable ahí, pero SÍ en otra clase

## ADDED Requirements

### Requirement: Asistente de 3 pasos por clase

El sistema MUST implementar 3 pasos — Material, Configurar, Grados — con barra de progreso.

#### Scenario: Cada paso exige su condición mínima antes de avanzar

- GIVEN Paso 1 sin material seleccionado, THEN "Continuar" MUST estar deshabilitado
- AND GIVEN Paso 3 sin ningún grado marcado, "Asignar" MUST estar deshabilitado

### Requirement: Tema de la jornada persistido y editable en línea

`JornadaInstruccion` MUST soportar `tema?: string`, persistido y editable en línea desde la píldora de la clase activa, sin abrir el asistente.

#### Scenario: Tema persiste y se edita sin abrir el asistente

- GIVEN un tema guardado, WHEN se recarga la vista, THEN el mismo tema MUST reaparecer
- AND WHEN el usuario edita la píldora, THEN MUST guardarse sin abrir el modal

### Requirement: Edición de asignación con verificación de cambios

El sistema MUST permitir editar una asignación reabriendo el asistente prellenado, con "Asignar" deshabilitado hasta que algún campo difiera del snapshot inicial. "Atrás"/"Continuar" MUST permanecer siempre habilitados.

#### Scenario: Asignar solo se habilita con cambios reales

- GIVEN modo edición sin cambios, THEN "Asignar" MUST estar deshabilitado
- AND WHEN el usuario modifica un campo, "Asignar" MUST habilitarse y persistir con el mismo `id` (upsert real), no simulada

### Requirement: Fila de asignación con resumen, edición y eliminación reales

Cada asignación MUST renderizarse colapsada mostrando material y puntos de color por grado; al expandir MUST mostrar momento/criterio/destinatario/fechas/grados. MUST ofrecer "Editar" y eliminar (X) con borrado real en Firestore.

#### Scenario: Eliminar persiste y las asignaciones sobreviven a un recargo

- GIVEN una fila visible, WHEN se confirma eliminar (X), THEN MUST eliminarse de Firestore
- AND las no eliminadas MUST seguir listadas tras recargar, por lectura real

### Requirement: Destinatario grupo con grados poblados

`crearDestinatario()` MUST poblar `grados` para `tipo === 'grupo'` igual que para `tipo === 'grado'`.

#### Scenario: Destinatario tipo grupo con grados seleccionados

- GIVEN destinatario "grupo" y grados marcados
- WHEN se confirma, THEN `DestinatarioAsignacion.grados` MUST contenerlos
