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

El sistema MUST ofrecer una vista donde listar las `JornadaInstruccion` reales de un programa y gestionar su ciclo de vida (confirmar, iniciar, cerrar).

#### Scenario: Ver clases generadas de un programa

- GIVEN un programa con jornadas ya generadas y persistidas
- WHEN el usuario abre la vista de gestión de clases
- THEN MUST listarse todas esas clases con fecha, hora, estado y material asignado

#### Scenario: Transicionar el estado de una clase

- GIVEN una clase real en estado `borrador`
- WHEN el usuario la confirma desde esta vista
- THEN su estado MUST actualizarse a `confirmada` y persistirse, usando las transiciones ya validadas de `jornadaService`

### Requirement: Publicación de material unificada

El sistema MUST ofrecer un único flujo para publicar material contra una o más clases (no dos flujos separados de "uno" y "en lote").

#### Scenario: Publicar un solo material a una sola clase con el flujo unificado

- GIVEN un material aprobado y una clase real
- WHEN el usuario selecciona ambos en el flujo único y publica
- THEN se MUST crear la asignación correspondiente, igual que hacía el flujo "single" antes de unificarse

#### Scenario: El flujo antiguo de un-solo-material ya no existe por separado

- GIVEN la vista de asignación tras esta unificación
- WHEN el usuario busca publicar material
- THEN MUST encontrar un único punto de entrada, no dos formularios distintos
