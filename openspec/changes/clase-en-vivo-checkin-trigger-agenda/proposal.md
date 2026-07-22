# Proposal: Clase en Vivo — depuración de fuente de verdad (Bloque A) y funcionalidad completa de check-in/check-out/checkpoint (Bloque B)

## Intent

Hoy existen 3 sistemas paralelos y desconectados para "Clase en Vivo", ninguno cumple el requisito de negocio: check-in/check-out por estudiante vía QR de carnet, trazabilidad por grado/programa, horas acumuladas, y sincronización con Centro de Estudios. El Sistema B (`ClaseEnVivoView.tsx`+`claseEnVivoApi.ts`) es una fachada con un bug de firma confirmado (llamada posicional vs objeto) que rompe Iniciar/Cerrar Clase silenciosamente, y nunca persiste en Firestore. El Sistema C (`EscanerAsistencia.tsx`) tiene cámara QR real pero está desconectado de jornada/grado/programa y su colección `asistencia` no tiene regla Firestore (cae en el deny catch-all — riesgo de producción). Agenda no dispara nada: `App.tsx:78` tiene un placeholder literal que siempre muestra el ítem del menú.

**Ampliación de alcance (esta revisión)**: por instrucción explícita del usuario ("necesito que uses [`Módulo Clase en Vivo.txt`] como instrucción para el desarrollo de este módulo Clase en Vivo, pero que antes se apliquen previamente los fix encontrados para que este desarrollo se aplique de manera posterior sobre un módulo depurado, sin múltiples fuentes de verdad, conexiones incompletas, rotas o irreales"), este change se estructura en **dos bloques secuenciales dentro del mismo change** (no se crea un change nuevo):

- **Bloque A — Depuración y unificación** (ya diseñado en la revisión anterior de este proposal/design: Fase 0 roster explícito + Fases 1-5 de unificación sobre `JornadaInstruccion`/archivado del Sistema B). Se ejecuta **primero**. Al terminar, el módulo debe quedar con una única fuente de verdad (`JornadaInstruccion`), sin bugs críticos conocidos, sin conexiones rotas.
- **Bloque B — Funcionalidad completa "Clase en Vivo"** (nuevo en esta revisión, derivado 1:1 de `E:\Apps\Tudojang\Módulo Clase en Vivo.txt`, especificación funcional completa del usuario). Se construye **después**, sobre la base ya depurada del Bloque A — no arranca hasta que Bloque A esté implementado y verificado (`sdd-verify`). Debe cubrir la totalidad de los requisitos funcionales del `.txt` (18 secciones: alcance, propósito, activación temporal, relación con Agenda, relación con Centro de Estudios, check-in QR, check-out QR, notificación a acudientes, checkpoint de materiales en 3 sub-fases, observaciones rápidas, métricas/trazabilidad, roles/permisos, seguridad/integridad, estados, flujo visual de 5 secciones, 16 casos especiales, fases de implementación, criterios de aceptación).

**Dependencia obligatoria**: Bloque B se apoya en las piezas que construye Bloque A (roster explícito `InscripcionEjecucionPrograma`, callable server-side de asistencia, `JornadaInstruccion` como única fuente de verdad, `EscanerAsistencia.tsx` rewireado). Ejecutar Bloque B antes o en paralelo con Bloque A reproduciría exactamente el problema original: lógica de check-in construida sobre conexiones rotas o múltiples fuentes de verdad. Por eso el gate es secuencial y bloqueante, no solo una preferencia de orden.

**Actualización de scope previa (decisión de producto post-exploración de diseño, se mantiene)**: la validación de pertenencia estudiante↔jornada no puede resolverse por inferencia de atributos (grado/grupo del estudiante contra el grupo objetivo de la jornada) porque **no existe hoy ningún roster explícito de estudiantes matriculados** en un `ProgramaAcademico`/`EjecucionPrograma` real — se confirmó por lectura de código que el único campo con `estudiantesIds` explícito del repo pertenece a un tercer modelo de "Programa" (`CohorteAcademica`, `tipos.ts:556`) completamente desconectado del dominio académico usado en este change. Además, la inferencia por atributo no distingue dos secciones simultáneas del mismo grado (mismo `grupoObjetivo`, distinta `EjecucionPrograma`), lo cual rompe la trazabilidad precisa que el negocio necesita. Por eso el Bloque A incluye la construcción de un **roster de matrícula explícito** como prerrequisito del check-in — no es un detalle de implementación, es una pieza de producto nueva.

## Nota crítica: discrepancia en la ventana temporal (5/10 → 15/15) y cambio de ancla

El diseño previo de este change (instrucción verbal del usuario en la sesión anterior) especificaba una ventana de **5 minutos antes / 10 minutos después de `horaInicio`** de la jornada, ambos bordes anclados al inicio de la clase (`ventana [horaInicio-5min, horaInicio+10min]`, ver `design.md` Decisión 7 y tabla de archivos, versión previa).

