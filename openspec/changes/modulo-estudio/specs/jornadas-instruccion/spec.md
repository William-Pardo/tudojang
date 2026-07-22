## ADDED Requirements

### Requirement: Jornada tiene ciclo de vida completo con validación de conflictos
El sistema SHALL gestionar jornadas de instrucción con los estados: `borrador`, `pendiente_confirmacion`, `confirmada`, `en_curso`, `pendiente_cierre`, `cerrada`. También SHALL soportar estados alternativos: `cancelada`, `reprogramada`, `parcial`, `pendiente_sustitucion`. La transición a `confirmada` SHALL requerir validación exitosa de una Cloud Function.

#### Scenario: Validación de conflictos al confirmar jornada
- **WHEN** el sistema intenta confirmar una jornada
- **THEN** la Cloud Function SHALL validar: disponibilidad del maestro, disponibilidad del espacio, ausencia de cruces del grupo, autorización del maestro para la sede, capacidad del espacio y compatibilidad disciplina-maestro-objetivo. Si alguna validación falla, SHALL retornar error descriptivo con el motivo específico

#### Scenario: Jornada sin conflictos pasa a confirmada
- **WHEN** la Cloud Function valida exitosamente todos los criterios
- **THEN** el estado de la jornada SHALL cambiar a `confirmada` y se SHALL registrar el timestamp de confirmación con el validador

#### Scenario: Conflicto de espacio detectado
- **WHEN** dos jornadas intentan usar el mismo espacio en el mismo horario
- **THEN** el sistema SHALL rechazar la segunda confirmación con error indicando el conflicto de espacio y la jornada que lo ocupa

### Requirement: Cierre de jornada requiere registro completo
El sistema SHALL requerir que el maestro registre asistencia, objetivos impartidos y materiales posteriores antes de cerrar una jornada. Una jornada no SHALL poder cerrarse parcialmente sin indicar qué objetivos fueron impartidos.

#### Scenario: Cierre completo de jornada
- **WHEN** el maestro completa el registro de asistencia, objetivos impartidos y materiales, y confirma el cierre
- **THEN** el sistema SHALL cambiar el estado a `cerrada`, actualizar la `EjecucionPrograma` del grupo con los objetivos avanzados y registrar el timestamp de cierre

#### Scenario: Intento de cierre sin asistencia registrada
- **WHEN** el maestro intenta cerrar una jornada sin haber registrado la asistencia
- **THEN** el sistema SHALL rechazar la operación con error indicando los campos faltantes

### ~~Requirement: Jornada reprogramada genera nueva jornada hija~~ *(SUPERSEDED)*

> **Superseded by**: change `gestion-clases-cancelar-reprogramar` (2026-07-06).
> La implementación real usa reprogramación in-place (`confirmada→reprogramada→confirmada` en un solo paso via `reprogramarJornada`), sin crear jornadas hijas ni `parentJornadaId`. No existen callers del modelo hija. Véase `servicios/academico/jornadaService.ts#reprogramarJornada`.

El sistema SHALL permitir reprogramar una jornada, lo que SHALL crear una nueva jornada vinculada a la original como "hija". La jornada original SHALL quedar en estado `reprogramada` y NO SHALL avanzar el ciclo del programa.

#### Scenario: Reprogramación de jornada
- **WHEN** el admin o maestro reprograma una jornada confirmada
- **THEN** el sistema SHALL crear una nueva jornada con `parentJornadaId` referenciando la original, cambiar la original a estado `reprogramada` y mantener la posición del ciclo del programa hasta que la nueva jornada sea cerrada

### Requirement: Jornada parcial avanza solo objetivos impartidos
El sistema SHALL soportar cierre parcial de una jornada, donde el maestro indica que solo algunos objetivos planificados fueron impartidos. Solo esos objetivos SHALL avanzar en el ciclo del programa.

#### Scenario: Cierre parcial de jornada
- **WHEN** el maestro cierra la jornada marcando solo un subconjunto de los objetivos planificados
- **THEN** el sistema SHALL registrar el estado `parcial`, avanzar únicamente los objetivos marcados en la `EjecucionPrograma` y dejar los objetivos restantes pendientes para la próxima jornada
