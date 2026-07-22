# Delta for Academico Programa

## ADDED Requirements

### Requirement: Registro de asistencia por estudiante alimenta el cierre de jornada

`JornadaInstruccion` MUST exponer un sub-estado de asistencia por estudiante (ver `academico-clase-en-vivo`) que alimente `asistenciaRegistrada`/`objetivosImpartidos` sin romper la firma de `cerrarJornada()`.

#### Scenario: Cierre refleja la asistencia real

- GIVEN una jornada `en_curso` con check-ins y objetivos marcados
- WHEN se ejecuta `cerrarJornada()`
- THEN `asistenciaRegistrada` MUST reflejar los check-ins reales, sin cambiar la firma

#### Scenario: Cierre sin asistencia registrada

- GIVEN una jornada `en_curso` sin check-ins
- WHEN se intenta `cerrarJornada()`
- THEN el comportamiento MUST ser igual al actual (sin regresión)