El `.txt` (fuente más reciente y explícita, con constantes nombradas) especifica algo distinto en dos aspectos, no solo el valor numérico:

```ts
LIVE_CLASS_OPEN_BEFORE_MINUTES = 15
LIVE_CLASS_CLOSE_AFTER_MINUTES = 15
```

> "Clase en Vivo se habilita 15 minutos antes de iniciar la clase."
> "Clase en Vivo permanece disponible hasta 15 minutos después de **finalizar** la clase."

1. **Valor numérico**: 15/15 en vez de 5/10.
2. **Ancla del cierre de ventana (hallazgo verificado por lectura de código, no solo el `.txt`)**: el diseño previo cerraba la ventana a `horaInicio + 10min`, es decir, ignoraba por completo la duración real de la clase — una jornada de 90 minutos se cerraría 80 minutos antes de terminar. El `.txt` ancla el cierre a `horaFin + 15min` (fin real de la clase), no a `horaInicio`. Se confirmó que `JornadaInstruccion` ya tiene ambos campos (`models/academico/jornada.ts:14-15,34-35`: `horaInicio`, `horaFin`), así que el cambio de ancla es implementable sin modelo nuevo.

Por instrucción explícita del usuario ("usalo como instrucción para el desarrollo"), **el `.txt` prevalece**. Se actualiza todo el proposal/design de este change para usar:

```ts
ventanaAbierta = ahora >= (horaInicio - LIVE_CLASS_OPEN_BEFORE_MINUTES)
              && ahora <= (horaFin + LIVE_CLASS_CLOSE_AFTER_MINUTES)
```

vía constantes centralizadas nombradas (`LIVE_CLASS_OPEN_BEFORE_MINUTES`, `LIVE_CLASS_CLOSE_AFTER_MINUTES`), no valores hardcodeados repetidos en `Horarios.tsx`, `App.tsx` y `ventanaClaseEnVivoService.ts` (violación explícita que el propio `.txt` prohíbe en su sección 3: "No quemar estos valores de forma rígida en varios lugares del código"). Este ajuste de ancla y valor aplica al `calcularVentanaClaseEnVivo` de Bloque A (Fase 4), que se corrige en este mismo change antes de que Bloque B lo consuma — no se implementa dos veces.

## Scope

### Bloque A — Depuración y unificación (prerrequisito bloqueante, se ejecuta primero)

#### In Scope
- **Roster explícito de matrícula** por `EjecucionPrograma`: modelo, repositorio, reglas Firestore y una UI de matrícula (nueva, en `AsignacionesView.tsx`) donde un admin/instructor inscribe estudiantes a una ejecución de programa concreta, con sugerencia por atributo grado/grupo pero confirmación manual — sin esto, el check-in no tiene contra qué validar pertenencia
- Modelo de asistencia por estudiante ligado a `JornadaInstruccion` (check-in, check-out, horas de la sesión), alimentando `asistenciaRegistrada`/`objetivosImpartidos` que ya exige `cerrarJornada()`
- Callable(s) server-side en `functions/academico/` para check-in/check-out vía QR, con validación de pertenencia estudiante↔jornada contra el roster explícito de matrícula (no inferencia por atributos, no escritura directa desde cliente)
- Reescribir la UI de escaneo reusando `EscanerAsistencia.tsx` (cámara `BarcodeDetector` real) rewireado con contexto real de jornada
- Reglas Firestore nuevas para: (a) el roster de matrícula por `EjecucionPrograma`, y (b) la colección de asistencia por-estudiante con validación de pertenencia; retirar reglas huérfanas de `clases_en_vivo`/`asistencias_jornada`
- Ventana de tiempo real (**15 min antes de `horaInicio` / 15 min después de `horaFin`**, vía `LIVE_CLASS_OPEN_BEFORE_MINUTES`/`LIVE_CLASS_CLOSE_AFTER_MINUTES` centralizadas — ver nota de discrepancia arriba) en Agenda (`Horarios.tsx`)/`App.tsx`, reemplazando el placeholder de `App.tsx:78`
- Agenda dispara la vista de Clase en Vivo con contexto real (`jornadaId`, grado, programa)
- Archivar (no abandonar) Sistema B: `ClaseEnVivoView.tsx`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, tipos `JornadaAcademica`/`ClaseEnVivo`/`EventoAsistenciaQr`/`AsistenciaJornada` en `tipos.ts:542-639`, y su test `ClaseEnVivoIntegracion.test.tsx`

#### Out of Scope (queda dentro de Bloque A, diferido a change futuro)
- Rediseño de UX no relacionado de `Horarios.tsx` más allá del trigger de ventana
- Matrícula granular por jornada individual (invitados/clases de prueba sueltas) — el roster de este change matricula a nivel `EjecucionPrograma` completo
- Historial/estados de matrícula (ej. reingreso, pausas) — alta/baja es un `delete` físico del documento de inscripción, sin campo `estado` intermedio operativo en esta versión
- Migración retroactiva de estudiantes ya "asistiendo" hoy a clases sin matrícula formal — el roster arranca vacío; un admin debe completarlo manualmente antes de que el check-in funcione para esa `EjecucionPrograma` (ver Risks)

