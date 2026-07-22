# Delta for Academico Programa

## MODIFIED Requirements

### Requirement: Gestión de clases generadas

El sistema MUST ofrecer una vista donde listar las `JornadaInstruccion` reales de un programa y gestionar su ciclo de vida completo: confirmar, iniciar, cerrar, cancelar y reprogramar.
(Previously: solo confirmar, iniciar y cerrar eran gestionables; no existía acción de cancelar ni reprogramar desde la vista.)

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

## ADDED Requirements

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
