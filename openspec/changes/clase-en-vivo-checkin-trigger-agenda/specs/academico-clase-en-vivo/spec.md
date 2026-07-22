# Academico Clase en Vivo Specification

## Purpose

Check-in/check-out por estudiante sobre `JornadaInstruccion`, disparado desde Agenda con ventana dinámica, reemplazando sistemas paralelos desconectados (Bloque A). Extiende el flujo con selector de clase múltiple, campos completos de check-in/check-out, checkpoint de materiales, notificación a acudientes, observaciones grupales y estado derivado (Bloque B).

## Requirements — Bloque A (base)

### Requirement: Registro de check-in y check-out por estudiante

El sistema MUST registrar vía callable, ligado al `jornadaId` de una jornada `en_curso`: 1er escaneo = check-in, 2do = check-out, 3ro MUST rechazarse.

#### Scenario: Check-in y check-out alternan por escaneo

- GIVEN un estudiante del roster sin check-in
- WHEN se escanea su QR dos veces
- THEN check-in/check-out MUST persistirse con `jornadaId`, `estudianteId` y hora; el 3er escaneo MUST rechazarse

### Requirement: Validación de pertenencia vía roster explícito

El sistema MUST validar pertenencia con `exists()` sobre `tenants/{t}/ejecucionesPrograma/{ejecucionProgramaId}/inscripciones/{estudianteId}` (`InscripcionEjecucionPrograma`). MUST NOT inferirse por grado/grupo.

#### Scenario: Sin inscripción en el roster se rechaza

- GIVEN un estudiante SIN inscripción en esa `EjecucionPrograma`, aunque comparta grado/grupo con otra sección
- WHEN se escanea su QR
- THEN MUST rechazarse con mensaje claro, sin persistir nada

#### Scenario: Ejecución activa sin roster aún (fail-closed)

- GIVEN una `EjecucionPrograma` con jornadas `en_curso` sin inscripciones
- WHEN cualquier estudiante intenta check-in
- THEN MUST rechazarse todo check-in hasta matricular al menos uno; fail-closed esperado, no bug

### Requirement: Matrícula manual en el roster de una ejecución

Admin, Editor, Asistente o SuperAdmin MAY matricular/retirar estudiantes de una `EjecucionPrograma` (`AsignacionesView.tsx`); UI MUST sugerir por grado/grupo y persistir solo tras confirmación manual.

#### Scenario: Sugerencia requiere confirmación manual

- GIVEN candidatos sugeridos por grado/grupo para una `EjecucionPrograma`
- WHEN el Admin/Instructor abre la matrícula
- THEN la inscripción MUST persistirse solo tras selección manual, nunca automáticamente

### Requirement: Validación de rol autorizado

Solo instructor de la jornada, Admin, Editor o Asistente del tenant MAY escanear; Estudiante/Tutor MUST NOT, validado server-side.

#### Scenario: Rol no autorizado intenta escanear

- GIVEN un usuario con rol Estudiante o Tutor
- WHEN invoca el callable
- THEN MUST rechazarse server-side

### Requirement: Reglas Firestore para la colección de asistencia

La colección de asistencia MUST tener reglas explícitas (no deny catch-all) validando tenant+rol+pertenencia; reglas huérfanas `clases_en_vivo`/`asistencias_jornada` MUST retirarse.

#### Scenario: Escritura directa o lectura cross-tenant se deniegan

- GIVEN un cliente que evita el callable, o de otro tenant
- WHEN escribe o lee asistencia de otro tenant
- THEN la regla Firestore MUST denegar ambos casos

### Requirement: Ventana de tiempo dinámica en Agenda (MODIFIED en Bloque B — ancla y valores corregidos)

Agenda y el callable MUST calcular disponibilidad vía `ahora ∈ [horaInicio - LIVE_CLASS_OPEN_BEFORE_MINUTES, horaFin + LIVE_CLASS_CLOSE_AFTER_MINUTES]`, constantes centralizadas en 15/15 minutos (`constantes.ts` cliente, `functions/academico/constantesClaseEnVivo.js` Functions). El cierre MUST anclarse a `horaFin`, no a `horaInicio`. La validación MUST repetirse server-side dentro del callable de asistencia, no solo ocultando el botón en UI.
(Previously: ventana `[horaInicio-5min, horaInicio+10min]`, cierre anclado a `horaInicio`, sin validación server-side.)

#### Scenario: Ventana abierta hasta horaFin+15