### Bloque B — Funcionalidad completa "Clase en Vivo" (construye sobre la base depurada de Bloque A; no arranca hasta que Bloque A esté implementado y verificado)

Derivado 1:1 de `Módulo Clase en Vivo.txt`. Cada ítem referencia su sección de origen en el `.txt`.

#### In Scope
- **Activación temporal con constantes centralizadas** (§3): `LIVE_CLASS_OPEN_BEFORE_MINUTES=15`, `LIVE_CLASS_CLOSE_AFTER_MINUTES=15` en un único módulo, consumidas por `Horarios.tsx`, `App.tsx` y `ventanaClaseEnVivoService.ts` — sin valores repetidos hardcodeados; fuera de la ventana el acceso queda bloqueado/oculto salvo permiso administrativo explícito
- **Selector de clase múltiple** (§4): si hay más de una `JornadaInstruccion` activa en la ventana horaria, mostrar selector de clase filtrado por permisos del usuario (un maestro solo ve/selecciona las suyas; tenant/admin ve todas las del tenant) — reusa la misma función de permisos del roster de Bloque A
- **Check-in QR completo** (§6): validar pertenencia a tenant, estado activo, pertenencia a grado/grupo/programa de la clase (contra el roster de Bloque A), habilitación para esa clase, no-duplicidad de check-in, validez del QR; registrar `studentId`, `classId`(`jornadaId`), `programId`, `tenantId`, `checkInTime`, `checkedInBy`, `teacherId`, `venueId`, `status`, `isLate`, `minutesLate`; calcular retraso si llega después de `horaInicio`
- **Check-out QR completo** (§7): validar check-in previo, no-duplicidad de check-out, sesión activa, permiso del usuario; registrar `checkOutTime`, `checkedOutBy`, `durationMinutes`, `attendanceStatus`, `notificationStatus`; calcular tiempo real de permanencia y acumular horas reales de la sesión
- **Notificación a acudientes vía Meta WhatsApp Cloud API** (§8): al confirmarse el check-out, notificar server-side que el estudiante terminó clase y puede ser recogido (hora de salida, sede, nombre de la clase). **Decisión de producto (esta revisión, reemplaza la decisión anterior)**: ante el gap confirmado por auditoría (**ver hallazgo abajo**: no existía proveedor server-side), el usuario decidió explícitamente construir un servicio real de envío automatizado — `functions/notificaciones/whatsappCloudApi.js`, integrado con la Meta WhatsApp Cloud API oficial (server-side, gratis hasta 1000 conversaciones/mes) — en vez de mantener el mecanismo manual `wa.me` client-side o evolucionar la extensión de navegador no oficial (`extension_whatsapp/`, que sigue existiendo para otros usos pero no se adopta para este). El envío se dispara desde el callable server-side de check-out, no desde el cliente. Registrar estado de la notificación (enviada/fallida) y permitir reintento controlado si falla; no enviar si no hay acudiente registrado; no duplicar envíos. **Requiere configuración operativa manual previa** (cuenta WhatsApp Business + plantilla pre-aprobada en Meta Business Manager) para funcionar en producción real — no bloquea el desarrollo del código, sí bloquea el envío real hasta completarse (ver checklist operativo en `tasks.md`)
- **Checkpoint de materiales en 3 sub-fases** (§9), flujo guiado con checkboxes/selects/botones rápidos, nunca prompt libre:
  - Inicio (§9.1): mostrar materiales asignados a la clase desde Centro de Estudios; marcar "se planea usar hoy" / "se deja pendiente" / "no aplica"; rápido, no bloquea el check-in
  - Durante (§9.2): marcar avance por material (usado / mencionado / explicado / practicado / parcialmente cubierto / pendiente / no usado) + nota corta opcional con límite de caracteres
  - Cierre (§9.3): resumen rápido por material, confirmación (confirmar cierre / ajustar materiales / dejar pendiente para próxima clase), registrar qué se usó/mencionó/practicó/quedó pendiente, % aproximado de cobertura, quién y cuándo registró el cierre
