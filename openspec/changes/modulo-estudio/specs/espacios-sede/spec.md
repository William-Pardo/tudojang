## ADDED Requirements

### Requirement: Admin gestiona espacios físicos por sede
El sistema SHALL permitir al admin del tenant crear y administrar espacios físicos dentro de cada sede. Cada espacio SHALL tener: nombre, capacidad máxima (personas) y lista de usos permitidos (clase, examen, reunión, etc.).

#### Scenario: Creación de espacio físico
- **WHEN** el admin crea un espacio en una sede con nombre, capacidad y usos permitidos
- **THEN** el sistema SHALL registrar el espacio bajo `sedes/{sedeId}/espacios/{espacioId}` y el espacio SHALL estar disponible para asignación en jornadas

#### Scenario: Edición de capacidad de espacio
- **WHEN** el admin edita la capacidad de un espacio existente
- **THEN** el sistema SHALL actualizar el valor y las validaciones de jornadas futuras SHALL usar la nueva capacidad; las jornadas ya confirmadas no SHALL ser afectadas retroactivamente

### Requirement: Espacio participa en validación de jornadas
El sistema SHALL validar que el espacio seleccionado para una jornada esté disponible en el horario planificado y que su capacidad sea suficiente para el grupo. El sistema SHALL también verificar que el uso de la jornada sea compatible con los usos permitidos del espacio.

#### Scenario: Espacio ocupado rechaza nueva jornada
- **WHEN** se intenta confirmar una jornada en un espacio que ya tiene otra jornada confirmada en el mismo horario
- **THEN** la Cloud Function SHALL rechazar la confirmación con error indicando el conflicto de espacio y la jornada que lo ocupa

#### Scenario: Capacidad insuficiente rechaza jornada
- **WHEN** el número de estudiantes del grupo supera la capacidad del espacio seleccionado
- **THEN** la Cloud Function SHALL rechazar la confirmación con error indicando la capacidad del espacio y el tamaño del grupo

#### Scenario: Uso incompatible rechaza jornada
- **WHEN** el tipo de jornada no corresponde a los usos permitidos del espacio seleccionado
- **THEN** la Cloud Function SHALL rechazar la confirmación con error indicando los usos permitidos del espacio

### Requirement: Admin consulta disponibilidad de espacios
El sistema SHALL proveer al admin una vista de disponibilidad de espacios por sede y rango de fechas para facilitar la planificación de jornadas.

#### Scenario: Consulta de disponibilidad de espacio
- **WHEN** el admin selecciona un espacio y un rango de fechas
- **THEN** el sistema SHALL mostrar los bloques horarios ocupados y libres del espacio en ese rango, con referencia a las jornadas que los ocupan