- GIVEN una jornada con `horaInicio=10:00`, `horaFin=11:00`
- WHEN son las 11:14
- THEN la clase MUST seguir disponible para check-in/check-out

#### Scenario: Ventana cerrada tras horaFin+15

- GIVEN la misma jornada
- WHEN son las 11:16
- THEN la clase MUST NOT estar disponible; el callable MUST rechazar con `failed-precondition`

#### Scenario: Rechazo server-side aunque la UI oculte el botón

- GIVEN una llamada directa al callable fuera de ventana
- WHEN se invoca `registrarAsistenciaJornada`
- THEN MUST rechazarse server-side, sin depender de que el cliente oculte el botón

### Requirement: Navegación de Agenda a Clase en Vivo con jornadaId real

Al activarse la ventana, Agenda MUST navegar a Clase en Vivo con el `jornadaId` real, no `jornada-demo`.

#### Scenario: Navegación con contexto real

- GIVEN una jornada activa en su ventana
- WHEN el usuario hace clic en Clase en Vivo
- THEN MUST navegar cargando la `JornadaInstruccion` real, no datos demo

#### Scenario: Sin jornada activa

- GIVEN ninguna jornada en ventana
- WHEN se intenta acceder a Clase en Vivo
- THEN MUST impedirse el acceso o mostrar estado vacío

### Requirement: Archivo del Sistema B

`ClaseEnVivoView.tsx`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, tipos de `tipos.ts:542-639` y su test MUST archivarse (no eliminarse), sin referencias en `App.tsx`. Se documenta ADDED (dominio sin spec previa).

#### Scenario: Ruta /clase-en-vivo sirve el flujo unificado

- GIVEN el cambio aplicado
- WHEN se navega a `/clase-en-vivo`
- THEN MUST renderizarse el flujo nuevo sobre `JornadaInstruccion`, no `ClaseEnVivoView`

## Requirements — Bloque B (ADDED)

### Requirement: Selector de clase activa múltiple

Cuando `calcularJornadasEnVentana` retorna 2+ jornadas tras `filtrarJornadasPorPermiso`, el sistema MUST mostrar un selector antes de montar `ClaseEnVivoView`. Editor (maestro) MUST ver solo jornadas con `instructorId===uid`; Admin/SuperAdmin/Asistente MUST ver todas las del tenant.

#### Scenario: Dos jornadas simultáneas del mismo maestro

- GIVEN dos `JornadaInstruccion` del mismo instructor en ventana simultánea
- WHEN el maestro abre Clase en Vivo
- THEN el sistema MUST mostrar un selector con ambas jornadas

#### Scenario: Maestro no ve jornadas de otro instructor

- GIVEN una jornada en ventana de otro instructor
- WHEN el maestro (Editor) consulta jornadas activas
- THEN esa jornada MUST NOT aparecer en su selector

### Requirement: Registro extendido de check-in y check-out

El callable MUST calcular y persistir server-side: en la rama de entrada, `isLate`/`minutesLate` (si `checkInTime > horaInicio`); en la rama de salida, `durationMinutes`/`attendanceStatus:'completa'`. Ambas ramas MUST persistir `checkedInBy`/`checkedOutBy`, `teacherId`, `venueId`.

#### Scenario: Check-in tardío calcula minutesLate

- GIVEN `horaInicio=10:00` y un check-in a las 10:12
- WHEN se registra el check-in
- THEN `isLate` MUST ser `true` y `minutesLate` MUST ser `12`

#### Scenario: Check-out calcula duración y cierra estado

- GIVEN un check-in previo a las 10:12
- WHEN se registra check-out a las 10:57
- THEN `durationMinutes` MUST ser `45` y `attendanceStatus` MUST pasar a `'completa'`

### Requirement: Checkpoint de materiales en 3 sub-fases

El sistema MUST permitir marcar `checkpointInicio`, `checkpointAvance`/`checkpointNota` y `checkpointCierre` sobre `AsignacionAcademica` vía el callable existente `publishAsignacion`. El checkpoint de inicio MUST NOT bloquear el check-in de estudiantes.

#### Scenario: Checkpoint completo en las 3 sub-fases

- GIVEN materiales asignados a la jornada
- WHEN el maestro marca inicio, avance y cierre con confirmación
- THEN los 3 campos MUST persistirse sobre `AsignacionAcademica` sin alterar un `estado` terminal previo

#### Scenario: Check-in no bloqueado por checkpoint pendiente

