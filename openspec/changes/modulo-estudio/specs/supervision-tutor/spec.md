## ADDED Requirements

### Requirement: Tutor supervisa progreso de estudiantes vinculados sin modificarlo
El sistema SHALL permitir al tutor ver el progreso, pendientes y fechas de cierre de los estudiantes que le fueron vinculados por el admin. El tutor NO SHALL poder completar actividades, responder quizzes ni alterar el progreso en nombre del estudiante.

#### Scenario: Tutor consulta progreso de estudiante vinculado
- **WHEN** el tutor accede al panel de un estudiante vinculado
- **THEN** el sistema SHALL mostrar todas las asignaciones del estudiante con su estado de progreso, fechas de cierre y resultados de quizzes; todos los controles de consumo SHALL estar deshabilitados para el tutor

#### Scenario: Tutor intenta completar actividad en nombre del estudiante
- **WHEN** el tutor intenta interactuar con controles de consumo (marcar completado, responder quiz)
- **THEN** el sistema SHALL rechazar la acción con error `FORBIDDEN` tanto en la UI como en las reglas de seguridad de Firestore

#### Scenario: Tutor con múltiples estudiantes vinculados
- **WHEN** el tutor tiene más de un estudiante vinculado
- **THEN** el sistema SHALL mostrar un selector de estudiante y, al elegir uno, renderizar su panel de progreso individual

### Requirement: Tutor ve alertas de asignaciones próximas a vencer o vencidas
El sistema SHALL mostrar al tutor un panel de alertas con las asignaciones de sus estudiantes vinculados que estén próximas a vencer (dentro de 7 días) o ya vencidas sin completar, ordenadas por urgencia.

#### Scenario: Alertas de vencimiento en panel del tutor
- **WHEN** el tutor accede a su panel principal
- **THEN** el sistema SHALL mostrar una sección de alertas con asignaciones vencidas o por vencer agrupadas por estudiante, ordenadas por fecha de cierre ascendente
