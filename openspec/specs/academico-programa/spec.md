# Academico Programa Specification

## Purpose

Define el comportamiento requerido para que un `ProgramaAcademico` y su `EjecucionPrograma` queden persistidos de verdad (no solo en memoria), sean reeditables después, y sus clases generadas (`JornadaInstruccion`) sean visibles y gestionables desde una vista propia — resolviendo los 2 bugs reportados por el usuario al probar el flujo real.

## Requirements

### Requirement: Persistencia real del Programa Académico

El sistema MUST persistir `ProgramaAcademico` en Firestore al confirmarlo desde la vista de asignación, y MUST poder recuperarlo después.

#### Scenario: Programa persiste tras recargar

- GIVEN un usuario confirma un programa con nombre, horario y fecha de fin
- WHEN recarga la página o vuelve a entrar más tarde
- THEN el mismo programa MUST aparecer disponible para seleccionar y editar

#### Scenario: Tenant sin programas previos

- GIVEN un tenant que nunca creó un programa académico
- WHEN abre la vista de asignación
- THEN MUST mostrarse un estado vacío o el programa demo inicial, sin error

### Requirement: Persistencia real de la Ejecución del Programa

El sistema MUST persistir `EjecucionPrograma` en Firestore al confirmar la asignación de un programa a un grupo, reutilizando el método de repositorio ya existente.

#### Scenario: Ejecución persiste junto al programa

- GIVEN un programa confirmado con grupo, sede y horario
- WHEN se guarda
- THEN la `EjecucionPrograma` correspondiente MUST quedar persistida con esos datos, no solo en memoria

### Requirement: Listado de programas reales al abrir la vista

La vista de asignación MUST leer los programas reales del tenant al montarse, en vez de mostrar siempre un programa de demostración fijo.

#### Scenario: Programas existentes se listan al entrar

- GIVEN un tenant con 2 programas académicos ya persistidos
- WHEN el usuario abre la vista de asignación
- THEN MUST poder elegir entre esos 2 programas reales

### Requirement: Gestión de clases generadas

El sistema MUST ofrecer una vista donde listar las `JornadaInstruccion` reales de un programa y gestionar su ciclo de vida completo: confirmar, iniciar, cerrar, cancelar y reprogramar.

#### Scenario: Ver clases generadas de un programa

- GIVEN un programa con jornadas ya generadas y persistidas
- WHEN el usuario abre la vista de gestión de clases
- THEN MUST listarse todas esas clases con fecha, hora, estado y material asignado

#### Scenario: Transicionar el estado de una clase

- GIVEN una clase real en estado `borrador`
- WHEN el usuario la confirma desde esta vista
- THEN su estado MUST actualizarse a `confirmada` y persistirse, usando las transiciones ya validadas de `jornadaService`

#### Scenario: Cancelar una clase con motivo, en línea

- GIVEN una jornada `confirmada` o `en_curso`
- WHEN el admin la cancela desde la fila expandida indicando un motivo
- THEN el estado MUST pasar a `cancelada`, el motivo MUST persistirse y MUST registrarse auditoría (`accion: 'cancelar'`)
- AND MUST completarse sin modal ni navegación fuera de `MisClasesView`

### Requirement: Publicación de material unificada

El sistema MUST ofrecer un único asistente modal de 3 pasos (Material → Configurar → Grados) como entrada exclusiva para publicar material, en creación y edición. MUST NOT reintroducir "Clase activa" ni "Publicación en lote". La navegación por viñetas y su lógica de 4 colores (gris/azul/rojo/verde) MUST mantenerse sin cambios.

#### Scenario: Un único punto de entrada por clase

- GIVEN la clase activa
- WHEN el usuario busca publicar material
- THEN MUST encontrar únicamente "+ Agregar material"

### Requirement: Persistencia de tags del programa

`ProgramaAcademico` MUST soportar `tags?: string[]`, persistido en Firestore vía `createPrograma()`/`guardarPrograma()`.

#### Scenario: Tags persisten tras recargar