- **Observaciones rápidas grupales** (§10): categorías predefinidas (grupo con buena/baja energía, requiere refuerzo, buen avance técnico, dificultad general, clase interrumpida, material insuficiente, excelente participación) + nota corta opcional; prioriza registro grupal, nota individual solo si el maestro lo decide explícitamente; no exigir nota individual por estudiante
- **Métricas y trazabilidad consultable** (§11): asistencias reales, ausencias, llegadas tarde, salidas, horas reales acumuladas **por sesión** (la agregación histórica multi-jornada queda fuera, ver Out of Scope), materiales cubiertos/pendientes, participación general, cumplimiento de clase, historial consultable por estudiante/grupo/maestro/programa/tenant — datos bien registrados y consultables, sin necesidad de construir dashboards en este change
- **Roles y permisos** (§12): tenant/admin opera clases de su tenant; maestro asignado opera solo sus clases; asistente autorizado si el rol ya existe en el sistema; estudiante no registra su propia asistencia; acudiente no modifica asistencia; usuario sin permisos no escanea QR ni cierra clase; toda acción relevante registra quién la hizo
- **Seguridad e integridad de datos** (§13): sin registros huérfanos (sin `studentId`/`classId`/`tenantId`), no check-out sin check-in, no duplicidad de asistencia en la misma clase, no cross-tenant, no eliminar materiales ni alterar estructura del programa desde Clase en Vivo, no modificar Agenda salvo estados operativos estrictamente necesarios, cierre de clase preserva información (no borra)
- **Estados de jornada explícitos** (§14): `scheduled | available | in_progress | closed | expired | cancelled`, **función pura derivada** (`calcularEstadoClaseEnVivo`, no persistida) sobre `EstadoJornada` real (`models/academico/index.ts:30-40`) + ventana horaria + existencia de check-ins, sin agregar una segunda máquina de estados persistida — mapeo completo ya definido en `design.md`, sección "Bloque B", Decisión 15
- **Flujo visual de 5 secciones** (§15): A) encabezado (clase, hora, sede, maestro, estado, tiempo restante de ventana); B) escáner QR (cámara, último resultado, estado del estudiante, mensaje claro de éxito/error); C) lista de asistencia (esperados, con check-in, pendientes, con check-out, tardíos); D) materiales de la clase (asignados, estado de uso, checkpoint inicial y de cierre); E) cierre de clase (resumen de asistencia, resumen de materiales, observación rápida, botón cerrar con confirmación)
- **16 casos especiales** (§16) como criterios de test explícitos: doble QR en check-in, check-out sin check-in, estudiante de otro grupo/tenant, cámara no disponible, QR inválido, clase fuera de horario, clase sin materiales/sin estudiantes esperados, usuario sin permiso, falla de WhatsApp, clase terminada sin cerrar, cambio de maestro asignado desde Agenda antes de la clase, clase desactivada antes de iniciar

#### Out of Scope (Bloque B, diferido a change futuro)
- **Dashboards/reportes agregados de KPI**: el `.txt` (§11) es explícito — "No es necesario construir todos los dashboards en esta tarea, pero sí dejar la información bien registrada y consultable." Este change deja los datos consultables (queries/servicios), no construye visualizaciones ni dashboards
- **Horas acumuladas históricas multi-jornada agregadas**: la acumulación de horas **por sesión** (registrar `durationMinutes` de cada check-in/check-out y sumarlas al acumulado del estudiante) sí entra en scope de Bloque B (§7, §11 lo piden explícitamente). Lo que se difiere es un reporte/dashboard histórico multi-jornada agregado (tendencias, comparativas entre periodos), no el campo de horas en sí
- Decisión sobre si `asistencia`/`GestionClase.tsx` (flujo comercial de guardería/entrega a tutores, Sistema C actual, modelo `Asistencia` de `tipos.ts:314-323`) se fusiona con la asistencia académica de Clase en Vivo o queda separado — se deja mencionado, no se resuelve acá
- Lector físico de QR dedicado (hardware) — el `.txt` (§6) menciona "lector compatible si existe" como opción, no como requisito bloqueante; Bloque B cubre cámara de celular/computador (ya funcional en `EscanerAsistencia.tsx`)

### Hallazgo de auditoría: servicio de WhatsApp existente (obligatorio por `.txt` §8 y §17 Fase 1)

Se grepeó el repo completo (`servicios/`, `functions/`, `hooks/`, `components/`) buscando "whatsapp" case-insensitive. **No existe un proveedor de envío automatizado server-side (sin Twilio, sin Meta Cloud API, sin credenciales de ningún proveedor de mensajería en el repo)**. Lo que sí existe son tres mecanismos client-side/browser-dependientes, ninguno invocable desde una Cloud Function:

1. `servicios/notificacionesApi.ts:14-33` (`enviarNotificacion`) — abre un deep-link `wa.me` en una pestaña nueva del navegador; requiere que el operador presione "Enviar" manualmente dentro de WhatsApp Web/App. Persiste en `historialNotificaciones` vía `guardarNotificacionEnHistorial` (`servicios/notificacionesApi.ts:43-51`). Ya está en producción, consumido hoy por `hooks/useGestionNotificaciones.ts:63-123` (`handleEnviarRecordatorios`) para recordatorios de pago.
2. `servicios/tudojangRelay.ts` + extensión de navegador `extension_whatsapp/` (`relayBridge.js`, `background.js`, `content.js`, `popup.js`) — relay semi-automatizado que envía mensajes en lote a través de una sesión activa de WhatsApp Web, con `batchSize`/delays para evitar detección anti-spam. Consumido hoy por `hooks/useGestionNotificaciones.ts:125-180` (`handleEnviarRecordatoriosRelay`). Requiere la extensión instalada y sesión de WhatsApp Web activa en el dispositivo del operador — no es un push de servidor.
3. `functions/asistente/whatsapp.js` (`crearEscalamientoWhatsapp`) — no es un canal de notificación a acudientes; solo construye un link `wa.me` para escalar tickets del asistente virtual a soporte, gateado por consentimiento explícito y ausencia de datos sensibles. No reutilizable para este caso de uso.

