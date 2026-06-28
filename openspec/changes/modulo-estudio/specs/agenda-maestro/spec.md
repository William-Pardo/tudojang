## MODIFIED Requirements

### Requirement: Bloque horario evoluciona a bloque recurrente con instancias reales
El sistema SHALL introducir el concepto de `BloqueRecurrente` como patrón semanal que define: grupo, sede, espacio, horario recurrente, maestro asignado y disciplina. A partir de cada `BloqueRecurrente` el sistema SHALL generar `JornadaInstruccion` como instancias reales para fechas específicas. Los `BloqueHorario` actuales SHALL mantenerse sin modificación durante la migración y coexistirán con los nuevos `BloqueRecurrente` hasta que el tenant migre explícitamente.

#### Scenario: Generación de jornadas desde bloque recurrente
- **WHEN** el admin activa la generación de jornadas para un `BloqueRecurrente` en un rango de fechas
- **THEN** el sistema SHALL crear una `JornadaInstruccion` en estado `borrador` por cada ocurrencia del patrón en ese rango, vinculada al `bloqueRecurrenteId`

#### Scenario: Coexistencia de BloqueHorario y BloqueRecurrente
- **WHEN** un tenant tiene tanto `BloqueHorario` como `BloqueRecurrente` activos
- **THEN** la agenda SHALL mostrar ambos sin interferencia; los `BloqueHorario` no participan en la validación de conflictos de jornadas

#### Scenario: Maestro asignado a bloque recurrente valida disponibilidad en jornada
- **WHEN** se intenta confirmar una `JornadaInstruccion` generada desde un `BloqueRecurrente`
- **THEN** el sistema SHALL validar que el maestro del bloque no tenga otra jornada confirmada en el mismo horario, como parte de la validación estándar de conflictos
