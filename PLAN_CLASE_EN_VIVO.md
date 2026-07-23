# PLAN TÉCNICO — Módulo Clase en Vivo (Fase 2)

> Basado en `Módulo Clase en Vivo.txt` (spec, 18 secciones) y en la auditoría del código real
> (Fase 1) del 2026-07-22. Estado de partida: **~40-45%** implementado — el backbone de
> asistencia/seguridad/permisos/ventana está sólido y testeado; falta toda la capa de
> trazabilidad pedagógica (materiales, observaciones, notificación a padres, horas, puntualidad).

## Resumen del gap (de la auditoría)

| Capacidad (spec) | Estado | Nota |
|---|---|---|
| §3 Ventana temporal 15/15 | ✅ | Enforcada server-side (callable). Constantes NO centralizadas (duplicadas TS+JS). |
| §6 Check-in QR (core) | ✅ parcial | Falta `isLate`/`minutesLate`, `checkedInBy`, validez del QR. |
| §7 Check-out QR (core) | ✅ parcial | Falta `checkedOutBy`, `attendanceStatus`, `notificationStatus`. |
| §12 Roles y permisos | ✅ | Completo en el callable. |
| §13 Integridad de datos | ✅ | Sin huérfanos, sin dup, aislamiento por tenant. |
| §4 Selector multi-clase | 🟡 | Elige la más cercana; sin UI de selección. |
| §14 Estados | 🟡 | Estados académicos + indicador de 4 valores; sin `expired`. |
| §15 Flujo visual | 🟡 | Header parcial, lista básica; sin materiales ni cierre-con-resumen en la vista. |
| §11 Métricas | 🟡 | Asistencia sí; horas y cobertura de materiales no. |
| §8 Notificación a padres | ❌ | No hay disparador al check-out. |
| §9 Checkpoint de materiales | ❌ | Nada. Sección entera de la spec. |
| §10 Observaciones rápidas | ❌ | Nada. |
| §7/§11 Acumular horas reales | ❌ | `minutosAsistidos` por registro; nunca se suma. |

## Infraestructura reutilizable (no reinventar)

- **Notificaciones / buzón**: `servicios/notificacionesApi.ts` (`enviarNotificacion` — WhatsApp
  simulado, `guardarNotificacionEnHistorial`, `obtenerNotificacionesPorEstudiantes` = buzón).
  Del lado functions: `recordatoriosEstudio.js`, `notificarEvento.js`, `recordatoriosPago.js`
  ya escriben al buzón de estudiantes/tutores. → §8 reusa esto, NO implementa proveedor nuevo.
- **Ventana**: `servicios/academico/ventanaClaseEnVivoService.ts` + `functions/academico/ventanaClaseEnVivo.js`.
- **Identidad del acudiente**: `estudiante.tutor.correo` + `tutorStudentResolver.ts`.
- **Materiales de una jornada**: `asignaciones` con `jornadaId` (patrón ya usado en `AgendaView.tsx`).
- **Cierre**: `servicios/academico/closeJornada.ts` (`cerrarJornadaConPrograma`) + `jornadaService.cerrarJornada`.

---

## Workstreams (ordenados: menor riesgo / mayor valor primero)

### WS-1 — Campos de auditoría + puntualidad  🟢 riesgo bajo
Cierra §6/§7 (campos faltantes) y habilita §11 (llegadas tarde).

- **Qué**: guardar `checkedInBy`/`checkedOutBy` (= `auth.uid`) y calcular `isLate`/`minutesLate`
  en el check-in (comparar `horaEntrada` contra `horaInicio` de la jornada, en zona del club).
- **Modelos**: `models/academico/asistencia.ts` → `RegistroAsistencia` (+ `checkedInBy`,
  `checkedOutBy?`, `isLate`, `minutesLate`).
- **Servicios**: `functions/academico/asistencia.js` (ya tiene `auth` y la jornada; reusar
  `combinarFechaHoraEnZonaDelClub` de `ventanaClaseEnVivo.js` para el cálculo).
- **Riesgos**: bajo. Ojo: el fake de test de `checkInQr.integracion` y `asistencia.test.js` ya
  inyectan `ahora` — los nuevos asserts encajan ahí.
- **Validación**: unit (callable) — entrada puntual (`isLate=false`), tarde (`minutesLate>0`),
  `checkedInBy` persistido. + integración `checkInQr` (contrato con el repo lee los campos).

### WS-2 — Acumulación de horas reales  🟡 riesgo medio — REQUIERE DECISIÓN
§7/§11: sumar `minutosAsistidos` a un acumulado por estudiante.

- **Decisión pendiente (producto)**: ¿dónde se acumula? `Estudiante.horasAcumuladasGrado` YA
  existe y lo consume la generación de certificados (`utils/certificateGenerator.ts`). Sumar
  ahí mezcla "horas de clase en vivo" con lo que sea que ese campo signifique hoy (hoy es
  manual/seed). Alternativa: un doc nuevo `metricasAsistencia` por estudiante. **Hay que
  decidir antes de codear** para no romper certificados.
- **Servicios**: el check-out (callable) incrementa el acumulado elegido (`increment`).
- **Riesgos**: medio — toca (o convive con) la lógica de certificados. Idempotencia: no
  re-sumar si el check-out se reintenta (ya está protegido: 3er escaneo se rechaza).
- **Validación**: unit — dos check-outs acumulan; un 3er escaneo no re-suma.

### WS-3 — Notificación a padres al check-out (§8)  🟡 riesgo medio — ALTO VALOR PERCIBIDO
Lo que el PADRE ve. Reusa el buzón existente.

