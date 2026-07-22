# Academico Asignación Specification (Camino A)

## Purpose

Define el comportamiento requerido para vincular materiales (`RecursoAcademico`) a clases reales (`JornadaInstruccion`) dentro de un programa, reemplazando el modelo de asignación actual (un material por acción, jornadas de preview falsas).

## Requirements

### Requirement: Vínculo real asignación-clase

El sistema MUST persistir `jornadaId`/`jornadaIds[]` como campo de primera clase en `AsignacionAcademica` al asignar un material a una o más clases, sin alterar el campo `destinatario` existente.

#### Scenario: Publicar asignación con clase real

- GIVEN un recurso aprobado y N jornadas reales de un programa
- WHEN el usuario publica la asignación seleccionando el recurso y las jornadas
- THEN se crea una `AsignacionAcademica` con `jornadaId`/`jornadaIds[]` poblado

#### Scenario: Compatibilidad con asignaciones legacy

- GIVEN una `AsignacionAcademica` existente sin `jornadaId` (previa a este cambio)
- WHEN el sistema la lee
- THEN MUST tratar `jornadaId` ausente como `null`, sin error

### Requirement: Publicación batch multi-material x multi-clase

El sistema MUST permitir publicar N recursos a M jornadas en una sola acción del usuario.

#### Scenario: Publicación en bloque

- GIVEN 3 materiales y 5 clases seleccionadas
- WHEN el usuario confirma la publicación
- THEN se crean 15 asignaciones, cada una con su `jornadaId` y `recursoId` correspondiente

#### Scenario: Duplicado parcial en el batch

- GIVEN una publicación batch donde una combinación material-clase ya existe
- WHEN se publica
- THEN el sistema SHOULD omitir el duplicado, crear el resto, y reportar cuáles se saltearon (sin abortar toda la operación)

### Requirement: Filtro de materiales por tag

El picker de materiales MUST permitir filtrar por coincidencia de tag antes de seleccionar qué asignar.

#### Scenario: Filtrar por tag existente

- GIVEN una biblioteca con materiales taggeados
- WHEN el usuario selecciona un tag en el filtro
- THEN solo se muestran materiales cuyo `ficha.tags` incluya ese tag (case-insensitive)

#### Scenario: Tag sin coincidencias

- GIVEN un tag que no matchea ningún material
- WHEN se aplica el filtro
- THEN se muestra un estado vacío explícito, no un error

### Requirement: Persistencia diferida de jornadas seleccionadas

**[CORREGIDO post sdd-verify, 2026-07-04]** El requirement original de este documento ("Uso de jornadas reales": leer `JornadaInstruccion` persistidas al abrir la vista, paginar más de 60) describía un comportamiento que NO se implementó. Durante `sdd-apply` se descubrió que el preview de clases nunca fue una entidad persistida — es una simulación 100% client-side. El usuario aprobó explícitamente una desviación de alcance ("Opción B") para no forzar la persistencia anticipada de hasta 60 `JornadaInstruccion` por programa. Este requirement reemplaza al original para reflejar el comportamiento real y verificado.

La vista de asignación MAY mostrar un preview de clases calculado client-side (sin persistir) para navegación y selección, pero MUST persistir cada jornada seleccionada como `JornadaInstruccion` real recién en el momento de publicar materiales contra ella, y MUST NOT re-persistir una jornada ya confirmada para el mismo preview dentro de la misma sesión.

#### Scenario: El preview no requiere jornadas ya persistidas

- GIVEN un programa con horario recurrente definido pero sin `JornadaInstruccion` persistidas todavía
- WHEN el usuario abre la vista de asignación
- THEN se muestra un listado de clases calculado localmente a partir del horario del programa, sin leer Firestore

#### Scenario: Publicar persiste la jornada seleccionada una sola vez

- GIVEN una clase del preview sin `JornadaInstruccion` persistida
- WHEN el usuario la selecciona y publica materiales contra ella
- THEN se crea una `JornadaInstruccion` real
- AND si la misma clase se vuelve a publicar en la misma sesión, MUST reutilizar el ID ya persistido en vez de crear uno nuevo

### Limitación conocida: tope de 60 clases en el preview

El preview client-side genera como máximo 60 clases por programa (una por cada combinación fecha×horario dentro del rango de fechas). Programas con más de 60 clases NO tienen paginación ni virtualización — las clases excedentes simplemente no aparecen. Esta limitación queda sin resolver y fuera de alcance de este change.

### Requirement: Seguridad de Firestore para `jornadaId`

Las reglas de Firestore MUST restringir lectura/escritura de `AsignacionAcademica.jornadaId` con el mismo modelo de tenant/rol ya aplicado a los demás campos de asignación.

#### Scenario: Aislamiento entre tenants

- GIVEN un usuario de un tenant distinto al de la asignación
- WHEN intenta leer o escribir una `AsignacionAcademica` con `jornadaId` de otro tenant
- THEN la operación MUST ser rechazada por las reglas

#### Scenario: Rol sin permiso de publicación

- GIVEN un usuario válido del tenant sin rol de instructor/admin
- WHEN intenta publicar una asignación con `jornadaId`
- THEN MUST aplicarse la misma restricción de rol que ya rige para crear asignaciones hoy
