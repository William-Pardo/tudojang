# Delta for Academico Biblioteca

## MODIFIED Requirements

### Requirement: Selección de aprobados unificada en Centro de recursos

El grid de aprobados MUST seguir viviendo en `BibliotecaView.tsx`, expuesto vía callback. La selección MUST enrutarse al Paso 1 del asistente unificado para la clase activa.
(Previously: se enrutaba al "grupo activo" entre `GrupoPublicacion`, concepto eliminado.)

#### Scenario: La selección llega al Paso 1 de la clase activa

- GIVEN el asistente abierto en Paso 1
- WHEN el usuario confirma una selección desde `BibliotecaView`
- THEN esos recursos MUST integrarse a la lista, excluyendo los ya asignados a esa clase
