## ADDED Requirements

### Requirement: Maestro publica asignaciones académicas a grupos, grados o estudiantes
El sistema SHALL permitir al maestro asignado a una jornada publicar recursos institucionales aprobados como asignaciones académicas. Cada asignación SHALL especificar: recurso académico, jornada y programa relacionados, destinatarios (grupo, grados `string[]` o estudiantes individuales), sede, uso académico, obligatoria u opcional, apertura y cierre, momento pedagógico (preparación, durante o refuerzo posterior) y criterio de finalización.

#### Scenario: Publicación de asignación a un grupo completo
- **WHEN** el maestro publica un recurso aprobado para todos los estudiantes de un grupo
- **THEN** el sistema SHALL crear la asignación con `destinatario.tipo: 'grupo'` y `destinatario.grupoId` y el recurso SHALL aparecer en el Centro de Estudios de cada estudiante del grupo una vez superada la fecha de apertura

#### Scenario: Publicación de asignación filtrada por grados
- **WHEN** el maestro publica un recurso aprobado solo para ciertos grados dentro del grupo
- **THEN** el sistema SHALL crear la asignación con `destinatario.grados: string[]` y solo los estudiantes del grupo con uno de esos grados SHALL ver la asignación en su Centro de Estudios

#### Scenario: Publicación de asignación a estudiante individual
- **WHEN** el maestro publica un recurso para un estudiante específico como refuerzo personalizado
- **THEN** el sistema SHALL crear la asignación con `destinatario.tipo: 'estudiante'` y `destinatario.estudianteId` y únicamente ese estudiante SHALL ver la asignación

#### Scenario: Intento de publicar recurso no aprobado
- **WHEN** el maestro intenta publicar un recurso con estado distinto de `aprobado`
- **THEN** el sistema SHALL rechazar la operación con error indicando el estado actual del recurso

### Requirement: Asignación tiene apertura y cierre con bloqueo automático
El sistema SHALL respetar las fechas de apertura y cierre de cada asignación. Antes de la apertura, el recurso SHALL mostrarse como `bloqueado` al estudiante. Después del cierre sin completar, el estado SHALL cambiar a `vencido`.

#### Scenario: Asignación antes de su apertura
- **WHEN** el estudiante consulta su Centro de Estudios y hay asignaciones con fecha de apertura futura
- **THEN** el sistema SHALL mostrar esas asignaciones como `bloqueado` sin permitir acceso al recurso

#### Scenario: Asignación vencida sin completar
- **WHEN** la fecha de cierre de una asignación pasa sin que el estudiante la haya completado
- **THEN** el sistema SHALL cambiar el estado del progreso del estudiante a `vencido` y el recurso SHALL mostrarse como no completado en el resumen del maestro y del tutor

### Requirement: Criterio de finalización configurable por tipo de asignación
El sistema SHALL soportar criterios de finalización distintos según el tipo de recurso: para PDF (páginas únicas visualizadas + permanencia mínima + llegada al tramo final), para video (segundos únicos reproducidos ≥ 78 %), para quiz (puntuación ≥ umbral configurable), para actividad práctica (validación presencial del maestro).

#### Scenario: Criterio de finalización PDF cumplido
- **WHEN** el estudiante visualiza todas las páginas requeridas con la permanencia mínima y llega al tramo final del documento
- **THEN** el sistema SHALL marcar el progreso como `completado` automáticamente

#### Scenario: Actividad práctica requiere validación del maestro
- **WHEN** el estudiante declara que completó una actividad práctica
- **THEN** el estado SHALL cambiar a `pendiente_revision` hasta que el maestro valide presencialmente; solo entonces SHALL pasar a `aprobado`