**Implicación de diseño para Bloque B (superada por decisión de producto de esta revisión — ver abajo)**: la conclusión original (revisión anterior de este documento) era que, como el check-out corre por callable server-side (Admin SDK, Bloque A Decisión 3 de `design.md`) y ninguno de los tres mecanismos anteriores es invocable desde una Cloud Function, la notificación debía dispararse client-side tras una respuesta exitosa del callable de check-out, reutilizando `enviarNotificacion`/`guardarNotificacionEnHistorial` (ítem 1) como ruta inmediata, con clic manual del operador.

**Decisión de producto (esta revisión, reemplaza la anterior)**: al ver ese gap, el usuario decidió explícitamente **no** conformarse con el mecanismo manual client-side ni con evolucionar la extensión de navegador no oficial (`extension_whatsapp/`, ítem 2 de la lista de arriba), sino construir un cuarto mecanismo — el primero realmente server-side — integrando la **Meta WhatsApp Cloud API oficial** (`functions/notificaciones/whatsappCloudApi.js`, gratis hasta 1000 conversaciones/mes). Con esto, la notificación **sí** se dispara dentro del callable de check-out (server-side), eliminando la dependencia de que el dispositivo/pestaña del operador esté disponible. Ver diseño técnico completo en `design.md`, Decisión 13 (reemplazada en esta revisión).

Además, `NotificacionHistorial` (`tipos.ts:285-296`) **no tiene** hoy un campo de `estado`/error/reintento (solo `leida: boolean`) ni un `TipoNotificacion` para "clase finalizada" — ambos se agregan de forma aditiva en Bloque B (Fase 10) para cumplir el requisito del `.txt` de "registrar estado de la notificación" y "si WhatsApp falla, guardar error y permitir reintento controlado".

**Nota operativa crítica**: la Meta WhatsApp Cloud API exige plantillas de mensaje pre-aprobadas por Meta para que un negocio inicie una conversación fuera de la ventana de 24hs de interacción activa del usuario — esto es un requisito de la plataforma, no del código. La plantilla `clase_finalizada_notificacion` (parámetros: nombre del estudiante, hora de salida, sede, nombre de la clase, ver `.txt` §8) debe crearse y aprobarse manualmente en Meta Business Manager antes de que el envío real funcione en producción; no es automatizable por código y no bloquea el desarrollo/tests (que mockean la llamada), solo el funcionamiento real (ver checklist operativo en `tasks.md`).

## Approach

**Bloque A**: construir primero un roster explícito de matrícula por `EjecucionPrograma` (nuevo, prerrequisito) y luego reescribir Clase en Vivo sobre `JornadaInstruccion` real, reusando el escáner de cámara ya probado de `EscanerAsistencia.tsx` en vez de reinventar QR. El check-in/check-out pasa por callable server-side (no escritura directa) y valida pertenencia contra el roster explícito, no por inferencia de atributos. Agenda calcula la ventana de tiempo (15/15, anclada a `horaInicio`/`horaFin`) y pasa `jornadaId` real al montar la vista. Se archiva el Sistema B completo en el mismo change para no dejar una cuarta fuente de verdad.

**Bloque B**: sobre la base depurada de Bloque A, completar el flujo funcional pedido por el `.txt`: campos completos de check-in/check-out, checkpoint de materiales en 3 sub-fases (función pura + UI guiada, sin prompt libre), observaciones grupales rápidas, selector de clase múltiple filtrado por permisos, notificación a acudientes reutilizando el mecanismo client-side existente (con estado/reintento agregado al modelo), estados explícitos de jornada, y el flujo visual de 5 secciones. Bloque B no reabre decisiones ya tomadas en Bloque A (roster, callable, subcolección de asistencia); las extiende.

## Affected Areas

