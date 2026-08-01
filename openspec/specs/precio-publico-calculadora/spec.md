# Precio Publico Calculadora Specification

## Purpose

Ata la calculadora pública de precios (landing) al mismo cálculo que usa el cobro real, eliminando la fórmula duplicada/desalineable que hoy vive en el grid de planes de `vistas/PublicLanding.tsx`.

## Requirements

### Requirement: Misma función de cálculo que el backend

La calculadora pública MUST consumir la misma función de cálculo definida por `facturacion-metered` (no una reimplementación ni una aproximación local). MUST NOT existir una segunda fórmula de precios en el landing.

#### Scenario: Calculadora y cobro coinciden

- GIVEN un visitante ingresa una cantidad de estudiantes en la calculadora
- WHEN compara el resultado contra el monto que `cobroAutomaticoMensual` calcularía para un tenant con esa misma cantidad
- THEN ambos montos MUST ser idénticos

### Requirement: Entrada de estudiantes, sedes y equipo técnico extra

La calculadora MUST permitir ingresar cantidad de estudiantes, sedes extra y cupos de equipo técnico extra, y MUST mostrar el desglose del monto mensual resultante (tramos + extras).

#### Scenario: Simulación con extras

- GIVEN un visitante ingresa 80 estudiantes y 1 sede extra
- WHEN solicita el cálculo
- THEN la calculadora MUST mostrar el monto por tramos de estudiantes más el costo de la sede extra, sumados

### Requirement: Reemplazo del grid de planes fijos

La calculadora pública MUST reemplazar el grid de planes fijos (`starter`/`growth`/`pro`) como superficie de conversión del landing.

#### Scenario: Landing sin planes fijos

- GIVEN un visitante entra al landing
- WHEN busca información de precios
- THEN MUST encontrar la calculadora en vez de tarjetas de plan fijas
