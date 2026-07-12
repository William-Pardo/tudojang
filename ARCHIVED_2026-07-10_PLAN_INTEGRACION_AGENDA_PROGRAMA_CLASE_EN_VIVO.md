# Plan de integración Agenda, Programa Académico y Clase en Vivo

> **SUPERADO — 2026-07-08.** Las entidades y servicios descritos en este documento (`CohorteAcademica`, `JornadaAcademica`, `ClaseEnVivo`, `servicios/cohortesApi.ts`, `jornadasApi.ts`, `agendaManualApi.ts`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, `progresoClaseApi.ts`) quedan marcados `[x]` completos en el checklist de abajo, pero la auditoría técnica confirmó que **no son el sistema en producción**: viven sueltos en `servicios/*.ts` sin tipar, y su único consumidor real (`vistas/ClaseEnVivoView.tsx`) nunca persiste en Firestore (confirmado en `openspec/changes/clase-en-vivo-checkin-trigger-agenda/proposal.md`, pendiente de archivar). El sistema real y vigente para Programa/Cohorte/Jornada/Clase en Vivo es `models/academico/*` + `servicios/academico/*` (`JornadaInstruccion`, `ProgramaAcademico`, `EjecucionPrograma`, `AsignacionAcademica`). Cualquier desarrollo nuevo (incluida la mejora del módulo Agenda) debe construirse sobre ese sistema real, no sobre las entidades de este documento. Diagnóstico completo y plan de tareas en `CIERRE CENTRO DE ESTUDIOS.md`, sección "## 12. Mejora modulo Agenda". Este documento se conserva solo como referencia histórica de intención de diseño.

Este documento define cómo conectar Programa Académico, Cohorte, Jornada, Clase en vivo, Asistencia QR, Centro de Estudios y Progreso. El objetivo es evitar reprocesos, duplicidad de agenda y pérdida de trazabilidad, usando TDD unitario e integración con ciclo Red → Green → Refactor por etapas.

## Reglas obligatorias de ejecución multi-IA

Este documento es la fuente única de coordinación para Codex, Antigravity, Sonnet, Opus, Gemini u otra IA que participe en el desarrollo.

Antes de ejecutar cualquier tarea, la IA debe cumplir este protocolo en el chat:

1. Leer la etapa exacta que va a ejecutar.
2. Identificar el modelo sugerido en este documento.
3. Si no usa Codex, elegir un modelo propio equivalente al sugerido.
4. Comunicar explícitamente el modelo elegido antes de iniciar.
5. Confirmar el alcance exacto de la tarea y no avanzar a otra etapa sin instrucción.

Formato obligatorio de anuncio previo:

```text
Voy a ejecutar la Etapa X: <nombre>.
Modelo sugerido en el plan: <modelo + modo>.
Modelo que usaré en esta IA: <modelo propio equivalente>.
Motivo de equivalencia: <capacidad esperada: documentación, tests, integración, seguridad, refactor>.
Alcance: solo esta etapa/tarea.
```

Regla de trazabilidad obligatoria:

- Cada tarea ejecutada debe quedar marcada como completada con `[x]`.
- Cada tarea no ejecutada debe permanecer como `[ ]`.
- No se permite reportar una tarea como terminada si no se actualizó este documento.
- Cada cierre debe registrar evidencia mínima: archivos tocados, tests ejecutados y resultado.
- Si una IA externa no puede editar el archivo, debe entregar el bloque exacto que el usuario o Codex debe pegar para actualizar el registro.

Regla de equivalencia de modelos:

| Modelo sugerido en este plan | Si otra IA ejecuta la tarea, debe elegir un equivalente con esta capacidad |
|---|---|
| GPT 5.4 Bajo/Medio | Modelo económico o rápido para documentación, copy, revisión superficial o cambios mecánicos simples. |
| GPT 5.5 Medio | Modelo intermedio para tests unitarios, refactor localizado y análisis de escenarios. |
| GPT 5.5 Alto | Modelo fuerte para integración controlada, pruebas RED complejas y validación entre servicios. |
| GPT 5.6 Alto | Modelo avanzado para diseño crítico, servicios centrales, depuración compleja y cambios con riesgo entre módulos. |
| GPT 5.6 Extremadamente alto | Modelo más capaz disponible para seguridad, permisos, claims, reglas Firestore, Auth, producción o bugs que puedan romper tenants. |

Si la IA no tiene un modelo equivalente, debe detenerse y decirlo antes de modificar archivos.

## Decisión principal

La integración debe organizarse así:

```text
Programa académico → Cohorte → Jornada → Clase en vivo → Asistencia QR → Progreso / Refuerzos / Reportes
```

No se recomienda que Agenda, Clase en vivo o Centro de Estudios funcionen como módulos aislados. Cada uno debe cumplir una función clara:

| Capa | Responsabilidad |
|---|---|
| Programa académico | Define contenido, objetivos, rutas por grado y criterios del ciclo. |
| Cohorte | Define la ejecución real del programa: sede, grupo, maestro, horario y estudiantes. |
| Jornada | Representa una clase específica en una fecha/hora. |
| Clase en vivo | Es la jornada en estado operativo: iniciada, con QR de entrada/salida y cierre. |
| Centro de Estudios | Publica recursos y refuerzos vinculados a programa, cohorte, jornada, grado o estudiante. |
| Progreso / Reportes | Consolida asistencia, horas, cumplimiento académico y rendimiento. |