| Area | Bloque | Impact | Description |
|------|--------|--------|--------------|
| `models/academico/inscripcion.ts` (nuevo) | A | Nuevo | Modelo de roster de matrícula `InscripcionEjecucionPrograma`, keyed por `ejecucionProgramaId` |
| `servicios/academico/inscripcionRepository.ts`, `inscripcionService.ts` (nuevos) | A | Nuevo | CRUD de matrícula + lógica pura de sugerencia por atributo (solo UI, no validación) |
| `vistas/admin/AsignacionesView.tsx`, `components/academico/MatricularEstudiantesModal.tsx` (nuevo) | A | Nuevo/Modificado | UI de matrícula explícita por `EjecucionPrograma` |
| `models/academico/jornada.ts`, `servicios/academico/jornadaService.ts` | A | Modificado | Sub-estado de asistencia por estudiante ligado a la jornada; estados explícitos ampliados en Bloque B |
| `functions/academico/` (nuevo módulo asistencia) | A/B | Nuevo | Callable(s) check-in/check-out con validación de pertenencia (A); campos completos del `.txt` y cálculo de retraso/horas (B) |
| `components/EscanerAsistencia.tsx` | A/B | Modificado | Rewire a contexto real de jornada/grado/programa (A); selector de clase múltiple y mensajes de éxito/error del flujo visual (B) |
| `vistas/ClaseEnVivoView.tsx`, `servicios/claseEnVivoApi.ts`, `servicios/asistenciaQrApi.ts` | A | Archivado | Reemplazados por el flujo unificado |
| `tipos.ts:542-639` | A | Archivado | Tipos paralelos (`JornadaAcademica`, `ClaseEnVivo`, etc.) |
| `vistas/Horarios.tsx`, `App.tsx:68,73-89,334` | A/B | Modificado | Ventana de tiempo real 15/15 (A); selector de clase múltiple, flujo visual de 5 secciones (B) |
| `firestore.rules:176-191` y ausencia de regla `asistencia` | A | Modificado | Reglas nuevas para roster de matrícula y para asistencia, con validación de pertenencia; retiro de reglas huérfanas |
| `constantes.ts` (o módulo nuevo dedicado) | A/B | Nuevo/Modificado | `LIVE_CLASS_OPEN_BEFORE_MINUTES`, `LIVE_CLASS_CLOSE_AFTER_MINUTES` centralizadas |
| `components/academico/CheckpointMaterialesClase.tsx` (nuevo) | B | Nuevo | UI guiada de las 3 sub-fases del checkpoint de materiales |
| `components/academico/ObservacionesRapidasClase.tsx` (nuevo) | B | Nuevo | Categorías predefinidas + nota corta opcional |
| `functions/notificaciones/whatsappCloudApi.js` (nuevo módulo `functions/notificaciones/`) | B | Nuevo | Servicio server-side `enviarWhatsAppCloudApi({telefono,plantilla,parametros})` vía Meta WhatsApp Cloud API, secrets `WHATSAPP_CLOUD_API_TOKEN`/`WHATSAPP_CLOUD_API_PHONE_NUMBER_ID` |
| `functions/academico/asistencia.js` (rama check-out, de Bloque A/B) | B | Modificado | Invoca `enviarWhatsAppCloudApi` server-side tras `checkOutTime` exitoso |
| `tipos.ts:285-306` (`NotificacionHistorial`, `TipoNotificacion`) | B | Modificado | Nuevo tipo de notificación "clase finalizada" + campo de estado/error/reintento (aditivo) |
| `servicios/academico/asistenciaService.ts` (de Bloque A) | B | Modificado | Cálculo de `isLate`/`minutesLate`, `durationMinutes`, acumulado de horas por sesión, métricas consultables |

## Impacto en Tests

- **Cobertura actual**: `ClaseEnVivoIntegracion.test.tsx` mockea completamente `claseEnVivoApi`/`asistenciaQrApi`, nunca detectó el bug de firma real. `functions/test/firestore-rules.security.test.js` no cubre `clases_en_vivo`/`asistencias_jornada`; existe una suite aislada `firestore-rules.etapa8.test.js` no integrada al CI regular. Cero tests de ventana de tiempo (no existe la feature). Cero tests de matrícula (no existe el roster). Cero tests de checkpoint de materiales, observaciones rápidas, selector de clase múltiple o notificación a acudientes (ninguna de estas piezas existe hoy de forma real).
- **Cobertura esperada Bloque A**: tests TDD para el roster (repo, service puro, UI de matrícula, reglas Firestore), tests TDD para el/los callable(s) de check-in/check-out (incl. rechazo por no-pertenencia contra el roster, y caso específico de dos secciones del mismo grado con rosters distintos), reglas Firestore contra emulador real para ambas colecciones nuevas, tests de la ventana de tiempo 15/15 anclada a `horaInicio`/`horaFin` en `Horarios.tsx`/`App.tsx`, y tests de `EscanerAsistencia.tsx` rewireado.
- **Cobertura esperada Bloque B**: tests puros del checkpoint de materiales (transiciones de estado de las 3 sub-fases, cálculo de % de cobertura), tests del selector de clase múltiple filtrado por permisos, tests de los 16 casos especiales del `.txt` §16 como casos de test explícitos, tests de la notificación a acudientes (incluye caso "WhatsApp falla → estado de error + reintento controlado", sin mockear un proveedor que no existe — se testea la construcción del mensaje/link y la persistencia del estado), tests de cálculo de `isLate`/`minutesLate`/`durationMinutes`/horas acumuladas por sesión, tests de estados explícitos de jornada (`scheduled|available|in_progress|closed|expired|cancelled`) y sus transiciones válidas/inválidas.

## Risks