- **Qué**: al confirmar check-out, escribir una notificación al buzón del acudiente
  ("{alumno} terminó la clase y puede ser recogido — {hora}, {sede}, {clase}") y registrar
  `notificationStatus` en el `RegistroAsistencia`.
- **Modelos**: `RegistroAsistencia` (+ `notificationStatus: 'enviada'|'sin_acudiente'|'error'`).
- **Servicios**: patrón de `notificarEvento.js` / `recordatoriosEstudio.js` (escribir al buzón);
  resolver acudiente por `estudiante.tutor.correo`. WhatsApp: reusar `enviarNotificacion`
  (simulado) — NO proveedor nuevo (§8).
- **Reglas (spec §8)**: sin acudiente → no enviar (`sin_acudiente`); sin duplicados (idempotente
  por jornada+estudiante); si falla → `error` + permitir reintento.
- **Riesgos**: medio — dedup y lookup del acudiente. Decisión: ¿disparo dentro del callable de
  check-out, o un trigger Firestore `onUpdate` de la asistencia? Recomendado: **dentro del
  callable** (transaccional, ya tiene el contexto), con try/catch que no rompa el check-out.
- **Validación**: unit — check-out con acudiente → notificación en el buzón; sin acudiente →
  `sin_acudiente`; segundo intento no duplica.

### WS-4 — Checkpoint de materiales (§9)  🔴 riesgo alto — FEATURE GRANDE
El corazón pedagógico. §9.1 (inicio), §9.2 (durante), §9.3 (cierre), §15.D.

- **Qué**: por cada material asignado a la jornada, registrar estado
  (`planeado`/`usado`/`practicado`/`mencionado`/`parcial`/`pendiente`/`no_usado`) + nota corta
  (límite de caracteres) + `coberturaClase` (% aprox) al cierre.
- **Modelos**: nuevo `models/academico/checkpointMaterial.ts` (`CheckpointMaterialJornada`).
- **Persistencia**: `tenants/{t}/jornadas/{j}/checkpointMateriales/{asignacionId}` (subcolección,
  mismo patrón que `asistencias`). Escritura server-side o reglas acotadas al maestro asignado.
- **Fuente de materiales**: `asignaciones` con `jornadaId` (ya se listan en `AgendaView`).
- **Servicios**: nuevo `checkpointMaterialService.ts` (guardar/leer estados) + repo.
- **UI**: sección nueva en `ClaseEnVivoView.tsx` (§15.D) — chips/checkboxes rápidos; resumen en
  el cierre (§9.3). Reusar `PestanaMaterialesJornada.tsx` como referencia visual, NO como fuente.
- **Riesgos**: alto — modelo + servicio + reglas + UI nuevos. Flujo guiado (no prompt libre, §9).
  No debe bloquear el check-in (§9.1).
- **Validación**: integración (sembrar asignaciones → marcar estados → leer resumen) + component
  (la sección no bloquea el escáner).

### WS-5 — Observaciones rápidas (§10)  🟢 riesgo bajo-medio
Pequeña, se acopla al cierre de WS-4.

- **Qué**: observación GRUPAL rápida (categorías: buena/baja energía, requiere refuerzo, buen
  avance, dificultad, interrumpida, material insuficiente, excelente participación) + nota corta
  opcional. Individual solo si el maestro lo pide (§10).
- **Modelos**: campo `observacionClase?` en la jornada (o subcolección si se quiere histórico).
- **UI**: chips en el cierre de `ClaseEnVivoView` (§15.E).
- **Riesgos**: bajo. Regla clave: no exigir nota por alumno (§10).
- **Validación**: unit/component — guardar categorías, no obligatorio.

### WS-6 — UI completa + estados + selector  🟡 riesgo medio — POLISH INCREMENTAL
§15 (secciones completas), §14 (estados), §4 (selector multi-clase).

- **Qué**:
  - Header completo (§15.A): sede, maestro, estado, tiempo restante de ventana.
  - Lista de asistencia rica (§15.C): esperados / con check-in / pendientes / con check-out /
    tarde. Requiere calcular el "roster esperado" (matrícula automática — ya existe la lógica
    en el callable `perteneceAEjecucion`, extraer a algo consultable).
  - Estado `expired` (§14): una jornada `en_curso` pasada la ventana → indicador `expired`
    (visual; el callable ya rechaza el check-in fuera de ventana).
  - Selector multi-clase (§4): si hay 2+ jornadas en ventana para el usuario, elegir cuál.
- **Riesgos**: medio — el roster esperado es la parte con más lógica.
- **Validación**: component + integración.

---

## Orden recomendado de implementación
1. **WS-1** (auditoría + puntualidad) — cierra huecos de §6/§7 sobre lo que ya funciona.
2. **WS-3** (notificación a padres) — lo que el padre percibe; reusa infra.
3. **WS-2** (horas) — tras decidir dónde acumular.
4. **WS-4** (checkpoint materiales) — el bloque pedagógico grande.
5. **WS-5** (observaciones) — se acopla al cierre de WS-4.
6. **WS-6** (UI/estados/selector) — polish, incremental.

## Método (igual que Centro de Estudios)
Cada WS: RED → GREEN → mutación de control → **regresión COMPLETA** (app + functions, no solo
la suite tocada — un cambio en el callable rompe tests del lado app) → commit por WS → PR.

## Restricciones de la spec que NO se pueden violar (§1, §13)
- No crear clases nuevas ni lógica paralela: Clase en Vivo CONSUME de Agenda/Centro de Estudios.
- No crear/editar estudiantes ni materiales base desde acá.
- No modificar Agenda salvo estados operativos estrictos.
- Todo cambio server-side (el callable es el boundary; la vista es cosmética).
