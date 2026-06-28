## ADDED Requirements

### Requirement: Admin crea y versiona programas formativos académicos
El sistema SHALL permitir al admin del tenant crear programas académicos separados de los programas comerciales existentes. Un programa académico SHALL contener: disciplina, nivel o rango de grados, objetivos formativos, unidades y temas, número esperado de clases, prerrequisitos, criterios de evaluación, recursos predeterminados y versión publicada.

#### Scenario: Creación de programa académico
- **WHEN** el admin completa el formulario de programa académico con todos los campos obligatorios
- **THEN** el sistema SHALL crear el programa en estado `borrador` con versión `1.0` y lo SHALL asociar al `tenantId` del admin

#### Scenario: Publicación de versión del programa
- **WHEN** el admin publica un programa borrador
- **THEN** el sistema SHALL cambiar el estado a `publicado`, asignar una versión semántica y el programa SHALL estar disponible para asignar a grupos

### Requirement: Grupo tiene ejecución independiente del programa
El sistema SHALL permitir asignar un programa académico a uno o más grupos. Cada grupo SHALL tener su propia ejecución independiente: posición en el ciclo, objetivos completados, jornadas realizadas. Dos grupos con el mismo programa SHALL poder avanzar a ritmos distintos.

#### Scenario: Asignación de programa a grupo
- **WHEN** el admin asigna un programa a un grupo
- **THEN** el sistema SHALL crear una `EjecucionPrograma` vinculada al grupo con posición inicial en el ciclo y estado `activa`

#### Scenario: Grupos con ritmos distintos en el mismo programa
- **WHEN** dos grupos tienen la misma `EjecucionPrograma` pero distinto número de jornadas cerradas
- **THEN** el sistema SHALL mantener posiciones independientes en el ciclo para cada grupo sin interferencia

### Requirement: Jornada puede tener objetivo común y adaptaciones por grado
El sistema SHALL permitir que una jornada tenga un objetivo principal del programa y adaptaciones específicas por grado, dado que en un grupo pueden coexistir estudiantes de múltiples niveles.

#### Scenario: Objetivo con adaptación por grado
- **WHEN** el maestro registra la jornada y marca adaptaciones para grados específicos
- **THEN** el sistema SHALL almacenar el objetivo principal y las adaptaciones como estructura separada; las asignaciones podrán filtrarse por grado del estudiante

### Requirement: Avance del ciclo solo por jornada cerrada
El sistema SHALL avanzar la posición en el ciclo del programa únicamente cuando una jornada es cerrada por el maestro. Una jornada cancelada NO SHALL avanzar el ciclo.

#### Scenario: Cierre de jornada avanza el programa
- **WHEN** el maestro cierra una jornada registrando asistencia y objetivos impartidos
- **THEN** el sistema SHALL marcar los objetivos como completados en la `EjecucionPrograma` del grupo y avanzar la posición del ciclo

#### Scenario: Cancelación no avanza el programa
- **WHEN** una jornada es cancelada (no cerrada)
- **THEN** la `EjecucionPrograma` del grupo SHALL mantenerse en la misma posición del ciclo sin cambios
