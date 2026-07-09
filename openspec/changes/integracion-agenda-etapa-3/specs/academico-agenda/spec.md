# Academico Agenda Specification (etapa 3)

## Purpose

Define el comportamiento requerido para que un `ProgramaAcademico`, al asignarse a un grupo con un horario recurrente, genere automáticamente sus clases reales (`JornadaInstruccion`) y estas aparezcan en la Agenda existente (`vistas/Horarios.tsx`) junto al horario comercial, mostrando grupo, maestro, sede, programa, material asignado, día y hora.

## Requirements

### Requirement: Horario recurrente en la ejecución del programa

El sistema MUST permitir asociar uno o más bloques recurrentes (`BloqueRecurrente`, uno por día de la semana) y una fecha de fin a una `EjecucionPrograma`.

#### Scenario: Asignar programa con horario de varios días

- GIVEN un `ProgramaAcademico` publicado
- WHEN se asigna a un grupo con bloques para Lunes/Miércoles/Viernes y una fecha de fin
- THEN la `EjecucionPrograma` resultante MUST persistir esos 3 bloques y la fecha de fin

#### Scenario: Compatibilidad con ejecuciones existentes sin horario

- GIVEN una `EjecucionPrograma` creada antes de este cambio (sin `bloques`/`fechaFin`)
- WHEN el sistema la lee
- THEN MUST tratar `bloques` ausente como lista vacía y `fechaFin` ausente como `null`, sin error

### Requirement: Generación y persistencia automática de clases

Al confirmarse la asignación de un programa con horario, el sistema MUST generar y persistir una `JornadaInstruccion` real por cada combinación de bloque recurrente y fecha dentro del rango `fechaInicio`–`fechaFin`.

#### Scenario: Generación en lote al confirmar

- GIVEN una `EjecucionPrograma` con 2 bloques recurrentes y un rango de 4 semanas
- WHEN se confirma la asignación
- THEN se crean y persisten todas las `JornadaInstruccion` correspondientes a esas 8 ocurrencias (2 bloques × 4 semanas)

#### Scenario: Rango de fechas grande

- GIVEN un programa con un rango de fechas que generaría un volumen de jornadas cercano o superior al límite de operaciones de un solo lote de escritura
- WHEN se confirma la asignación
- THEN el sistema SHOULD dividir la persistencia en múltiples lotes sin fallar ni perder jornadas

### Requirement: Visualización de clases académicas en la Agenda

La Agenda (`Horarios.tsx`) MUST mostrar las `JornadaInstruccion` generadas junto a los bloques comerciales (`BloqueHorario`) existentes, sin fusionar ambos modelos.

#### Scenario: Clase académica visible en la Agenda

- GIVEN una `JornadaInstruccion` persistida para el tenant actual
- WHEN el usuario abre la Agenda
- THEN la clase MUST mostrarse con grupo, maestro, sede, programa, día y hora

#### Scenario: Coexistencia con horario comercial

- GIVEN un tenant con bloques comerciales (`BloqueHorario`) y clases académicas (`JornadaInstruccion`) en el mismo rango de fechas
- WHEN se abre la Agenda
- THEN AMBOS conjuntos MUST mostrarse sin que uno oculte o reemplace al otro

### Requirement: Material asignado visible por clase

La Agenda MUST mostrar, para cada clase académica, los materiales asignados a esa jornada específica.

#### Scenario: Clase con material asignado

- GIVEN una `JornadaInstruccion` con una o más `AsignacionAcademica` cuyo `jornadaId` la referencia
- WHEN se muestra esa clase en la Agenda
- THEN MUST listarse el/los material(es) asignado(s)

#### Scenario: Clase sin material asignado todavía

- GIVEN una `JornadaInstruccion` sin ninguna `AsignacionAcademica` asociada
- WHEN se muestra en la Agenda
- THEN MUST indicar explícitamente que no hay material asignado, sin error

### Requirement: No interferencia con el modelo comercial

El sistema MUST NOT modificar la lógica de facturación/operación existente de `Programa`/`BloqueHorario`.

#### Scenario: Edición de horario comercial sin cambios de comportamiento

- GIVEN un `Programa` comercial con `bloquesHorarios` existente
- WHEN se edita o factura como hoy
- THEN el comportamiento MUST ser idéntico al previo a este cambio

### Requirement: Publicar material nunca crea ni elimina una clase

**[AGREGADO post sdd-verify, 2026-07-04]** El flujo de publicación de materiales (`AsignacionesView.tsx`) MUST NOT crear ni eliminar una `JornadaInstruccion` como efecto de publicar un material contra ella — SOLO MUST editar/anotar una clase que ya existe (asignación, grado, criterio).

#### Scenario: Publicar material sobre una clase existente

- GIVEN una `JornadaInstruccion` real ya generada para el programa
- WHEN el usuario selecciona esa clase y publica un material contra ella
- THEN se registra la asignación referenciando esa `JornadaInstruccion` existente, sin crear ni recrear el documento de la jornada

#### Scenario: No hay clase real disponible para publicar

- GIVEN un programa cuyo horario todavía no generó ninguna `JornadaInstruccion` real
- WHEN el usuario intenta publicar un material
- THEN el sistema MUST bloquear la publicación con un error explícito, y MUST NOT crear una jornada nueva para permitirla

### Requirement: Integración real de creación de programa desde la vista de asignación

**[AGREGADO post sdd-verify, 2026-07-04]** Al confirmar un programa con horario (`diasHorario` + `fechaFin`) desde la vista de asignación de materiales, el sistema MUST crear y publicar un `ProgramaAcademico` real, asignarlo a un grupo con su horario recurrente, y generar y persistir sus `JornadaInstruccion` reales de punta a punta, sin simulación local.

#### Scenario: Confirmar programa genera y persiste sus clases reales

- GIVEN un programa con al menos un día de horario y una fecha de fin definidos en la vista de asignación
- WHEN el usuario confirma el programa
- THEN se crea un `ProgramaAcademico` publicado, una `EjecucionPrograma` con ese horario, y se persisten en lote las `JornadaInstruccion` de todo el período

#### Scenario: Programa sin horario completo no genera clases

- GIVEN un programa sin días de horario o sin fecha de fin definidos
- WHEN el usuario lo confirma
- THEN el sistema MUST guardar el programa localmente sin intentar generar ni persistir jornadas, sin error