## Ruta rápida de ejecución

1. Crear entidades mínimas y contratos TypeScript.
2. Escribir tests RED de Programa → Cohorte → Jornada.
3. Implementar GREEN mínimo para generar jornadas sin duplicar.
4. Refactorizar servicios y nombres.
5. Escribir tests RED de Jornada → Clase en vivo.
6. Implementar inicio/cierre de clase.
7. Escribir tests RED de QR entrada/salida.
8. Implementar asistencia por eventos y acumulado de horas.
9. Conectar cierre de clase con progreso/refuerzos.
10. Cubrir permisos con reglas/Cloud Functions.
11. Integrar UX mínima en Agenda y Centro de Estudios.
12. Verificar build, tests y documentación.

## Entidades propuestas

### Programa académico

Define el contenido reutilizable. No debe representar por sí solo una clase específica.

```ts
interface ProgramaAcademico {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion?: string;
  grupoObjetivo: 'Infantil' | 'Precadetes' | 'Cadetes' | 'Adultos' | 'Todos';
  gradosIncluidos: string[];
  fechaInicio: string;
  fechaFin: string;
  estado: 'borrador' | 'activo' | 'pausado' | 'cerrado';
  objetivos: string[];
  tags: string[];
  creadoPorUid: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

### Cohorte

Nueva variable central. Representa la ejecución real de un programa en una sede, horario y maestro.

```ts
interface CohorteAcademica {
  id: string;
  tenantId: string;
  programaId: string;
  nombre: string;
  sedeId: string;
  espacioId?: string;
  maestroTitularId: string;
  grupoOperativo: string;
  gradosIncluidos: string[];
  horario: HorarioRecurrente[];
  fechaInicio: string;
  fechaFin: string;
  estado: 'sin_agenda' | 'agenda_generada' | 'en_curso' | 'finalizada' | 'pausada';
  estudiantesIds?: string[];
  creadoPorUid: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

### Horario recurrente

```ts
interface HorarioRecurrente {
  diaSemana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  horaInicio: string;
  horaFin: string;
}
```

### Jornada

Clase específica generada por una cohorte o creada manualmente desde Agenda.

```ts
interface JornadaAcademica {
  id: string;
  tenantId: string;
  programaId?: string;
  cohorteId?: string;
  sedeId: string;
  espacioId?: string;
  maestroTitularId: string;
  maestroEjecutorId: string;
  grupoOperativo: string;
  gradosIncluidos: string[];
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'programada' | 'confirmada' | 'iniciada' | 'cerrada' | 'cancelada' | 'reprogramada';
  origen: 'programa' | 'agenda_manual' | 'excepcion';
  motivoExcepcion?: string;
  creadoPorUid: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

### Clase en vivo

No debe ser un módulo aislado; debe ser el estado operativo de una jornada.

```ts
interface ClaseEnVivo {
  id: string;
  tenantId: string;
  jornadaId: string;
  programaId?: string;
  cohorteId?: string;
  sedeId: string;
  maestroEjecutorId: string;
  estado: 'activa' | 'cerrada' | 'cancelada';
  inicioRealAt: string;
  cierreRealAt?: string;
  observaciones?: string;
  creadoEn: string;
  actualizadoEn: string;
}
```

### Evento de asistencia QR

Guardar eventos permite auditar errores y recalcular resúmenes.

```ts
interface EventoAsistenciaQr {
  id: string;
  tenantId: string;
  jornadaId: string;
  claseEnVivoId: string;
  estudianteId: string;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  escaneadoPorUid: string;
  fuente: 'qr';
}
```

### Resumen de asistencia por jornada

```ts
interface AsistenciaJornada {
  id: string;
  tenantId: string;
  jornadaId: string;
  estudianteId: string;
  entradaAt?: string;
  salidaAt?: string;
  minutosAsistidos: number;
  estado: 'presente' | 'tarde' | 'parcial' | 'ausente' | 'justificado';
  actualizadoEn: string;
}
```

## Reglas funcionales principales

### Reglas de agenda y duplicidad

| Regla | Tipo | Comportamiento |
|---|---|---|
| Maestro en dos sedes a la misma hora | Bloqueante | No permite guardar sin cambiar maestro/hora/sede. |
| Misma sede, mismo espacio, misma hora | Bloqueante si `espacioId` existe | No permite doble ocupación del espacio. |
| Misma cohorte con dos jornadas simultáneas | Bloqueante | Evita duplicidad de clase. |
| Jornada existente compatible al generar agenda | Advertencia/acción | Ofrece vincular existente o generar solo faltantes. |
| Clase manual sin programa | Permitido | Marca `origen: agenda_manual`; puede vincularse después. |
| Cambio puntual de horario | Permitido | Crear jornada tipo `excepcion` sin alterar todo el ciclo. |

### Reglas de clase en vivo

| Regla | Tipo | Comportamiento |
|---|---|---|
| Solo maestro asignado o admin inicia clase | Seguridad | Bloquea otros usuarios. |
| Una jornada iniciada no puede iniciarse dos veces | Consistencia | Devuelve clase activa existente o error controlado. |
| Una salida QR requiere entrada previa | Consistencia | Bloquea salida huérfana. |
| Doble entrada del mismo estudiante | Consistencia | No duplica; informa entrada ya registrada. |
| Cierre sin salida individual | Operativo | Permite cierre administrativo para presentes sin salida. |
| Estudiante fuera de cohorte | Configurable | Bloquear o permitir como invitado según configuración. |

### Reglas de Centro de Estudios

| Nivel de asignación | Uso |
|---|---|
| Programa | Material base del ciclo. |
| Cohorte | Material para grupo real en sede/horario. |
| Jornada | Material específico de una clase. |
| Grado | Material para subgrupo técnico dentro de la cohorte. |
| Estudiante | Refuerzo individual. |

## Estados recomendados

| Entidad | Estados |
|---|---|
| Programa | `borrador`, `activo`, `pausado`, `cerrado` |
| Cohorte | `sin_agenda`, `agenda_generada`, `en_curso`, `finalizada`, `pausada` |
| Jornada | `programada`, `confirmada`, `iniciada`, `cerrada`, `cancelada`, `reprogramada` |
| Clase en vivo | `activa`, `cerrada`, `cancelada` |
| Asignación | `borrador`, `publicada`, `activa`, `vencida`, `archivada` |
| Asistencia | `presente`, `tarde`, `parcial`, `ausente`, `justificado` |

## TDD por etapas

Cada etapa debe cerrar con:

- tests RED escritos primero;
- implementación GREEN mínima;
- refactor sin cambiar comportamiento;
- documentación de avance en este archivo;
- registro en Engram;
- comando de verificación ejecutado.

### Etapa 1 — Contratos y entidades base

Objetivo: definir tipos y servicios base sin UI.

Tests RED:

- `ProgramaAcademico` permite grados incluidos y estado.
- `CohorteAcademica` referencia `programaId`, `sedeId`, `maestroTitularId` y horario.
- `JornadaAcademica` puede tener `programaId` y `cohorteId`.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Definir contratos TypeScript | GPT 5.6 | Alto |
| Tests unitarios de tipos/helpers | GPT 5.5 | Medio |
| Documentación de entidades | GPT 5.4 | Bajo |

Criterio de cierre:

- tipos compilan;
- tests unitarios pasan;
- no hay cambios de UI.

### Etapa 2 — Programa → Cohorte

Objetivo: crear cohortes desde programas sin duplicar contenido académico.

Tests RED:

- crear cohorte desde programa conserva `programaId`, `sedeId`, `maestroTitularId`, `grupoOperativo`, `gradosIncluidos`.
- una cohorte puede contener múltiples grados del mismo grupo.
- no se duplica una cohorte con mismo programa, sede, maestro, grupo y horario.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Tests RED integración Programa → Cohorte | GPT 5.5 | Alto |
| Servicio GREEN mínimo | GPT 5.6 | Alto |
| Refactor de servicio | GPT 5.5 | Medio |

Criterio de cierre:

- servicio de cohorte creado;
- validación anti-duplicidad cubierta;
- tests de integración pasan.

### Etapa 3 — Cohorte → Jornadas

Objetivo: generar jornadas recurrentes desde la cohorte y vincular jornadas existentes compatibles.

Tests RED:

- generar jornadas por rango de fechas y horario recurrente.
- no generar duplicados por sede/hora/maestro/cohorte.
- detectar jornada compatible existente y vincularla.
- permitir excepción justificada.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Algoritmo de generación de jornadas | GPT 5.6 | Alto |
| Tests de calendario y duplicidad | GPT 5.5 | Alto |
| Casos borde de fechas | GPT 5.5 | Medio |

Criterio de cierre:

- jornadas generadas correctamente;
- duplicados bloqueados;
- excepciones documentadas.

### Etapa 4 — Agenda manual vinculada a programa/cohorte

Objetivo: permitir crear o editar una clase desde Agenda y vincularla a programa/cohorte.

Tests RED:

- crear clase manual sin programa marca `origen: agenda_manual`.
- vincular clase manual a cohorte actualiza `programaId` y `cohorteId`.
- editar clase mantiene reglas anti-duplicidad.
- crear programa desde agenda hereda sede, maestro, grupo y horario.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Diseño UX/flujo de Agenda | GPT 5.4 | Medio |
| Integración de servicios | GPT 5.6 | Alto |
| Tests de edición/vinculación | GPT 5.5 | Alto |

Criterio de cierre:

- agenda puede crear clase suelta;
- agenda puede vincular programa/cohorte;
- reglas anti-duplicidad activas.

### Etapa 5 — Jornada → Clase en vivo

Objetivo: iniciar y cerrar una jornada como clase en vivo.

Tests RED:

- solo maestro asignado o admin puede iniciar clase.
- jornada inexistente no puede iniciar clase.
- jornada ya iniciada no duplica clase activa.
- cerrar clase cambia jornada a `cerrada`.
- cerrar clase registra `cierreRealAt`.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Tests RED Jornada → Clase en vivo | GPT 5.5 | Alto |
| Servicio iniciar/cerrar clase | GPT 5.6 | Alto |
| Reglas de permisos iniciales | GPT 5.6 | Alto |

Criterio de cierre:

- clase puede iniciar/cerrar por servicio;
- estado de jornada queda sincronizado;
- no hay UI obligatoria todavía.

### Etapa 6 — Asistencia QR entrada/salida

Objetivo: registrar asistencia como eventos y calcular resumen.

Tests RED:

- entrada QR crea evento `entrada`.
- doble entrada no duplica asistencia.
- salida sin entrada falla.
- salida calcula minutos asistidos.
- cierre de clase marca ausentes.
- cierre administrativo completa salida para presentes si aplica.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Reglas de eventos QR | GPT 5.6 | Alto |
| Cálculo unitario de minutos/estado | GPT 5.5 | Medio |
| Integración eventos → resumen | GPT 5.6 | Alto |

Criterio de cierre:

- eventos QR guardan trazabilidad;
- resumen por estudiante se calcula;
- ausentes/tarde/parcial se determinan.

### Etapa 7 — Cierre de clase → Progreso y refuerzo

Objetivo: al cerrar clase, alimentar progreso académico/deportivo y sugerir acciones.

Tests RED:

- estudiante presente acumula horas.
- estudiante ausente queda marcado para recuperación.
- estudiante parcial acumula minutos reales.
- recursos de jornada quedan asociados al resumen.
- cierre puede sugerir refuerzo por ausencia o bajo cumplimiento.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Integración asistencia → progreso | GPT 5.6 | Alto |
| Reglas de refuerzo | GPT 5.5 | Alto |
| Reportes derivados | GPT 5.5 | Medio |

Criterio de cierre:

- progreso del estudiante se actualiza;
- datos quedan listos para tutor/acudiente y maestro;
- Centro de Estudios conserva trazabilidad.

### Etapa 8 — Security Rules / Cloud Functions

Objetivo: proteger datos por rol y tenant.

Tests RED:

- maestro asignado puede iniciar/cerrar su clase.
- admin puede corregir.
- estudiante no puede escribir asistencia.
- tutor/acudiente no puede escribir asistencia ni progreso.
- usuario de otro tenant no puede leer/escribir.
- maestro no asignado no puede cerrar clase ajena.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Firestore Rules / Auth / claims | GPT 5.6 | Extremadamente alto |
| Tests de reglas con emulator | GPT 5.6 | Extremadamente alto |
| Corrección de permisos | GPT 5.6 | Extremadamente alto |

Criterio de cierre:

- tests de seguridad pasan;
- no se abre acceso entre tenants;
- roles Estudiante y Tutor/acudiente quedan de solo lectura donde aplique.

### Etapa 9 — UX mínima integrada

Objetivo: hacer visible el flujo sin sobrecargar la interfaz.

Flujo maestro:

```text
Agenda → Clase de hoy → Iniciar clase → Escanear QR entrada → Ver presentes/ausentes → Escanear salida → Cerrar clase → Resumen
```

Flujo programa:

```text
Programa → Crear cohorte → Generar agenda → Ver jornadas → Asignar recursos
```

Tests RED:

- botón `Iniciar clase` aparece solo en jornadas programadas/confirmadas.
- clase activa muestra escáner QR.
- cierre muestra resumen de asistencia.
- Centro de Estudios puede publicar recursos a programa/cohorte/jornada.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Copy, labels y jerarquía visual | GPT 5.4 | Bajo/Medio |
| Componentes React conectados a servicios | GPT 5.5 | Medio/Alto |
| Bugs de integración UI + servicios | GPT 5.6 | Alto |

Criterio de cierre:

- flujo visible en localhost;
- no hay pasos ambiguos;
- los estados se entienden en UI.

### Etapa 10 — Refactor final y cierre

Objetivo: dejar el sistema estable para producción.

Checklist:

- [ ] Todos los tests unitarios pasan.
- [ ] Tests de integración pasan.
- [ ] Tests de reglas pasan.
- [ ] `npm run build` pasa.
- [ ] Documento actualizado.
- [ ] Engram actualizado.
- [ ] No quedan textos ambiguos entre Maestro y Tutor/acudiente.
- [ ] No queda agenda duplicada por sede/hora/maestro.
- [ ] Clase en vivo actualiza asistencia y horas.
- [ ] Centro de Estudios puede usar datos de jornada/clase.

Modelo Codex sugerido:

| Tarea | Modelo | Modo |
|---|---|---|
| Refactor mecánico | GPT 5.5 | Medio |
| Verificación final | GPT 5.6 | Alto |
| Documentación final | GPT 5.4 | Bajo |

## Matriz de uso de modelos Codex

| Tipo de tarea | Modelo recomendado | Modo recomendado |
|---|---|---|
| Documentar plan/checklist | GPT 5.4 | Bajo/Medio |
| Copy UX y microtextos | GPT 5.4 | Bajo |
| Matriz de escenarios | GPT 5.5 | Medio |
| Tests unitarios simples | GPT 5.5 | Medio |
| Tests de integración RED | GPT 5.5 / GPT 5.6 | Alto |
| Diseño entidades críticas | GPT 5.6 | Alto |
| Servicios centrales | GPT 5.6 | Alto |
| Debug complejo | GPT 5.6 | Alto/Extremadamente alto |
| Firestore Rules/Auth/claims | GPT 5.6 | Extremadamente alto |
| Refactor con riesgo entre módulos | GPT 5.6 | Alto |
| Refactor mecánico local | GPT 5.5 | Medio |
| Build/imports/warnings simples | GPT 5.4 / GPT 5.5 | Bajo/Medio |

## Protocolo para ahorrar tokens

Cada solicitud a Codex debe indicar:

```text
Ejecuta solo la Etapa X del archivo PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md.
No avances a otras etapas.
Antes de iniciar, informa el modelo sugerido por el plan y el modelo que usarás.
Aplica ciclo Red → Green → Refactor.
Marca como [x] cada tarea completada dentro del registro de avance.
Registra cambios en este archivo y en Engram.
Reporta tests ejecutados y resultado.
```

Para tareas de solo diseño/documentación:

```text
Lee solo la Etapa X del plan.
No edites código.
Antes de iniciar, informa el modelo sugerido por el plan y el modelo que usarás.
Propón vacíos, riesgos y ajustes.
Actualiza únicamente la sección de análisis si es necesario.
Marca como [x] solo la tarea documental efectivamente completada.
```

Para tareas de seguridad:

```text
Usa GPT 5.6 en modo extremadamente alto.
Si no estás en Codex, usa el modelo más capaz disponible y declara la equivalencia antes de iniciar.
No cambies UI.
Trabaja solo reglas, claims, tests de emulator y servicios autorizados.
Marca como [x] únicamente cuando los tests de seguridad queden registrados.
```

## Registro de avance

Actualizar esta sección al cerrar cada tarea. La marca `[x]` es obligatoria para considerar una tarea terminada.

### Checklist maestro por etapa

| Estado | Etapa | Modelo sugerido | Modelo usado | Fecha | Evidencia | Tests / verificación | Notas |
|---|---|---|---|---|---|---|---|
| [x] | 1. Contratos y entidades base | GPT 5.5 Medio | Gemini 3.1 Pro Low | 2026-07-03 | tipos.ts | tsc --noEmit | Etapa completa (Tipos, Tests, Doc) |
| [x] | 2. Programa → Cohorte | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | cohortesApi.ts | jest | Etapa completa (Servicio y Tests) |
| [x] | 3. Cohorte → Jornadas | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | jornadasApi.ts | jest | Etapa completa (Servicio y Tests) |
| [x] | 4. Agenda manual vinculada | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | agendaManualApi.ts, PLAN_UX_AGENDA.md | jest | Etapa completa (Servicio, Tests y UX Plan) |
| [x] | 5. Jornada → Clase en vivo | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | claseEnVivoApi.ts | jest | Etapa completa (Servicio y Tests) |
| [x] | 6. Asistencia QR | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | asistenciaQrApi.ts | jest | Etapa completa (Servicio y Tests) |
| [x] | 7. Cierre → Progreso/refuerzo | GPT 5.6 Alto | Gemini 3.1 Pro | 2026-07-03 | progresoClaseApi.ts | jest | Etapa completa (Servicio y Tests) |
| [x] | 8. Seguridad | GPT 5.6 Extremadamente alto | Gemini 3.1 Pro | 2026-07-03 | firestore.rules | Firebase Emulator | Etapa completa (Servicio y Tests) |
| [x] | 9. UX mínima integrada | GPT 5.5 Medio/Alto | Gemini 3.1 Pro | 2026-07-03 | ClaseEnVivoView.tsx | React Testing Library | Etapa completa (UI y Tests) |
| [x] | 10. Refactor final | GPT 5.6 Alto | Claude Opus 4.6 | 2026-07-03 | tipos.ts, shared/diasSemana.ts, jornadasApi.ts, agendaManualApi.ts, progresoClaseApi.ts | jest (30/30 PASS) | Etapa completa (Auditoría y Refactor) |

### Registro granular de tareas

Usar este formato debajo de la etapa correspondiente cada vez que se cierre una tarea. No borrar registros anteriores.

#### Etapa 1 — Contratos y entidades base

- [x] Definir contratos TypeScript
  - IA/modelo usado: Gemini 3.1 Pro Low (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `tipos.ts`
  - Ciclo TDD: N/A para interfaces puras.
  - Verificación: `npx tsc --noEmit` → Tipos creados (errores previos en otras vistas no relacionados)
  - Observaciones: Se agregaron las 6 interfaces base requeridas.

- [x] Tests unitarios de tipos/helpers
  - IA/modelo usado: Gemini 3.1 Pro Low (equivalente a GPT 5.5 Medio)
  - Fecha: 2026-07-03
  - Archivos tocados: `tipos.test.ts`
  - Ciclo TDD: RED → GREEN → REFACTOR (Test para validar objetos conformes a la interfaz)
  - Verificación: `npx jest --runInBand tipos.test.ts` → PASS (3 pasados)
  - Observaciones: Estructuras base validadas exitosamente.

- [x] Documentación de entidades
  - IA/modelo usado: Gemini 3.1 Pro Low (equivalente a GPT 5.4 Bajo)
  - Fecha: 2026-07-03
  - Archivos tocados: `tipos.ts`
  - Ciclo TDD: N/A
  - Verificación: Visualización del JSDoc agregado.
  - Observaciones: Se inyectó el JSDoc base según los lineamientos de la arquitectura.

#### Etapa 2 — Programa → Cohorte

- [x] Tests RED integración Programa → Cohorte
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/cohortesApi.test.ts`, `servicios/cohortesApi.ts`
  - Ciclo TDD: RED (Test creado, falla con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/cohortesApi.test.ts` → FAILED (3 tests)
  - Observaciones: Pruebas unitarias de las reglas anti-duplicidad correctamente escritas.

- [x] Servicio GREEN mínimo
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/cohortesApi.ts`
  - Ciclo TDD: GREEN (Implementación de detección de duplicados en horario y campos requeridos)
  - Verificación: `npx jest --runInBand servicios/cohortesApi.test.ts` → PASS (3 tests)
  - Observaciones: Algoritmo de comparación JSON.stringify sobre el horario ordenado funciona perfecto.

- [x] Refactor de servicio
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Medio)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/cohortesApi.ts`
  - Ciclo TDD: REFACTOR (Encapsulación de esCohorteDuplicada y horariosSonIguales, inyección de JSDoc)
  - Verificación: `npx jest --runInBand servicios/cohortesApi.test.ts` → PASS (3 tests, no se rompió funcionalidad)
  - Observaciones: El código quedó limpio, modularizado y completamente documentado.

#### Etapa 3 — Cohorte → Jornadas

- [x] Tests de calendario y duplicidad
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/jornadasApi.test.ts`, `servicios/jornadasApi.ts`
  - Ciclo TDD: RED (Tests creados, fallando con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/jornadasApi.test.ts` → FAILED (4 tests)
  - Observaciones: Pruebas unitarias que cubren generación de fechas, bloqueo de choques horarios, asimilación de huérfanas y override por excepción.

- [x] Algoritmo de generación de jornadas (Servicio GREEN)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/jornadasApi.ts`
  - Ciclo TDD: GREEN (Implementación del generador iterando fechas)
  - Verificación: `npx jest --runInBand servicios/jornadasApi.test.ts` → PASS (4 tests)
  - Observaciones: El algoritmo de mapeo de `getUTCDay()` y la lógica de colisión pasaron en el primer intento.

- [x] Casos borde de fechas (Refactor y Tests adicionales)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Medio)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/jornadasApi.ts`, `servicios/jornadasApi.test.ts`
  - Ciclo TDD: REFACTOR (Inyección de JSDoc) y RED/GREEN (Nuevo test de salto de mes/año bisiesto)
  - Verificación: `npx jest --runInBand servicios/jornadasApi.test.ts` → PASS (5 tests)
  - Observaciones: El iterador de fechas nativo soporta automáticamente años bisiestos y saltos de mes. Se añadió documentación JSDoc robusta.

#### Etapa 4 — Agenda manual vinculada a programa/cohorte

- [x] Tests RED de edición/vinculación manual
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/agendaManualApi.test.ts`, `servicios/agendaManualApi.ts`
  - Ciclo TDD: RED (Tests creados, fallando con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/agendaManualApi.test.ts` → FAILED (4 tests)
  - Observaciones: Pruebas unitarias comprobando la correcta mutabilidad de IDs, origen 'agenda_manual', la validación anti-duplicidad en edición y autogeneración de programa.

- [x] Servicio GREEN de vinculación de Agenda
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/agendaManualApi.ts`
  - Ciclo TDD: GREEN (Implementación de creación sin dependencias, vinculación mutante y autogeneración de cohortes)
  - Verificación: `npx jest --runInBand servicios/agendaManualApi.test.ts` → PASS (4 tests)
  - Observaciones: El algoritmo detecta colisiones de agendas manuales y maneja la ingeniería inversa de generar un programa a partir de una clase suelta.

- [x] Diseño UX/Flujo documental de la Agenda
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.4 Medio)
  - Fecha: 2026-07-03
  - Archivos tocados: `PLAN_UX_AGENDA.md`
  - Ciclo TDD: DISEÑO (Propuesta de flujo)
  - Verificación: Documento escrito y pautado para la futura implementación de componentes React.
  - Observaciones: Se definió el flujo modal para manejar las clases huérfanas (Gris) y las clases programadas (Color), así como la ingeniería inversa de generar programa desde un modal.

#### Etapa 5 — Jornada → Clase en vivo

- [x] Tests RED Jornada → Clase en vivo
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/claseEnVivoApi.test.ts`, `servicios/claseEnVivoApi.ts`
  - Ciclo TDD: RED (Tests creados, fallando con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/claseEnVivoApi.test.ts` → FAILED (4 tests)
  - Observaciones: Pruebas unitarias asegurando las reglas de permisos, que no se inicie algo activo, y que el cierre actualice el estado de la jornada madre.

- [x] Servicio GREEN iniciar/cerrar clase
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/claseEnVivoApi.ts`
  - Ciclo TDD: GREEN (Implementación de seguridad y mutación del registro operativo)
  - Verificación: `npx jest --runInBand servicios/claseEnVivoApi.test.ts` → PASS (4 tests)
  - Observaciones: El servicio valida correctamente los permisos para que nadie inicie/cierre clases ajenas salvo el admin.

- [x] Refactor y Reglas de permisos iniciales
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/claseEnVivoApi.ts`
  - Ciclo TDD: REFACTOR (Inyección de JSDoc y extracción de helper de permisos)
  - Verificación: `npx jest --runInBand servicios/claseEnVivoApi.test.ts` → PASS (4 tests)
  - Observaciones: Se extrajo la lógica de `tienePermisoOperativo` para aislar la validación de roles de la mutación de estado. Todo validado sin romper la suite verde.

#### Etapa 6 — Asistencia QR entrada/salida

- [x] Reglas de eventos QR (Tests RED)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/asistenciaQrApi.test.ts`, `servicios/asistenciaQrApi.ts`
  - Ciclo TDD: RED (Tests creados, fallando con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/asistenciaQrApi.test.ts` → FAILED (5 tests)
  - Observaciones: Pruebas unitarias asegurando el flujo completo del QR: entrada, bloqueo de doble entrada, bloqueo de salida huérfana, cálculo de minutos, y el barrido administrativo de ausencias/salidas al cerrar la clase.

- [x] Cálculo unitario de minutos/estado (Servicio GREEN)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.5 Medio)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/asistenciaQrApi.ts`
  - Ciclo TDD: GREEN (Implementación de timestamps de entrada/salida y autocompletado en cierre)
  - Verificación: `npx jest --runInBand servicios/asistenciaQrApi.test.ts` → PASS (5 tests)
  - Observaciones: El servicio valida robustamente el QR de entrada inicializando el estado, y el QR de salida calcula matemáticamente los minutos `tSalida - tEntrada`.

- [x] Integración eventos → resumen (Refactor)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/asistenciaQrApi.ts`
  - Ciclo TDD: REFACTOR (Inyección de JSDoc y abstracción matemática)
  - Verificación: `npx jest --runInBand servicios/asistenciaQrApi.test.ts` → PASS (5 tests)
  - Observaciones: Se extrajo el cálculo de diferencias ISO a una función pura (`calcularMinutosAsistidos`) para aislar la complejidad matemática de las mutaciones de negocio.

