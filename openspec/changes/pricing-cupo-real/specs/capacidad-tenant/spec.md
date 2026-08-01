# Capacidad Tenant Specification

## Purpose

Reemplaza el modelo de límites derivado de plan (`starter`/`growth`/`pro`) por un modelo de capacidad post-plan: franquicia incluida sin costo, extras pagos sin tope duro, un bono permanente por crecimiento, y una única fuente de verdad para "cuánta capacidad tiene este tenant" — hoy 4 lectores (`sedes.js`, `estudiantes.js`, `utils/limitesSaas.ts`, `vistas/Estudiantes.tsx`) calculan el límite de forma distinta.

Nota (dependencia, no parte de este alcance): `cuposSedesAdicionales` es hoy leído pero nunca escrito en producción (ERR-0013, bitácora, abierto) — un club puede pagar por una sede extra y seguir bloqueado. Este cambio no corrige ERR-0013 directamente, pero la fuente única de verdad que introduce reemplaza los 4 lectores que dependían de ese campo roto, eliminando la divergencia por construcción.

## Requirements

### Requirement: Capacidad incluida sin costo

Todo tenant MUST tener incluidos, sin costo adicional, 1 sede y 3 cupos de equipo técnico (el owner/Admin cuenta dentro de esos 3).

#### Scenario: Tenant nuevo sin extras

- GIVEN un tenant recién creado, sin sedes ni equipo técnico extra comprados
- WHEN se consulta su capacidad
- THEN MUST reportar 1 sede y 3 cupos de equipo técnico disponibles, a costo $0

### Requirement: Fuente única de verdad para la capacidad

El sistema MUST exponer un único cálculo de capacidad de sede y de equipo técnico, consumido por todo lector (Cloud Functions y frontend). Los 4 cálculos divergentes existentes MUST quedar reemplazados por este único cálculo.

#### Scenario: Todos los lectores coinciden

- GIVEN un tenant con capacidad conocida (incluida + bono + extras)
- WHEN `sedes.js`, `estudiantes.js`, el frontend y cualquier otro lector calculan su límite
- THEN todos MUST obtener el mismo número, por venir de la misma fuente

### Requirement: Sin tope duro de matrícula, con guardrail de crecimiento anómalo

El sistema MUST NOT bloquear la creación de estudiantes por límite de plan o capacidad (reemplaza el bloqueo server-side existente en `crearEstudiante`, `functions/academico/estudiantes.js`). En su lugar, MUST generar una alerta visible para el rol SuperAdmin (superficie: `vistas/MasterDashboard.tsx`) cuando un tenant cruza un umbral de crecimiento anómalo configurable, con default: más de 100 matrículas nuevas activas en una ventana móvil de 7 días.

#### Scenario: Alta de estudiante nunca se bloquea por capacidad

- GIVEN un tenant en cualquier volumen de estudiantes activos
- WHEN se da de alta un estudiante nuevo
- THEN la creación MUST NOT rechazarse por límite de capacidad o plan

#### Scenario: Crecimiento anómalo dispara alerta, no bloqueo

- GIVEN un tenant que registra 101 matrículas nuevas activas en los últimos 7 días
- WHEN se evalúa el guardrail
- THEN el sistema MUST generar una alerta visible para SuperAdmin para revisión manual, y MUST NOT bloquear ni revertir ninguna matrícula
- AND el club MUST seguir operando sin restricción

#### Scenario: Umbral configurable

- GIVEN el umbral configurado en un valor distinto al default (ej. 50 estudiantes / 3 días)
- WHEN un tenant lo cruza
- THEN el guardrail MUST evaluarse contra el valor configurado, no un valor fijo en código

### Requirement: Bono de sede por crecimiento, permanente

La primera vez que un tenant cruza 70 estudiantes matriculados activos, el sistema MUST otorgar +1 sede incluida de forma permanente, en el momento de la matrícula que cruza el umbral. El otorgamiento MUST persistirse en un flag de tenant (equivalente a `sedeBonusOtorgada: true`) que, una vez `true`, MUST NOT recalcularse ni revocarse aunque el conteo vuelva a bajar de 70.

#### Scenario: Cruce del umbral otorga el bono de inmediato

- GIVEN un tenant con 69 estudiantes activos y sin el bono otorgado
- WHEN se matricula el estudiante número 70
- THEN el tenant MUST ganar +1 sede incluida en ese mismo momento, visible sin esperar al corte de facturación

#### Scenario: El bono sobrevive una caída de matrícula

- GIVEN un tenant con el bono ya otorgado
- WHEN su conteo de estudiantes activos baja de 70 (por retiros)
- THEN el bono MUST seguir activo y la sede adicional incluida MUST NOT retirarse

#### Scenario: El bono se otorga una sola vez

- GIVEN un tenant que ya tiene el bono otorgado
- WHEN vuelve a cruzar 70 estudiantes activos en el futuro (tras haber bajado y vuelto a subir)
- THEN el sistema MUST NOT otorgar un segundo bono ni duplicar la sede incluida