| Risk | Bloque | Likelihood | Mitigation |
|------|--------|------------|--------------|
| Alcance grande (roster + dominio académico + Agenda + rules + functions a la vez) | A | High | Partir en fases dentro del mismo change, con el roster como Fase 0 bloqueante: matrícula primero, luego backend/rules de asistencia, luego UI/Agenda, vía `sdd-tasks` |
| `EjecucionPrograma`s ya activas hoy no tienen roster matriculado → check-in rechaza a todos los estudiantes hasta completar matrícula manual | A | High | Comunicar como paso operativo previo al rollout de Fase 1 (backend de asistencia); no lanzar el callable de check-in en producción hasta que las ejecuciones vigentes tengan roster cargado |
| Migrar de Sistema B a A rompe algo que hoy "parece" funcionar en demo | A | Medium | Sistema B nunca persistió realmente; no hay estado real que migrar, solo UI a reemplazar |
| Regla Firestore nueva mal validada permite escritura sin pertenencia (roster o asistencia) | A | Medium | Preferir callable server-side sobre escritura directa para asistencia; testear ambas colecciones contra emulador |
| Carga operativa de mantener el roster al día (altas/bajas de estudiantes durante el ciclo) recae en admin/instructor manual | A | Medium | Fuera de alcance técnico de este change; UI de matrícula sugiere por atributo para reducir fricción, pero el proceso de negocio de mantenerlo actualizado no se resuelve acá |
| Ambigüedad con Sistema C (`asistencia` comercial) genera confusión de alcance durante implementación | A | Medium | Explicitado como Out of Scope; documentar el límite en `sdd-design` |
| **Envío real de WhatsApp depende de configuración manual en Meta** (cuenta Business, Access Token, Phone Number ID, plantilla `clase_finalizada_notificacion` pre-aprobada): el código y los tests funcionan sin esa configuración (mocks), pero el envío real en producción queda bloqueado hasta completarla — es un requisito de la plataforma Meta, no automatizable por código | B | High | Checklist operativo explícito en `tasks.md` (Fase 10); `enviarWhatsAppCloudApi` retorna `{exito:false, error}` de forma controlada (no excepción no manejada) si faltan credenciales o la plantilla no está aprobada, para no bloquear el check-out ni el resto del flujo |
| Secrets de Meta (`WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_CLOUD_API_PHONE_NUMBER_ID`) mal configurados o rotados exponen o interrumpen el envío | B | Medium | `defineSecret` de Firebase Functions v2 (no hardcodear en código ni en `.env` versionado); test explícito de credenciales faltantes que falla de forma controlada |
| Checkpoint de materiales de 3 sub-fases puede volverse un formulario pesado y bloquear el check-in, contradiciendo el requisito explícito del `.txt` ("rápido, no obligatorio de forma pesada, no debe bloquear el check-in") | B | Medium | TDD de las funciones puras de transición de estado primero; UI de checklist rápido (mismo patrón de fricción baja que la UI de matrícula de Bloque A); checkpoint inicial nunca bloquea el botón de check-in |
| Selector de clase múltiple filtrado por permisos falla y expone jornadas fuera del alcance del usuario (cross-tenant o cross-maestro) | B | Medium | Reusar exactamente la misma función de permisos ya construida y testeada para el roster en Bloque A, no reimplementar el filtro |
| Extender `NotificacionHistorial`/`TipoNotificacion` (campo de estado/error, nuevo tipo "clase finalizada") es un cambio a un modelo compartido con Finanzas (recordatorios de pago) | B | Low | Cambios estrictamente aditivos (campo opcional, nuevo valor de enum); no tocar la semántica ni los campos que ya consume `useGestionNotificaciones.ts` |
| Alcance total (Bloque A + Bloque B) es considerablemente mayor que el proposal original | A+B | High | Gate secuencial explícito: Bloque B no arranca hasta `sdd-verify` de Bloque A; `sdd-tasks` particiona cada bloque en sub-fases ejecutables independientemente |

## Rollback Plan

Los sistemas archivados (Sistema B) se mueven a una carpeta de archivo (no se borran) para poder restaurarlos si algo bloquea. Los cambios en `JornadaInstruccion`/`jornadaService` son aditivos (nuevo sub-estado), revertibles quitando el campo nuevo. El roster de matrícula es una subcolección nueva y aditiva (`ejecucionesPrograma/{id}/inscripciones`); revertirla no afecta ningún flujo existente porque nada la consume hasta la Fase 1. Las reglas Firestore nuevas son aditivas para las colecciones nuevas; retirar las reglas huérfanas de `clases_en_vivo`/`asistencias_jornada` es reversible restaurándolas desde git si se detecta un uso oculto no identificado en la exploración. Las piezas de Bloque B (checkpoint de materiales, observaciones rápidas, campos nuevos de notificación) son todas aditivas sobre el modelo de Bloque A; revertir Bloque B completo no requiere tocar el roster ni el callable base de check-in/check-out de Bloque A.

## Dependencies