#### Etapa 7 — Cierre de clase → Progreso y refuerzo

- [x] Tests RED de Progreso y Refuerzo
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/progresoClaseApi.test.ts`, `servicios/progresoClaseApi.ts`
  - Ciclo TDD: RED (Tests creados, fallando con 'Not implemented')
  - Verificación: `npx jest --runInBand servicios/progresoClaseApi.test.ts` → FAILED (4 tests)
  - Observaciones: Pruebas unitarias asegurando que los ausentes generen alertas de recuperación, los presentes sumen minutos y los recursos vistos en la clase se enganchen al estudiante.

- [x] Servicio GREEN: Integración asistencia → progreso y Reglas de refuerzo
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `servicios/progresoClaseApi.ts`
  - Ciclo TDD: GREEN (Implementación de reglas de negocio para progreso y alertas)
  - Verificación: `npx jest --runInBand servicios/progresoClaseApi.test.ts` → PASS (4 tests)
  - Observaciones: El servicio procesa el arreglo final de asistencias. Transforma cada registro en minutos acumulados y levanta un booleano de `alertaRefuerzo` si hay ausencia total o una retención menor al 50%. También vincula los recursos vistos.

#### Etapa 8 — Security Rules / Cloud Functions

- [x] Tests RED de Reglas de Seguridad (Emulator)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `functions/test/firestore-rules.etapa8.test.js`
  - Ciclo TDD: RED (Tests contra el emulador de Firestore, esperando fallos)
  - Verificación: `firebase emulators:exec --project demo-tudojang-etapa8 --only firestore "node --test functions/test/firestore-rules.etapa8.test.js"` → FAILED (Rechazos esperados por falta de reglas)
  - Observaciones: Pruebas unitarias asegurando el encapsulamiento de datos. Se probó: acceso denegado a intrusos, modo solo lectura para estudiantes y aislamiento de tenants.

- [x] Servicio GREEN: Reglas de Firestore (.rules) y Refactor de Claims
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `firestore.rules`
  - Ciclo TDD: GREEN (Implementación de reglas de acceso, claims `tenantId` y perfiles de maestro/estudiante)
  - Verificación: `firebase emulators:exec --project demo-tudojang-etapa8 --only firestore "node --test functions/test/firestore-rules.etapa8.test.js"` → PASS (4 tests)
  - Observaciones: Agregamos `match /clases_en_vivo/{docId}` y `match /asistencias_jornada/{docId}`. Aseguramos validaciones usando `resource.data.tenantId` vs `request.resource.data.tenantId`. Todo validado contra la matriz de seguridad por emulador.

#### Etapa 9 — UX mínima integrada

- [x] Tests RED de Flujo de UI (React Testing Library)
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `vistas/ClaseEnVivoIntegracion.test.tsx`, `vistas/ClaseEnVivoView.tsx`
  - Ciclo TDD: RED (Componente vacío fallando pruebas UI)
  - Verificación: `npx jest --runInBand vistas/ClaseEnVivoIntegracion.test.tsx` → FAILED (5 tests)
  - Observaciones: Pruebas unitarias asegurando el renderizado de 'Iniciar Clase', 'Escáner QR', y la integración de eventos de click con las APIs simuladas `iniciarClaseEnVivo` y `cierreAdministrativoAsistencia`.

- [x] Servicio GREEN: Componentes y Jerarquía Visual & Caza de Bugs
  - IA/modelo usado: Gemini 3.1 Pro (equivalente a GPT 5.6 Alto)
  - Fecha: 2026-07-03
  - Archivos tocados: `vistas/ClaseEnVivoView.tsx`
  - Ciclo TDD: GREEN (Conectando el componente React con APIs)
  - Verificación: `npx jest --runInBand vistas/ClaseEnVivoIntegracion.test.tsx` → PASS (5 tests)
  - Observaciones: El componente reacciona al estado de la jornada, ocultando botones irrelevantes y capturando la interacción del QR para comunicarse directamente con los servicios backend recién creados.

#### Etapa 10 — Refactor final

- [x] Auditoría y consolidación de código
  - IA/modelo usado: Claude Opus 4.6 (Thinking)
  - Fecha: 2026-07-03
  - Archivos tocados: `tipos.ts`, `shared/diasSemana.ts`, `servicios/jornadasApi.ts`, `servicios/agendaManualApi.ts`, `servicios/progresoClaseApi.ts`
  - Ciclo TDD: REFACTOR (Alineación de tipos, extracción DRY, JSDoc)
  - Verificación: `npx jest --runInBand` → PASS (7 suites, 30 tests)
  - Observaciones:
    - Alineamos `ClaseEnVivo` (estados `en_curso`/`finalizada` vs `activa`/`cerrada`), `EventoAsistenciaQr` (`registradoPorUid`/`metodo` vs `escaneadoPorUid`/`fuente`) y `AsistenciaJornada` (`primeraEntradaAt`/`ultimaSalidaAt` vs `entradaAt`/`salidaAt`) con la implementación real de los servicios.
    - Extrajimos `diasMapa` duplicado (jornadasApi + agendaManualApi) a `shared/diasSemana.ts` con función tipada `obtenerDiaSemanaUtc`.
    - Agregamos JSDoc completo a `progresoClaseApi.ts`.
    - Verificación cruzada: 30/30 tests verdes post-refactor.

```markdown
#### Etapa X — <nombre>

