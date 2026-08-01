# Facturacion Metered Specification

## Purpose

Reemplaza el cobro por plan fijo (`starter`/`growth`/`pro`) por un cobro mensual medido sobre la cantidad real de estudiantes facturables, con tarifa marginal por tramo, más sede/equipo técnico extra. Reemplaza `calcularMontoMensualPesos` (`functions/wompiCobroAutomatico.js:80-101`), que hoy infiere addons comprados diffeando `tenant.limite*` contra el plan base.

## Requirements

### Requirement: Cálculo marginal por tramos

El monto por estudiantes MUST calcularse de forma marginal/progresiva: cada estudiante se factura a la tarifa de SU PROPIO tramo, y los estudiantes de tramos anteriores nunca se recalculan a la tarifa nueva.

| Tramo | Tarifa/estudiante/mes |
|---|---|
| 1–50 | $3.800 |
| 51–150 | $3.400 |
| 151–350 | $3.000 |
| 351+ | $2.600 |

#### Scenario: Tenant dentro del primer tramo

- GIVEN un tenant con 30 estudiantes facturables
- WHEN se calcula el monto
- THEN MUST cobrarse 30 × $3.800, sin tramos adicionales

#### Scenario: Tenant que cruza un tramo

- GIVEN un tenant con 60 estudiantes facturables
- WHEN se calcula el monto
- THEN MUST cobrarse (50 × $3.800) + (10 × $3.400), no 60 × $3.400

#### Scenario: Continuidad exacta en cada límite de tramo

- GIVEN tres pares de tenants con (50,51), (150,151) y (350,351) estudiantes facturables respectivamente
- WHEN se calcula el monto de cada par
- THEN la diferencia dentro de cada par MUST ser exactamente la tarifa marginal del tramo siguiente ($3.400, $3.000 y $2.600 respectivamente), sin salto adicional

#### Scenario: Sin tope superior

- GIVEN un tenant con más de 351 estudiantes facturables
- WHEN se calcula el monto
- THEN el cálculo MUST seguir aplicando la tarifa del tramo 351+ sin límite máximo de estudiantes

### Requirement: Extras de sede y equipo técnico se suman al monto

El monto total MUST incluir el precio de cada sede y cada cupo de equipo técnico por encima de lo incluido (definido por `capacidad-tenant`), a $89.900/mes por sede extra y $36.000/mes por cupo extra, sin descuento por volumen.

#### Scenario: Tenant con una sede extra

- GIVEN un tenant con 1 sede extra activa por encima de la incluida
- WHEN se calcula el monto mensual
- THEN el monto MUST incluir $89.900 adicionales sobre el cálculo de estudiantes

### Requirement: Corte de conteo en la fecha de facturación, sin prorrateo

El conteo de estudiantes facturables MUST tomarse como una foto (snapshot) en el momento en que corre el cobro automático mensual del tenant (mismo corte que usa hoy `cobroAutomaticoMensual` contra `fechaVencimiento`). El sistema MUST NOT prorratear estudiantes matriculados o retirados a mitad de ciclo.

#### Scenario: Estudiante matriculado a mitad de ciclo

- GIVEN un tenant que matricula un estudiante nuevo 10 días antes de su próximo corte
- WHEN corre el corte de facturación
- THEN ese estudiante MUST contarse completo en el monto del mes, sin prorratear por los días restantes

#### Scenario: Estudiante retirado antes del corte no se factura

- GIVEN un estudiante con `estadoMatricula: 'retirado'` antes de la fecha de corte del tenant
- WHEN corre el corte de facturación
- THEN ese estudiante MUST NOT incluirse en el conteo facturable de ese ciclo

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