- GIVEN un programa creado con tags
- WHEN se guarda y se recarga la página
- THEN los mismos `tags` MUST reaparecer al recuperarlo
- AND un programa previo sin `tags` MUST tratarse como "sin tags", sin error ni backfill

### Requirement: Priorización de materiales por tags del programa

El Paso 1 SHOULD mostrar la cantidad de tags coincidentes por material, y MUST excluir los ya asignados a la clase activa.

#### Scenario: Badge de coincidencia y exclusión de duplicados

- GIVEN el Paso 1 abierto, con un material ya asignado a la clase activa
- THEN cada material MUST mostrar su cantidad de tags coincidentes
- AND ese material MUST NOT ser seleccionable ahí, pero SÍ en otra clase

### Requirement: Reprogramación de una jornada en el mismo documento

El sistema MUST permitir reprogramar una jornada en estado `confirmada` editando `fecha`/`horaInicio`/`horaFin` del mismo documento. MUST NOT crear una jornada nueva ni vincularla como hija de la original.

#### Scenario: Reprogramar en un solo paso, sin conflicto

- GIVEN una jornada `confirmada` y una nueva fecha/horaInicio/horaFin sin cruce de horario
- WHEN el admin reprograma la jornada desde la fila expandida en `MisClasesView`
- THEN la jornada MUST terminar `confirmada` con la nueva fecha/hora en una sola acción, y MUST registrarse auditoría (`accion: 'actualizar'`)
- AND la transición `reprogramada → confirmada` MUST estar permitida para soportar este flujo

#### Scenario: Reprogramar con conflicto de horario

- GIVEN una nueva fecha/horaInicio/horaFin que se cruza con otra jornada activa
- WHEN el admin intenta reprogramar
- THEN el sistema MUST rechazar el cambio, reusando `existeConflictoHorario`, y la jornada MUST mantener su fecha/hora/estado previos

#### Scenario: Reprogramar solo disponible desde `confirmada`

- GIVEN una jornada `borrador` o `en_curso`
- WHEN el usuario abre su fila en `MisClasesView`
- THEN "Reprogramar" MUST NOT estar disponible

### Requirement: Visibilidad de clases canceladas y reprogramadas en el horario

El sistema MUST excluir jornadas `cancelada` al elegir la "próxima" ocurrencia de un grupo en `agruparClasesAcademicas`, y MUST mostrar una indicación visual (no ocultamiento silencioso) para clases `cancelada`/`reprogramada` cuya ocurrencia siga vigente.

#### Scenario: Jornada cancelada standalone deja de ser "próxima"

- GIVEN una jornada standalone (sin `bloqueRecurrenteId`) en estado `cancelada`
- WHEN se construye la agenda
- THEN esa jornada MUST NOT elegirse como "próxima", y su grupo MUST excluirse del listado si no queda ninguna ocurrencia activa

#### Scenario: Grupo recurrente con la ocurrencia más próxima cancelada

- GIVEN un grupo recurrente donde la ocurrencia más próxima está `cancelada` pero existen ocurrencias futuras activas
- WHEN `agruparClasesAcademicas` elige la "próxima"
- THEN MUST omitir la ocurrencia cancelada y elegir la siguiente ocurrencia activa

#### Scenario: Grupo enteramente cancelado

- GIVEN un grupo donde todas sus ocurrencias están `cancelada`
- WHEN se construye la agenda
- THEN el grupo completo MUST excluirse del listado, sin error

#### Scenario: Badge visible para cancelada/reprogramada vigente

- GIVEN una jornada `cancelada` o `reprogramada` cuya `fecha` sea `>= hoy`
- WHEN se renderiza en `Horarios.tsx`
- THEN MUST mostrarse con badge distintivo y estilo atenuado (gris), y `ClaseAcademicaAgenda` MUST exponer el `estado` necesario para ese render
- AND MUST NOT ocultarse silenciosamente

#### Scenario: Clase vencida no acumula badge

- GIVEN una jornada `cancelada`/`reprogramada` cuya `fecha` sea `< hoy`
- WHEN se renderiza la agenda
- THEN MUST NOT mostrarse; se excluye como cualquier ocurrencia pasada

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