`JornadaInstruccion`/`jornadaService.ts`/`closeJornada.ts` (ya existen y probados), `EjecucionPrograma`/`programaService.ts` (ya existe, es donde se ancla el roster nuevo), `EscanerAsistencia.tsx` (cámara QR ya funcional), `MisClasesView.tsx` (patrón `marcarPendienteCierre()` reutilizable de change previo `programa-persistencia-gestion-clases`), `AsignacionesView.tsx` (única vista que hoy crea/lista `EjecucionPrograma`, punto de anclaje de la UI de matrícula nueva). Para Bloque B, adicionalmente: `functions/notificaciones/whatsappCloudApi.js` (nuevo, servicio server-side de envío vía Meta WhatsApp Cloud API — `axios` ya es dependencia de `functions/`, `functions/package.json:19`, `^1.13.5`), `tipos.ts:285-306` (`NotificacionHistorial`/`TipoNotificacion`, a extender de forma aditiva), y la **configuración operativa externa en Meta for Developers/Meta Business Manager** (cuenta WhatsApp Business, Access Token, Phone Number ID, plantilla `clase_finalizada_notificacion` pre-aprobada) — dependencia no técnica pero bloqueante para el funcionamiento real.

## Success Criteria

### Bloque A
- [ ] Un admin/instructor puede matricular explícitamente estudiantes a una `EjecucionPrograma` concreta, con sugerencia por grado/grupo pero confirmación manual
- [ ] Dos `EjecucionPrograma` del mismo grado en simultáneo tienen rosters independientes: un estudiante matriculado en una NO es aceptado en el check-in de la otra
- [ ] Un rol permitido escanea el QR del carnet de un estudiante y queda registrado el check-in ligado a la `JornadaInstruccion` real (fecha, hora, grado, programa)
- [ ] Un estudiante fuera del roster explícito de esa `EjecucionPrograma` es rechazado por la validación de pertenencia (no por inferencia de grado/grupo)
- [ ] El ítem "Clase en Vivo" del menú principal solo está activo entre 15min antes de `horaInicio` y 15min después de `horaFin` de la jornada (placeholder de `App.tsx:78` eliminado; `LIVE_CLASS_OPEN_BEFORE_MINUTES`/`LIVE_CLASS_CLOSE_AFTER_MINUTES` centralizadas)
- [ ] Agenda dispara la vista de Clase en Vivo con `jornadaId` real, no demo hardcodeado
- [ ] El roster de matrícula y la colección de asistencia por estudiante tienen regla Firestore testeada contra emulador (ninguna cae en el catch-all deny)
- [ ] Sistema B (`ClaseEnVivoView.tsx`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, tipos en `tipos.ts:542-639`) archivado, no solo abandonado en el árbol activo
- [ ] 0 regresiones en tests existentes

### Bloque B (fusiona los 16 criterios de aceptación de `Módulo Clase en Vivo.txt` §18 con el dominio ya unificado en Bloque A)
- [ ] Clase en Vivo se habilita solo para clases reales programadas en `JornadaInstruccion` (no clases demo/hardcodeadas)
- [ ] El acceso temporal funciona con ventana configurable (15/15 vía constantes centralizadas, no hardcodeada en múltiples lugares)
- [ ] El QR permite check-in y check-out con todos los campos especificados en `.txt` §6-§7
- [ ] La asistencia queda registrada por estudiante y clase, sin duplicados y sin datos huérfanos
- [ ] Se calcula tiempo real de permanencia (`durationMinutes`) en cada check-out
- [ ] Se alimenta el acumulado de horas reales por sesión
- [ ] Se puede marcar el uso de materiales asignados (checkpoint de materiales operativo end-to-end)
- [ ] El checkpoint de materiales es rápido, guiado (checkboxes/selects/botones), no bloquea el check-in y no requiere prompt libre
- [ ] Se puede cerrar la clase con resumen de asistencia y materiales, con confirmación explícita
- [ ] Se registran observaciones rápidas grupales, con nota individual opcional solo si el maestro lo decide
- [ ] Se respetan permisos por tenant/admin/maestro/asistente (si el rol existe); estudiante y acudiente no pueden operar asistencia
- [ ] Si hay más de una clase activa en la ventana horaria, el selector de clase se filtra correctamente por permisos del usuario
- [ ] La notificación a acudientes se envía server-side vía Meta WhatsApp Cloud API (`functions/notificaciones/whatsappCloudApi.js`) disparada desde el callable de check-out, registra estado y permite reintento controlado si falla; el funcionamiento real en producción requiere la configuración operativa manual en Meta (checklist en `tasks.md`)
- [ ] No se altera la lógica base de Agenda ni de Centro de Estudios desde Clase en Vivo (salvo estados operativos estrictamente necesarios, ya cubiertos en Bloque A)
- [ ] La información (asistencia, materiales, horas, observaciones) queda registrada y consultable para reportes/KPIs futuros, sin necesidad de construir dashboards en este change
- [ ] Los 16 casos especiales de `.txt` §16 están cubiertos por tests explícitos (doble QR, check-out sin check-in, cross-tenant, cámara no disponible, QR inválido, fuera de horario, sin materiales/estudiantes, sin permiso, falla de WhatsApp, clase sin cerrar, cambio de maestro, clase desactivada)