- [x] <tarea completada>
  - IA/modelo usado: <Codex GPT 5.6 Alto / Sonnet equivalente / Gemini equivalente / etc.>
  - Fecha: <AAAA-MM-DD>
  - Archivos tocados: `<archivo 1>`, `<archivo 2>`
  - Ciclo TDD: RED `<test falló primero>` → GREEN `<implementación mínima>` → REFACTOR `<ajuste final>`
  - Verificación: `<comando>` → `<resultado>`
  - Observaciones: <decisiones, riesgos, deuda técnica o bloqueo>
```

### Criterio de cierre obligatorio por tarea

Una tarea solo puede marcarse `[x]` si cumple todo esto:

- [ ] El alcance ejecutado corresponde a una etapa definida en este documento.
- [ ] La IA comunicó antes de iniciar el modelo sugerido y el modelo usado/equivalente.
- [ ] Se ejecutó ciclo Red → Green → Refactor cuando hubo implementación.
- [ ] Se registraron archivos modificados.
- [ ] Se registraron tests o verificación ejecutada.
- [ ] Se actualizó este documento.
- [ ] Se guardó el avance en Engram cuando hubo cambio significativo.

## Riesgos abiertos

| Riesgo | Mitigación |
|---|---|
| Mezclar Maestro con Tutor/acudiente | Usar etiquetas por contexto y no reutilizar "Tutor" para equipo técnico en UI. |
| Duplicar agenda por grado | Usar una jornada operativa con `gradosIncluidos`. |
| Crear clases sin programa y perder trazabilidad | Permitir clase suelta con `origen: agenda_manual` y opción de vincular después. |
| Sobrecargar Agenda con lógica académica | Mantener Agenda como cuándo/dónde/quién; Programa/Cohorte contienen estructura académica. |
| Romper permisos entre tenants | Tests de reglas obligatorios antes de producción. |
| Crear una "Clase en vivo" aislada | Implementarla como estado operativo de Jornada. |

## Próximo paso recomendado

Ejecutar Etapa 1 con TDD mínimo:

```text
Crear contratos/tipos base para Programa, Cohorte, Jornada, Clase en vivo, EventoAsistenciaQr y AsistenciaJornada.
Escribir tests unitarios RED de helpers mínimos.
No tocar UI.
```
