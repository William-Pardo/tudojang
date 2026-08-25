# Facturacion Metered Specification

## Purpose

Reemplaza el cobro por plan fijo (`starter`/`growth`/`pro`) por un cobro mensual medido sobre la cantidad real de estudiantes facturables, con tarifa marginal por tramo, más sede/equipo técnico extra. Reemplaza `calcularMontoMensualPesos` (`functions/wompiCobroAutomatico.js:80-101`), que hoy infiere addons comprados diffeando `tenant.limite*` contra el plan base.

## Requirements

### Requirement: Cálculo marginal por tramos

El monto por estudiantes MUST calcularse de forma marginal/progresiva: cada estudiante se factura a la tarifa de SU PROPIO tramo, y los estudiantes de tramos anteriores nunca se recalculan a la tarifa nueva.

| Tramo | Tarifa/estudiante/mes |
|---|---|
| 1–70 | $3.800 |
| 71–150 | $3.600 |
| 151–350 | $3.400 |
| 351+ | $3.000 |

#### Scenario: Tenant dentro del primer tramo

- GIVEN un tenant con 30 estudiantes facturables
- WHEN se calcula el monto
- THEN MUST cobrarse 30 × $3.800, sin tramos adicionales

#### Scenario: Tenant que cruza un tramo

- GIVEN un tenant con 80 estudiantes facturables
- WHEN se calcula el monto
- THEN MUST cobrarse (70 × $3.800) + (10 × $3.600), no 80 × $3.600

#### Scenario: Continuidad exacta en cada límite de tramo

- GIVEN tres pares de tenants con (70,71), (150,151) y (350,351) estudiantes facturables respectivamente
- WHEN se calcula el monto de cada par
- THEN la diferencia dentro de cada par MUST ser exactamente la tarifa marginal del tramo siguiente ($3.600, $3.400 y $3.000 respectivamente), sin salto adicional

#### Scenario: Sin tope superior

- GIVEN un tenant con más de 351 estudiantes facturables
- WHEN se calcula el monto
- THEN el cálculo MUST seguir aplicando la tarifa del tramo 351+ sin límite máximo de estudiantes

### Requirement: Desactivación temporal del descuento por volumen

El sistema MUST soportar desactivar el esquema marginal por tramos sin eliminar su definición, mediante el flag `descuentoVolumenActivo` en `facturacion-config.json`. Cuando `descuentoVolumenActivo` es `false`, el monto por estudiantes MUST calcularse a una tarifa plana única `tarifaEstandarPorEstudiante`, ignorando los tramos (que permanecen definidos en `tramosEstudiantes` para reactivarse solo con volver el flag a `true`).

#### Scenario: Descuento por volumen desactivado (estado vigente desde 2026-08-25)

- GIVEN `descuentoVolumenActivo: false` y `tarifaEstandarPorEstudiante: 4500`
- WHEN se calcula el monto de un tenant con N estudiantes facturables
- THEN el monto por estudiantes MUST ser N × $4.500, sin aplicar tramos ni descuento marginal

### Requirement: Extras de sede y equipo técnico se suman al monto

El monto total MUST incluir el precio de cada sede y cada cupo de equipo técnico por encima de lo incluido (definido por `capacidad-tenant`), a $89.900/mes por sede extra y $36.000/mes por cupo extra, sin descuento por volumen.

#### Scenario: Tenant con una sede extra

- GIVEN un tenant con 1 sede extra activa por encima de la incluida
- WHEN se calcula el monto mensual
- THEN el monto MUST incluir $89.900 adicionales sobre el cálculo de estudiantes

### Requirement: Corte de conteo por período completo, sin prorrateo

El conteo de estudiantes facturables MUST incluir a todo estudiante que estuvo activo en algún momento durante el período de facturación del tenant, no solo en el instante exacto del corte (mismo corte que usa hoy `cobroAutomaticoMensual` contra `fechaVencimiento`). Un estudiante cuenta si está `estadoMatricula:'activo'` en el momento del corte, O si su `fechaRetiro` cae dentro del período actual (posterior al inicio de ese período, aproximado como `fechaVencimiento` menos 1 mes calendario). El sistema MUST NOT prorratear el monto de un estudiante por los días exactos que estuvo activo dentro del ciclo.

#### Scenario: Estudiante matriculado a mitad de ciclo

- GIVEN un tenant que matricula un estudiante nuevo 10 días antes de su próximo corte
- WHEN corre el corte de facturación
- THEN ese estudiante MUST contarse completo en el monto del mes, sin prorratear por los días restantes

#### Scenario: Estudiante retirado antes de que empezara el período actual no se factura

- GIVEN un estudiante con `estadoMatricula: 'retirado'` cuyo `fechaRetiro` es anterior al inicio del período de facturación actual del tenant
- WHEN corre el corte de facturación
- THEN ese estudiante MUST NOT incluirse en el conteo facturable de ese ciclo

#### Scenario: Estudiante retirado dentro del período actual sí se factura

- GIVEN un estudiante que se matriculó y se retiró en algún momento dentro del período de facturación actual del tenant (ej. retirado a los 10 días de un ciclo de 30)
- WHEN corre el corte de facturación
- THEN ese estudiante MUST incluirse en el conteo facturable de ese ciclo, aunque no esté activo el día exacto del corte
- AND esto MUST prevenir el patrón de matricular y retirar repetidamente para evitar el cobro

### Requirement: Único punto de cálculo, compartido

El cálculo del monto MUST vivir en una única función/módulo, consumida sin reimplementación tanto por `wompiCobroAutomatico.js` (cobro real) como por la calculadora pública (`precio-publico-calculadora`).

#### Scenario: Mismo input, mismo output en ambos consumidores

- GIVEN el mismo número de estudiantes facturables y extras
- WHEN se calcula el monto desde el cobro automático y desde la calculadora pública
- THEN ambos MUST producir exactamente el mismo monto, por invocar la misma función

### Requirement: Período de prueba sin selección de plan

Un tenant nuevo MUST iniciar en período de prueba de 7 días (mismo mecanismo `estadoSuscripcion: 'demo'` / gracia ya existente) sin seleccionar plan alguno en el registro. Al finalizar el período de prueba, el tenant MUST pasar a facturación medida normal — con 0 estudiantes matriculados, el monto MUST ser $0 hasta que se matriculen estudiantes.

#### Scenario: Registro sin selección de plan

- GIVEN un club que se registra
- WHEN completa el onboarding
- THEN el flujo MUST NOT pedirle elegir un plan, y MUST iniciar en `estadoSuscripcion: 'demo'` con 7 días de gracia

#### Scenario: Fin de la prueba sin estudiantes matriculados

- GIVEN un tenant cuyo período de prueba de 7 días termina sin haber matriculado estudiantes
- WHEN pasa a facturación medida
- THEN el monto a cobrar MUST ser $0, sin bloquear ni suspender la cuenta por eso