- GIVEN una jornada sin checkpoint de inicio completado
- WHEN un estudiante escanea su QR de check-in
- THEN el check-in MUST aceptarse igual, sin exigir el checkpoint

### Requirement: Notificación a acudientes tras check-out

Tras un check-out exitoso, el sistema MUST ofrecer disparo client-side de notificación (hora salida, sede, clase) vía `notificacionesApi.ts`, persistiendo `notificationStatus`.

#### Scenario: Notificación enviada con acudiente registrado

- GIVEN un estudiante con acudiente registrado y check-out recién confirmado
- WHEN se dispara la notificación
- THEN `notificationStatus` MUST quedar `'enviada'` (o `'fallida'` con reintento si el envío falla)

#### Scenario: Sin acudiente registrado no bloquea el check-out

- GIVEN un estudiante sin acudiente registrado
- WHEN se confirma su check-out
- THEN el check-out MUST persistirse igual y `notificationStatus` MUST ser `'no_aplica_sin_acudiente'`, sin error

### Requirement: Observaciones rápidas grupales

El sistema MUST permitir registrar una `ObservacionRapidaClase` por jornada con una categoría fija (de 8 predefinidas) y nota corta opcional, sin exigir nota individual por estudiante.

#### Scenario: Registro de observación grupal

- GIVEN una clase en curso
- WHEN el maestro selecciona `'buena_energia'` y agrega una nota corta
- THEN la observación MUST persistirse ligada al `jornadaId`, sin requerir una entrada por estudiante

### Requirement: Roles y permisos simétricos en check-in y check-out (MODIFIED en Bloque B)

La validación de rol de "Validación de rol autorizado" MUST aplicar simétricamente a check-in y check-out (mismo callable/toggle). Estudiante y Acudiente/Tutor MUST NOT operar ninguna de las dos acciones, sin excepción.

#### Scenario: Acudiente intenta registrar un check-out

- GIVEN un usuario con rol Tutor/Acudiente y un estudiante con check-in previo
- WHEN intenta invocar el callable para el check-out
- THEN MUST rechazarse server-side igual que en check-in

### Requirement: Casos especiales críticos de integridad

El sistema MUST rechazar, con mensaje claro y sin excepción no controlada: doble check-in, check-out sin check-in previo, estudiante de otro tenant; y MUST manejar QR inválido sin crashear.

#### Scenario: Doble check-in rechazado

- GIVEN un estudiante con check-in ya registrado en la jornada
- WHEN se reintenta un check-in para el mismo estudiante
- THEN MUST rechazarse (el segundo escaneo se interpreta como check-out, no como check-in duplicado)

#### Scenario: Check-out sin check-in previo

- GIVEN un estudiante sin documento de asistencia en la jornada
- WHEN se intenta registrar su check-out
- THEN MUST rechazarse con `failed-precondition`, sin crear registro huérfano

#### Scenario: Estudiante de otro tenant

- GIVEN un `estudianteId` que pertenece a otro tenant
- WHEN se invoca el callable con el `tenantId` de la sesión actual
- THEN MUST rechazarse por `assertTenantAutorizado`, sin persistir nada

#### Scenario: QR inválido no crashea el escáner

- GIVEN un QR que no corresponde a un `estudianteId` válido
- WHEN `EscanerAsistencia` lo procesa
- THEN MUST mostrarse un mensaje de error claro ("Código QR inválido"), sin detener la cámara ni lanzar una excepción no controlada

### Requirement: Estado derivado de Clase en Vivo

`calcularEstadoClaseEnVivo(jornada, ahoraIso, tieneCheckIns)` MUST derivar `scheduled|available|in_progress|closed|expired|cancelled` en cada lectura; MUST NOT persistirse como campo en `JornadaInstruccion`.

#### Scenario: Cancelled tiene prioridad sobre el tiempo

- GIVEN una jornada con `estado==='cancelada'` y `ahora` dentro de su ventana horaria
- WHEN se calcula el estado de Clase en Vivo
- THEN MUST retornar `'cancelled'`, sin importar la condición de tiempo

#### Scenario: Expired cuando pasó la ventana sin cierre

- GIVEN una jornada con `estado==='en_curso'` y `ahora > horaFin + 15min`
- WHEN se calcula el estado de Clase en Vivo
- THEN MUST retornar `'expired'`

#### Scenario: In_progress con check-ins dentro de ventana

- GIVEN una jornada `en_curso` dentro de su ventana horaria, con al menos 1 check-in registrado
- WHEN se calcula el estado
- THEN MUST retornar `'in_progress'`
