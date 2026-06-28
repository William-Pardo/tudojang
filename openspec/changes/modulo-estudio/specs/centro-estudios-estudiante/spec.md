## ADDED Requirements

### Requirement: Estudiante consulta y consume materiales de sus asignaciones vigentes
El sistema SHALL proveer al estudiante un Centro de Estudios personal donde pueda ver todas sus asignaciones vigentes (estado `disponible`, `iniciado`, `en_progreso`) ordenadas por fecha de cierre. El estudiante SHALL poder abrir y consumir los recursos autorizados sin acceder directamente a credenciales de Drive.

#### Scenario: Vista de materiales vigentes del estudiante
- **WHEN** el estudiante accede a su Centro de Estudios
- **THEN** el sistema SHALL mostrar todas las asignaciones activas filtradas por su `tenantId`, rol y vínculos vigentes, ordenadas por urgencia (fecha de cierre más próxima primero)

#### Scenario: Consumo de recurso PDF
- **WHEN** el estudiante abre un recurso de tipo PDF
- **THEN** el sistema SHALL obtener una URL temporal de la Cloud Function y renderizar el PDF en el visor integrado, registrando progreso local por páginas visualizadas

#### Scenario: Consumo de recurso de video
- **WHEN** el estudiante reproduce un video
- **THEN** el sistema SHALL obtener la URL temporal y reproducir el video, registrando segundos únicos reproducidos en progreso local

### Requirement: Estudiante presenta quizzes con intentos y umbral configurable
El sistema SHALL permitir al estudiante presentar quizzes como parte de sus asignaciones. Los quizzes SHALL tener número máximo de intentos y umbral de aprobación configurables por el maestro al publicar la asignación.

#### Scenario: Presentación de quiz
- **WHEN** el estudiante abre una asignación de tipo quiz con estado `disponible` o `en_progreso`
- **THEN** el sistema SHALL mostrar las preguntas, registrar las respuestas y calcular la puntuación al finalizar; si la puntuación >= umbral, SHALL marcar el progreso como `aprobado`

#### Scenario: Quiz con intentos agotados
- **WHEN** el estudiante agota el número máximo de intentos sin alcanzar el umbral
- **THEN** el sistema SHALL marcar el progreso como `requiere_refuerzo` y notificar al maestro responsable de la asignación

### Requirement: Estudiante consulta su avance general y próximas evaluaciones
El sistema SHALL mostrar al estudiante un resumen de su progreso: asignaciones completadas vs. pendientes, próximas fechas de cierre y evaluaciones pendientes de validación del maestro.

#### Scenario: Resumen de avance del estudiante
- **WHEN** el estudiante accede a la sección de progreso de su Centro de Estudios
- **THEN** el sistema SHALL mostrar: total de asignaciones, completadas, en progreso, vencidas y próximas a vencer (en los próximos 7 días)
