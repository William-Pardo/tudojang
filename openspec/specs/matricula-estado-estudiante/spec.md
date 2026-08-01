# Matricula Estado Estudiante Specification

## Purpose

Da a `Estudiante` un estado de matrícula persistido y explícito (`activo` / `retirado`), reemplazando "el documento existe" como única señal de "está inscrito". Es la fuente de verdad de la que depende `facturacion-metered` para decidir qué estudiante es facturable — hoy `tipos.ts:173-217` no tiene ese campo, solo `estadoPago`.

## Requirements

### Requirement: Campo de estado de matrícula en Estudiante

`Estudiante` MUST tener un campo `estadoMatricula: 'activo' | 'retirado'`, independiente de `estadoPago` y de cualquier registro de asistencia.

#### Scenario: Estudiante nuevo nace activo

- GIVEN un instructor da de alta un estudiante nuevo (formulario o importación masiva)
- WHEN el registro se crea
- THEN `estadoMatricula` MUST quedar `'activo'`

#### Scenario: Estado de pago no afecta la matrícula

- GIVEN un estudiante `activo` con `estadoPago: 'moroso'` y sin pagos recientes en `historialPagos`
- WHEN se evalúa si sigue matriculado
- THEN `estadoMatricula` MUST seguir `'activo'` — mora de pago MUST NOT cambiarlo automáticamente

#### Scenario: Falta de asistencia no afecta la matrícula

- GIVEN un estudiante `activo` sin asistencia registrada en el último mes
- WHEN se evalúa si sigue matriculado
- THEN `estadoMatricula` MUST seguir `'activo'` — ausencias MUST NOT cambiarlo automáticamente

### Requirement: Retiro explícito, sin borrado físico

El sistema MUST ofrecer una acción de retiro que cambie `estadoMatricula` a `'retirado'` sin eliminar el documento ni su `historialPagos`, progreso o asistencia.

#### Scenario: Retirar un estudiante conserva su historial

- GIVEN un estudiante `activo` con historial de pagos y asistencia
- WHEN un instructor lo retira
- THEN `estadoMatricula` MUST pasar a `'retirado'` y el documento, `historialPagos`, progreso y asistencia MUST seguir existiendo sin cambios

#### Scenario: Reactivar un estudiante retirado

- GIVEN un estudiante `retirado`
- WHEN un instructor lo reactiva
- THEN `estadoMatricula` MUST volver a `'activo'` y MUST contarse como facturable en el siguiente corte

### Requirement: Definición de "facturable"

Un estudiante MUST considerarse facturable si y solo si `estadoMatricula === 'activo'`, sin importar `estadoPago` o asistencia.

#### Scenario: Conteo de facturables de un tenant

- GIVEN un tenant con 40 estudiantes `activo` y 8 `retirado`
- WHEN se cuentan sus estudiantes facturables
- THEN el conteo MUST ser 40, excluyendo los 8 `retirado`
