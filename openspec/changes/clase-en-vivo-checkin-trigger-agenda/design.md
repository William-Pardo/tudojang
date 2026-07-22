# Design: Unificar Clase en Vivo sobre JornadaInstruccion, disparada por Agenda

**Nota de alcance (revisión de reconciliación — ver `proposal.md`)**: este documento cubre el diseño técnico **completo** de **Bloque A** (depuración y unificación, cuerpo principal de este documento) y de **Bloque B** (funcionalidad completa "Clase en Vivo" derivada de `Módulo Clase en Vivo.txt`, ver sección `## Bloque B — Diseño técnico completo` al final). Ambos bloques quedan **diseñados** en esta revisión; lo único que sigue siendo secuencial es la **implementación**: Bloque B no se construye hasta que Bloque A esté implementado y pase `sdd-verify` (ver Migration/Rollout de cada bloque) — diseñar no requiere ese gate, solo construir sí. (Una revisión anterior de este documento, producto de una condición de carrera entre dos sub-agentes, dejaba Bloque B como "diseño pendiente para después"; esa nota era una decisión de proceso no solicitada por el usuario y queda corregida en esta revisión.)

**Corrección de la ventana temporal (esta revisión)**: la ventana pasa de `[horaInicio-5min, horaInicio+10min]` (versión previa de este documento) a **`[horaInicio-15min, horaFin+15min]`**, vía constantes centralizadas `LIVE_CLASS_OPEN_BEFORE_MINUTES=15` / `LIVE_CLASS_CLOSE_AFTER_MINUTES=15`. No es solo un cambio numérico: el cierre de ventana deja de anclarse a `horaInicio` (lo que ignoraba la duración real de la clase) y pasa a anclarse a `horaFin` (fin real de la jornada, campo ya existente en `models/academico/jornada.ts:15,35`). Ver `proposal.md` para la justificación completa (el `.txt` es la fuente más reciente y explícita, y así lo decidió el usuario).

**Reemplazo de la Decisión 13 — notificación a acudientes (esta revisión)**: la revisión anterior de este documento diseñaba la notificación como disparo client-side reutilizando `notificacionesApi.ts` (patrón `wa.me`, requiere clic manual del operador), por ausencia confirmada de un proveedor server-side en el repo. El usuario, al ver ese gap, decidió explícitamente construir un servicio real y automatizado — **Meta WhatsApp Cloud API** — en vez de mantener el mecanismo manual o evolucionar la extensión de navegador no oficial (`extension_whatsapp/`). La Decisión 13 y sus secciones dependientes (Data Flow, File Changes Fase 10, Testing Strategy, matriz de casos especiales #11) quedan reemplazadas más abajo por el diseño server-side real. Esto es un cambio real de arquitectura: la notificación pasa de disparo client-side (acción explícita post-respuesta del callable) a disparo server-side (dentro del mismo callable de check-out), eliminando la dependencia de que el dispositivo/pestaña del operador esté disponible en el momento del check-out.

## Technical Approach

Reemplazar Sistema B por un flujo delgado sobre `JornadaInstruccion` (Sistema A): un roster explícito de matrícula por `EjecucionPrograma`, una subcolección de asistencia por estudiante, un callable con toggle server-side, y un hook de ventana horaria que dispara la navegación desde Agenda. `EscanerAsistencia.tsx` conserva su cámara/`BarcodeDetector`; solo cambia qué endpoint llama. `jornadaService.cerrarJornada()` no se toca: seguimos alimentando `asistenciaRegistrada`/`objetivosImpartidos` con la misma forma de input que ya consume `JornadasView.tsx`, cambiando solo el origen del booleano (de checkbox manual a conteo real).

**Cambio de decisión de producto (post-exploración inicial)**: la validación de pertenencia estudiante↔jornada NO se resuelve por inferencia de atributos (`grado`/`grupo` del estudiante contra `grupoObjetivo` de la jornada, patrón `aplicaAlEstudiante` de `servicios/academico/asignacionService.ts:149-163`). Investigación de código confirmó que **no existe ningún roster explícito** en el modelo académico real (`models/academico/*`): `EjecucionPrograma.grupoId` (`models/academico/programa.ts:42`) es un slug derivado de un string libre (`slugificar(programa.grupoObjetivo)`, `vistas/admin/AsignacionesView.tsx:304,998`), no un identificador de sección. Esto significa que **dos `EjecucionPrograma` distintas para el mismo grado** (dos secciones de "Cadetes" en simultáneo, cada una con su propio `id`) comparten el mismo `grupoId` slugificado — la inferencia por atributo no las distingue, exactamente el problema de trazabilidad que motivó este cambio de decisión. El usuario decidió explícitamente construir un roster real de inscripción por `EjecucionPrograma`, ver Decisión 4 (reemplaza la anterior) y la nueva Fase 0.

## Architecture Decisions

| # | Decisión | Alternativa descartada | Rationale |
|---|----------|------------------------|-----------|
| 1 | Subcolección `tenants/{t}/jornadas/{j}/asistencias/{estudianteId}` | Array embebido en `JornadaInstruccion` | Ya existe precedente (`.../jornadas/{j}/auditoria/{id}`, `firestore.rules:259`); evita límite 1MB en grupos grandes; permite regla por-documento sin transacción read-modify-write de un array completo |
| 2 | Un callable `registrarAsistenciaJornada` que decide entrada/salida server-side según exista el doc | Dos callables separados check-in/check-out | El cliente (escáner) no necesita saber el modo; menos estado en `EscanerAsistencia.tsx`; precedente de módulo con una sola responsabilidad por archivo en `functions/academico/asignaciones.js` |
| 3 | Regla nueva de `asistencias`: `allow read: authenticated+tenant; allow write: if false` (solo Admin SDK) | `allow write: if isInstructor()` (como hoy `jornadas/{id}`) | La jornada actual permite update directo pese al comentario "se hace vía Cloud Function" (gap real, línea 252-254) — para asistencia sí lo exigimos de verdad, dado que pertenencia requiere cruzar contra el roster de inscripciones (Decisión 4) y no vale la pena duplicar esa lógica en rules para una escritura de alta frecuencia (escaneo) |
| 4 (reemplaza la anterior) | **Roster explícito**: subcolección `tenants/{t}/ejecucionesPrograma/{ejecucionId}/inscripciones/{estudianteId}`. Pertenencia = `exists(...inscripciones/{estudianteId})` sobre el `ejecucionProgramaId` de la jornada, chequeado server-side (Admin SDK) dentro del callable de asistencia | (a) Inferencia por atributo `grado`/`grupo` (diseño original, decisión de producto la descarta explícitamente); (b) colección propia `tenants/{t}/inscripcionesAcademicas/{id}` con campos `estudianteId`+`ejecucionProgramaId`; (c) key por `programaId` en vez de `ejecucionProgramaId` | Se descarta (a) por el problema de trazabilidad ya explicado (no distingue secciones simultáneas del mismo grado). Se descarta (b): con doc-id compuesto habría que generarlo determinísticamente de todos modos (`${ejecucionProgramaId}_${estudianteId}`) para evitar duplicados — la subcolección logra lo mismo con `estudianteId` como doc-id nativo, sin índice extra, y permite `get()`/`exists()` directo de un solo documento en el callable (mismo patrón que la subcolección `asistencias` de la Decisión 1). Se descarta (c) `programaId`: `ProgramaAcademico` es la curricula reusable (`assignProgramaToGrupo` en `servicios/academico/programaService.ts:89-116` permite asignar el mismo programa a múltiples grupos/secciones), mientras que `EjecucionPrograma.id` es la sección/oferta concreta a la que efectivamente asisten jornadas (`JornadaInstruccion.ejecucionProgramaId`) — matricular al nivel de `ejecucionProgramaId` es la única granularidad que resuelve el caso de dos secciones simultáneas |
| 5 | UI de matrícula: nuevo modal en `AsignacionesView.tsx` (única vista que hoy crea/lista `EjecucionPrograma`, ver `vistas/admin/AsignacionesView.tsx:994-1020`), con sugerencia por atributo grado/grupo pero selección final explícita y manual | Extender `FormularioEstudiante.tsx` reusando `programasInscritos`/`InscripcionPrograma.idPrograma` | **Confirmado por lectura de código, no solo sospecha**: `InscripcionPrograma.idPrograma` (`tipos.ts:196-199`) se escribe en `FormularioEstudiante.tsx:142-146` contra la lista de `useProgramas()` (`context/DataContext.tsx:31,318`), tipada `Programa[]` de `tipos.ts:94` — el modelo **legacy**, con espacio de IDs propio (usado por `Horarios.tsx`, `cohortesApi.ts`, `agendaManualApi.ts`, `jornadasApi.ts`). Es un tercer modelo sin relación con `ProgramaAcademico`/`EjecucionPrograma` de `models/academico/programa.ts`. Reusar ese campo mezclaría dos modelos y perpetuaría exactamente la ambigüedad de IDs que la Open Question original de este documento marcaba como bloqueante. Ese campo **no se toca** en este change |
| 6 | Escritura del roster: directa desde cliente, gateada por regla `allow create, delete: if isInstructor() && currentTenantId()==tenantId` (sin callable dedicado) | Callable `matricularEstudiante` server-side | La escritura de matrícula es de baja frecuencia (acción administrativa, no el escaneo de alta frecuencia de la Decisión 3) y solo requiere tenant+rol, sin cruce a otra colección — mismo nivel de rigor que la regla ya existente de `ejecucionesPrograma` (`firestore.rules:238-244`, `allow write: if isInstructor()`). Un callable dedicado sería sobre-ingeniería para esta escritura; se puede promover a callable en un change futuro si aparece lógica de negocio adicional (ej. límites de cupo) |
| 7 | Ventana horaria: función pura `calcularVentanaClaseEnVivo(jornadas, ahoraIso)` en servicio nuevo + hook que reconsulta cada 60s | Cálculo inline en `BarraLateral` (App.tsx) | Reutiliza el intervalo de 60s ya existente (`App.tsx:77`); función pura testeable sin React ni fake timers complejos |

## Data Flow

    [FASE 0 — prerrequisito]
    AsignacionesView (modal matrícula, admin/instructor)
        │ sugiere por grado/grupo, selección manual final
        ▼
    tenants/{t}/ejecucionesPrograma/{e}/inscripciones/{estudianteId}  (roster explícito)

    [FASE 1+ — check-in, requiere Fase 0 completa]
    Agenda (Horarios.tsx / BarraLateral)
        │ jornadas de hoy del instructor (query indexada fecha+instructorId)
        ▼
    calcularVentanaClaseEnVivo(jornadas, ahora)  ── pura, recalculada c/60s
        │ jornadaEnVentana | null
        ▼
    BarraLateral: link "Clase en Vivo" activo → navigate(`/clase-en-vivo/${jornadaId}`)
        ▼
    ClaseEnVivoView (nueva) ── carga jornada real vía jornadaRepository
        ▼
    EscanerAsistencia (rewired: jornadaId, tenantId) ── BarcodeDetector sin cambios
        │ QR → estudianteId
        ▼
    httpsCallable('registrarAsistenciaJornada') ── functions/academico/asistencia.js
        │ valida tenant, rol, jornada.estado==='en_curso'
        │ valida pertenencia: exists(.../ejecucionesPrograma/{jornada.ejecucionProgramaId}/inscripciones/{estudianteId})
        ▼
    tenants/{t}/jornadas/{j}/asistencias/{estudianteId}  (Admin SDK, bypassa rules)
        ▲
        │ conteo de check-ins al cerrar
    JornadasView.cerrar() → marcarPendienteCierre({ asistenciaRegistrada: count>0, objetivosImpartidos })

## File Changes

### Fase 0 — Roster explícito (nuevo, bloqueante)

| File | Action | Description |
|------|--------|--------------|
| `models/academico/inscripcion.ts` | Create | `InscripcionEjecucionPrograma { estudianteId, ejecucionProgramaId, tenantId, estado: 'activa' \| 'retirada', fechaInscripcion, inscritoPorUid }`. Nombre deliberadamente distinto de `InscripcionPrograma` (`tipos.ts:196`, modelo legacy) para no confundirlos |
| `servicios/academico/inscripcionRepository.ts` | Create | CRUD subcolección `ejecucionesPrograma/{id}/inscripciones`, patrón DI + mock-cuando-no-configurado de `programaRepository.ts`/`jornadaRepository.ts` |
| `servicios/academico/inscripcionService.ts` | Create | Puras: `estaInscrito(ejecucionProgramaId, estudianteId, inscripciones)`, `sugerirEstudiantesPorAtributo(ejecucion, estudiantes)` — esta última reusa el criterio grado/grupo **solo como sugerencia de UI**, nunca como validación de pertenencia |
| `components/academico/MatricularEstudiantesModal.tsx` | Create | Modal por fila de `EjecucionPrograma` en `AsignacionesView.tsx`: lista sugerida por atributo (pre-marcada) + selección manual, alta/baja explícita contra `inscripcionRepository` |
| `vistas/admin/AsignacionesView.tsx` | Modify | Agrega acción "Matricular estudiantes" por `EjecucionPrograma` (las que ya se listan/crean en líneas 994-1020) |
| `firestore.rules` (junto a línea 244) | Create | Regla `tenants/{t}/ejecucionesPrograma/{ejecucionId}/inscripciones/{estudianteId}` (ver Decisión 6) |
| `functions/test/firestore-rules.behavior.test.js` | Modify | Casos emulador: alta/baja por instructor mismo tenant, deny cross-tenant, deny rol no autorizado |
| `servicios/academico/inscripcionRepository.test.ts`, `inscripcionService.test.ts` | Create | TDD, patrón mocks de `programaRepository.test.ts` |
| `components/academico/MatricularEstudiantesModal.test.tsx` | Create | Testing Library: sugerencia por atributo, selección manual, persistencia |

### Fase 1+ — Check-in (ya en el diseño original, ajustado)

| File | Action | Description |
|------|--------|--------------|
| `functions/academico/asistencia.js` | Create | `crearServicioRegistrarAsistencia({firestore})`, toggle entrada/salida, valida tenant/rol/estado/**pertenencia contra roster** (patrón de `asignaciones.js`) |
| `functions/academico/asistencia.test.js` | Create | TDD, mocks estilo `invitaciones.test.js` (`makeFirestore`/`makeContext`), incluye caso "estudiante sin inscripción en la ejecución → rechazo" |
| `functions/index.js` | Modify | Registrar `exports.registrarAsistenciaJornada` |
| `servicios/academico/asistenciaRepository.ts` | Create | CRUD subcolección, patrón mock-cuando-no-configurado de `jornadaRepository.ts` |
| `servicios/academico/asistenciaService.ts` | Create | Puras: `contarCheckIns`, `calcularMinutosAsistidos` |
| `servicios/academico/ventanaClaseEnVivoService.ts` | Create | Pura: `calcularVentanaClaseEnVivo(jornadas, ahoraIso)`, ventana `[horaInicio - LIVE_CLASS_OPEN_BEFORE_MINUTES, horaFin + LIVE_CLASS_CLOSE_AFTER_MINUTES]` (corregido en Bloque B, Decisión 8 — valores y fuente de las constantes) |
| `hooks/useVentanaClaseEnVivo.ts` | Create | Polling 60s + memo, envuelve el servicio puro |
| `models/academico/asistencia.ts` | Create | `RegistroAsistencia { estudianteId, horaEntrada, horaSalida?, minutosAsistidos? }` |
| `components/EscanerAsistencia.tsx` | Modify | Props `sedeId`→`jornadaId,tenantId`; reemplaza `api.registrarEntrada` por el callable nuevo |
| `vistas/ClaseEnVivoView.tsx` | Rewrite | Recibe `jornadaId` real por ruta, monta `EscanerAsistencia`, lista check-ins en vivo |
| `vistas/Horarios.tsx` | Modify | Botón/acción "Iniciar Clase en Vivo" sobre `ClaseAcademicaAgenda` cuando está en ventana |
| `App.tsx:29-30,68,73-89,334` | Modify | Quitar import/route demo; `showClaseEnVivo` usa `useVentanaClaseEnVivo`; ruta `/clase-en-vivo/:jornadaId` |
| `vistas/admin/JornadasView.tsx:117-119,217-220` | Modify | `asistenciaRegistrada` deja de ser checkbox manual, viene de `contarCheckIns` sobre la subcolección |
| `firestore.rules:176-191` | Delete | Reglas huérfanas `clases_en_vivo`/`asistencias_jornada` |
| `firestore.rules` (nuevo, junto a línea 259) | Create | Regla `asistencias` subcolección (ver Decisión 3) |
| `functions/test/firestore-rules.etapa8.test.js` | Delete | Cubre reglas retiradas |
| `functions/test/firestore-rules.behavior.test.js` | Modify | Sumar casos emulador para la subcolección `asistencias` |
| `vistas/ClaseEnVivoIntegracion.test.tsx`, `servicios/claseEnVivoApi.test.ts`, `servicios/asistenciaQrApi.test.ts` | Delete | Prueban código archivado, nunca detectaron el bug real |
| `servicios/claseEnVivoApi.ts`, `servicios/asistenciaQrApi.ts`, archivo original de `ClaseEnVivoView.tsx` | Move | `git mv` a `_archive/sistema-b-clase-en-vivo/` |
| `tipos.ts:565-639` | Delete | `JornadaAcademica`,`ClaseEnVivo`,`EventoAsistenciaQr`,`AsistenciaJornada`; recuperables por git history (mover un bloque de interfaces no es práctico) |

## Interfaces / Contracts

```ts
// servicios/academico/inscripcionRepository.ts
interface InscripcionRepository {
  matricular(inscripcion: InscripcionEjecucionPrograma): Promise<void>;
  retirar(tenantId: string, ejecucionProgramaId: string, estudianteId: string): Promise<void>;
  listarPorEjecucion(tenantId: string, ejecucionProgramaId: string): Promise<InscripcionEjecucionPrograma[]>;
  estaInscritoEnEjecucion(tenantId: string, ejecucionProgramaId: string, estudianteId: string): Promise<boolean>;
}
```

```ts
// functions/academico/asistencia.js — callable
// input:  { tenantId: string, jornadaId: string, estudianteId: string }
// output success: { ok: true, tipo: 'entrada'|'salida', hora: string, minutosAsistidos?: number }
// errores: unauthenticated | permission-denied (rol/tenant) | failed-precondition (jornada.estado !== 'en_curso')
//        | not-found (jornada/estudiante inexistente) | permission-denied:not-enrolled (estudiante sin inscripción en jornada.ejecucionProgramaId)
```

```ts
// servicios/academico/ventanaClaseEnVivoService.ts
// NOTA: superado por Bloque B / Fase 9 — ver `calcularJornadasEnVentana` (retorna 0..N)
function calcularVentanaClaseEnVivo(
  jornadas: JornadaInstruccion[], ahoraIso: string
): JornadaInstruccion | null
```

## Firestore Rules — roster de inscripciones (Fase 0)

```
// Roster explícito de estudiantes matriculados en una ejecución de programa.
// Baja frecuencia (acción administrativa) → escritura directa gateada por rol,
// a diferencia de `asistencias` (Decisión 3) que sí exige Admin SDK por ser
// alta frecuencia y requerir cruce de pertenencia.
match /tenants/{tenantId}/ejecucionesPrograma/{ejecucionId}/inscripciones/{estudianteId} {
  allow read: if authenticated()
    && currentTenantId() == tenantId
    && !isTutor();
  allow create, delete: if isInstructor()
    && currentTenantId() == tenantId
    && request.resource.data.estudianteId == estudianteId
    && request.resource.data.tenantId == tenantId;
  allow update: if false; // re-matricular = delete + create; sin estados intermedios ambiguos
}
```

Nota: cambiar de `estado` (p.ej. `'activa'` → `'retirada'`) queda deliberadamente fuera de alcance de este change — un `delete` físico del documento es suficiente para la validación de pertenencia del callable (`exists()`); el campo `estado` en el modelo queda reservado para un change futuro de historial de matrícula si negocio lo pide.

## Testing Strategy

| Layer | What | Approach / Mocking |
|-------|------|---------------------|
| Roster puro | `estaInscrito`, `sugerirEstudiantesPorAtributo` | Jest, sin mocks |
| Roster repo | alta/baja/listado sobre subcolección `inscripciones` | Patrón mock de `programaRepository.test.ts` |
| Roster rules | tenant scoping, rol write, cross-tenant deny, `estudianteId`/`tenantId` en el doc coinciden con la ruta | `firestore-rules.behavior.test.js`, emulador real |
| Roster UI | sugerencia por atributo pre-marcada, selección manual, persistencia | Testing Library, `MatricularEstudiantesModal.test.tsx` |
| Callable | tenant/rol/estado/**pertenencia contra roster** (`exists()`), aceptar y rechazar | `node:test` + mocks manuales `makeFirestore`/`makeContext` (patrón `invitaciones.test.js`), TDD (`config.yaml: apply.tdd=true`); caso explícito "estudiante existe pero no está en el roster de esa ejecución (aunque comparta grado/grupo con otra sección)" |
| Rules asistencias | subcolección `asistencias`: deny write cliente, allow read mismo tenant, deny cross-tenant | `firestore-rules.behavior.test.js`, `@firebase/rules-unit-testing`, emulador real |
| Unit puro | `calcularVentanaClaseEnVivo`, `contarCheckIns` | Jest, sin mocks, fechas fijas inyectadas |
| Componente | `EscanerAsistencia` rewired, `ClaseEnVivoView` | Testing Library; mock `httpsCallable`/`firebase/functions`, mock `getUserMedia`+`BarcodeDetector` |
| Integración | `JornadasView.cerrar()` con asistencia computada | Extiende tests existentes de `JornadasView` con `asistenciaRepository` mock |
| E2E | Matricular → trigger desde Agenda → check-in → cierre | Extender `cypress/e2e/modulo-estudio-cierre-jornada.cy.ts` con matrícula previa |

## Migration / Rollout

Fases sugeridas (riesgo "Alto por alcance" de la propuesta, ahora con una fase adicional bloqueante):

0. **Roster de inscripciones** (nueva, bloqueante): modelo + repo + service + UI de matrícula en `AsignacionesView.tsx` + reglas + tests. Sin esto, el check-in no tiene contra qué validar pertenencia — no tiene sentido implementar Fase 1 antes.
1. Backend asistencia: modelo + regla + callable + tests TDD (pertenencia contra el roster de Fase 0, sin tocar UI de escaneo)
2. `asistenciaRepository`/`asistenciaService` + wiring en `JornadasView.cerrar()`
3. Rewire `EscanerAsistencia` + nuevo `ClaseEnVivoView` con ruta `:jornadaId`
4. `ventanaClaseEnVivoService` + hook + trigger real en `App.tsx`/`Horarios.tsx`
5. Archivo de Sistema B (`git mv`, borrado de tests/reglas huérfanas)
6. E2E + regresión completa (`npm test -- --runInBand`, `npm run build`)

No hay migración de datos: Sistema B nunca persistió en Firestore (confirmado en exploración previa). **Riesgo operativo de la Fase 0→1**: las `EjecucionPrograma`/jornadas ya generadas hoy no tienen ningún roster matriculado. Hasta que un admin complete la matrícula manual (Fase 0 UI) para cada `EjecucionPrograma` activa, el callable de check-in (Fase 1) rechazará a **todos** los estudiantes por diseño (fail-closed, sin roster = sin pertenencia). Esto debe comunicarse como paso operativo previo al rollout de Fase 1, no es un bug.

## Open Questions

- [x] ~~**Bloqueante para Fase 1 (Decisión 4)**: `InscripcionPrograma.idPrograma` (`tipos.ts:196`) — ¿referencia `Programa.id` (legacy) o `ProgramaAcademico.id` (académico)?~~ **Resuelto por decisión de producto**: confirmado por código que son espacios de ID distintos y sin relación (ver Decisión 5); ya no se usa `idPrograma` para pertenencia. Se reemplaza por el roster explícito de Fase 0, keyed por `ejecucionProgramaId`.
- [x] ~~Ventana 5min/10min: confirmado contra `horaInicio` (no `horaFin`)... validar con negocio si el check-in debe permanecer abierto durante toda la sesión.~~ **Resuelto por Bloque B (Decisión 8)**: `Módulo Clase en Vivo.txt` sección 3 es explícito — `LIVE_CLASS_OPEN_BEFORE_MINUTES=15` antes de `horaInicio`, `LIVE_CLASS_CLOSE_AFTER_MINUTES=15` después de `horaFin` (no de `horaInicio`). El check-in permanece abierto durante toda la sesión, no solo en una ventana corta al inicio.
- [ ] **Nueva**: la matrícula se modela a nivel `EjecucionPrograma` completo (todas sus jornadas). ¿Negocio necesita alguna vez matricular a un estudiante a una jornada individual suelta (ej. clase de prueba, invitado)? Fuera de alcance de este change; si aparece, requiere un modelo adicional más granular (`jornadaId` opcional en `InscripcionEjecucionPrograma`) diferido a change futuro.
- [ ] **Nueva**: ¿Quién es responsable operativo de mantener el roster actualizado ante bajas/cambios de sección a mitad de ciclo? No bloqueante para este change (el modelo soporta alta/baja), pero es un proceso de negocio a definir fuera del alcance técnico.

---

# Bloque B — Diseño técnico completo ("Clase en Vivo")

**Precondición**: esto es diseño, no implementación. Ninguna pieza de esta sección se construye antes de que Bloque A esté implementado y pase `sdd-verify` (gate explícito en `proposal.md` y en Migration/Rollout más abajo). Bloque B no reabre ninguna decisión de Bloque A (roster, callable de asistencia, subcolección `asistencias`, regla de pertenencia) — las extiende.

## Technical Approach — Bloque B

Sobre la base ya depurada de Bloque A (`JornadaInstruccion` como única fuente, roster explícito, callable `registrarAsistenciaJornada`, `EscanerAsistencia.tsx` rewireado), Bloque B agrega: (1) constantes de ventana horaria centralizadas y consumidas por cliente y Functions sin duplicación de valores hardcodeados; (2) campos completos de check-in/check-out con cálculo server-side de retraso y duración; (3) selector de clase cuando hay ventanas simultáneas; (4) checkpoint de materiales guiado sobre `AsignacionAcademica` (sin callable nuevo — reusa `publishAsignacion`); (5) observaciones grupales rápidas; (6) **notificación a acudientes server-side vía Meta WhatsApp Cloud API** (`functions/notificaciones/whatsappCloudApi.js`), disparada dentro del callable de check-out (Decisión 13, reemplazada); (7) estado de Clase en Vivo como función pura derivada, no persistida; (8) ensamblado visual de las 5 secciones del `.txt` sobre `ClaseEnVivoView.tsx`.

## Architecture Decisions — Bloque B (continúa la numeración de la tabla principal)

| # | Decisión | Alternativa descartada | Rationale |
|---|----------|------------------------|-----------|
| 8 | Constantes `LIVE_CLASS_OPEN_BEFORE_MINUTES=15`/`LIVE_CLASS_CLOSE_AFTER_MINUTES=15` **duplicadas a propósito** en `constantes.ts` (cliente, ESM — `package.json:5` raíz tiene `"type":"module"`) y en `functions/academico/constantesClaseEnVivo.js` (nuevo, CJS — `functions/package.json` no declara `"type":"module"`, confirmado `require()` en `functions/index.js:1-25`), cada archivo con comentario cruzado apuntando al hermano | (a) paquete/workspace compartido cliente↔Functions — sobre-ingeniería, el repo no usa monorepo/workspaces hoy; (b) generar el archivo de Functions en un paso de build desde `constantes.ts` — no existe pipeline de build compartido (`firebase deploy --only functions` no pasa por Vite); (c) hardcodear el valor sin nombre en `asistencia.js` — viola `.txt` §3 explícitamente ("no quemar estos valores de forma rígida") | CJS y ESM no pueden importar el mismo archivo `.ts`/`.js` sin una capa de build adicional que hoy no existe; duplicar 2 constantes numéricas con comentario cruzado y test de paridad (ver Testing Strategy) es más simple y más correcto que introducir infraestructura de build nueva para 2 números |
| 9 | Validación de ventana horaria también **server-side**, dentro del callable `registrarAsistenciaJornada` (Bloque A), comparando `ahora` contra `[jornada.horaInicio - 15min, jornada.horaFin + 15min]` antes de aceptar check-in/check-out | Confiar solo en que el cliente oculte el botón fuera de ventana | El `.txt` §3 es explícito: "No permitir check-in ni check-out fuera de la ventana permitida, salvo permiso administrativo explícito" — ocultar el botón en UI no impide una llamada directa al callable; mismo principio de "fail-closed server-side" ya aplicado en Bloque A Decisión 3 |
| 10 | `RegistroAsistencia` (Bloque A) se **extiende con campos aditivos** en la misma interfaz, no se crea un modelo paralelo | Modelo nuevo `RegistroAsistenciaCompleto` separado | Bloque A todavía no está implementado en el momento de este diseño (no hay migración de datos real que romper); fragmentar en dos modelos duplicaría lógica de lectura en `JornadasView.cerrar()` y en las queries de métricas (§11) |
| 11 | `isLate`/`minutesLate` (check-in) y `durationMinutes`/`attendanceStatus` (check-out) se calculan **dentro del mismo callable `registrarAsistenciaJornada`** (rama "entrada" y rama "salida" del toggle ya existente), no en un callable nuevo | Callable dedicado `registrarCheckInCompleto`/`registrarCheckOutCompleto` | El callable ya decide entrada/salida server-side (Bloque A Decisión 2); agregar los cálculos a cada rama existente evita duplicar la resolución de tenant/rol/pertenencia/ventana en un segundo endpoint |
| 12 | Selector de clase múltiple: `calcularJornadasEnVentana(jornadas, ahoraIso): JornadaInstruccion[]` (reemplaza `calcularVentanaClaseEnVivo`, ahora retorna 0..N) + `filtrarJornadasPorPermiso(jornadas, usuario)` en el **mismo archivo** `servicios/academico/ventanaClaseEnVivoService.ts` | Archivo/servicio nuevo dedicado a permisos | Es el mismo pipeline puro (ventana → filtro de rol), mismo test file, mismas fechas fijas inyectadas; fragmentar en dos archivos para dos pasos secuenciales de una función pura es fragmentación sin beneficio |
| 13 (reemplaza la anterior — decisión de producto de esta revisión) | **Notificación a acudientes vía Meta WhatsApp Cloud API, server-side, disparada dentro del mismo callable de check-out** (`functions/academico/asistencia.js`, rama salida). Servicio nuevo `functions/notificaciones/whatsappCloudApi.js` (carpeta nueva, consistente con `functions/academico/`, `functions/asistente/`), función `enviarWhatsAppCloudApi({ telefono, plantilla, parametros }) → { exito: boolean, mensajeId?: string, error?: string }`. Endpoint `POST https://graph.facebook.com/v20.0/{WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages` vía `axios` (ya dependencia de `functions/`, `functions/package.json:19`, `^1.13.5` — confirmado, sin instalación nueva). Credenciales vía Firebase Functions v2 `defineSecret`: `WHATSAPP_CLOUD_API_TOKEN` (Access Token de Meta) y `WHATSAPP_CLOUD_API_PHONE_NUMBER_ID` (Phone Number ID) — nunca hardcodeadas ni en `.env` versionado. Plantilla pre-aprobada requerida por Meta: `clase_finalizada_notificacion`, parámetros nombre del estudiante/hora de salida/sede/nombre de la clase (mismo contenido que ya especifica `.txt` §8). Se agrega `TipoNotificacion.ClaseFinalizada` y campos aditivos `estado?`/`intentos?`/`errorMensaje?` a `NotificacionHistorial` (`tipos.ts:285-306`, hoy solo tiene `leida: boolean`, confirmado por lectura de código — sin campo de estado/reintento) | (a) Disparo **client-side** reutilizando `enviarNotificacion`/`guardarNotificacionEnHistorial` (`servicios/notificacionesApi.ts:14,43`) — diseño de la revisión anterior de este documento, descartado por decisión explícita del usuario al ver el gap de automatización real; (b) evolucionar la extensión de navegador no oficial `extension_whatsapp/`/`tudojangRelay.ts` — descartado, requiere sesión activa de WhatsApp Web en el dispositivo del operador, no es push de servidor; (c) Cloud Function trigger `onWrite` sobre el doc de asistencia al setear `checkOutTime` — sobre-ingeniería frente a invocar el envío directamente dentro del mismo callable que ya escribe `checkOutTime`, sin necesidad de un trigger adicional ni de manejar la latencia/orden de eventos que eso introduce | Auditoría de código (`proposal.md`, hallazgo confirmado por grep de "whatsapp" en el repo) confirmó que ninguno de los 3 mecanismos existentes era invocable desde una Cloud Function ni era un proveedor automatizado real. El usuario decidió explícitamente resolver el gap con la Meta WhatsApp Cloud API oficial (server-side, gratis hasta 1000 conversaciones/mes) en vez de aceptar la limitación manual — integrarla dentro del callable de check-out evita la dependencia del dispositivo/pestaña del operador y cumple el requisito real de negocio ("el acudiente debe enterarse automáticamente"). La plantilla pre-aprobada es una restricción de la plataforma Meta (ventana de 24hs de conversación activa), no una elección de diseño: no se puede evitar por código, se documenta como paso operativo manual bloqueante para el funcionamiento real (no para el desarrollo, que testea con mocks) |
| 14 | Checkpoint de materiales: campos aditivos directamente en `AsignacionAcademica` (`models/academico/asignacion.ts`), persistidos reusando el callable **ya existente** `publishAsignacion` vía `actualizarAsignacion()` → `publicarAsignacion()` (`servicios/academico/asignacionService.ts:269-325`, confirmado que ya enruta por `httpsCallable(..., 'publishAsignacion')`, no por escritura directa) | (a) subcolección `checkpoints` separada; (b) callable nuevo dedicado `actualizarCheckpointAsignacion` | El checkpoint es 1:1 con la asignación-jornada (`asignacion-${recursoId}-${jornadaId}`, ya generado así por `publishAsignacionesBatch`), no historiza checkpoints independientes — agregar campos al doc existente evita una lectura/JOIN extra en `ClaseEnVivoView`, que ya carga `AsignacionAcademica` de todos modos. **Corrección necesaria detectada por verificación de código** (no asumida): `crearServicioPublishAsignacion` (`functions/academico/asignaciones.js:89`) hace `estado: 'publicada'` **incondicional** en cada `set()` sin merge — si Bloque B reusa este callable para guardar checkpoint sobre una asignación que ya está `cerrada`/`vencida`, la reescribiría a `'publicada'` silenciosamente. Bloque B debe modificar esa línea para preservar `estado` existente en updates (doc ya existe) y aplicar el default `'publicada'` solo en creación real |
| 15 | Estado de Clase en Vivo (`scheduled\|available\|in_progress\|closed\|expired\|cancelled`) como **función pura derivada** `calcularEstadoClaseEnVivo(jornada, ahoraIso, tieneCheckIns)`, no persistida — nuevo archivo `servicios/academico/estadoClaseEnVivoService.ts` | Campo nuevo `estadoClaseEnVivo` persistido en `JornadaInstruccion` | `EstadoJornada` (`models/academico/index.ts:30-40`) ya es una máquina de estados de 10 valores con transiciones documentadas; persistir una segunda máquina de estados en paralelo puede desincronizarse (ej. `jornada.estado==='en_curso'` pero la ventana ya expiró — ¿cuál manda?). Derivar en cada lectura elimina esa ambigüedad por construcción |

### Mapeo de estado derivado (Decisión 15)

| Estado Clase en Vivo | Condición |
|---|---|
| `cancelled` | `jornada.estado` en `{'cancelada', 'reprogramada'}` (gana sobre cualquier condición de tiempo — cubre `.txt` §16 "clase desactivada antes de iniciar") |
| `closed` | `jornada.estado` en `{'cerrada', 'parcial'}` |
| `expired` | `ahora > horaFin + 15min` **y** `jornada.estado` no está en `{'cerrada','parcial','cancelada','reprogramada'}` (cubre `.txt` §16 "clase terminó pero no fue cerrada") |
| `in_progress` | dentro de ventana (`horaInicio - 15min <= ahora <= horaFin + 15min`) **y** existe ≥1 check-in en la subcolección `asistencias` |
| `available` | dentro de ventana, sin check-ins aún, `jornada.estado` en `{'confirmada','en_curso','pendiente_cierre'}` |
| `scheduled` | `ahora < horaInicio - 15min`, `jornada.estado` en `{'confirmada','en_curso','pendiente_cierre'}` |

`jornada.estado` en `{'borrador','pendiente_confirmacion'}` → la jornada no se considera "clase programada real" para Clase en Vivo (`.txt` §4: "Si no existe clase programada, no debe abrirse"); se excluye en la query de `calcularJornadasEnVentana`, no llega a este mapeo. `pendiente_sustitucion` se trata como activa (mapeo normal por tiempo) — sigue siendo una clase real que ocurre, solo pendiente de asignar sustituto.

**Caso "cambio de maestro asignado desde Agenda antes de la clase" (`.txt` §16)**: no requiere código nuevo — `filtrarJornadasPorPermiso` lee `jornada.instructorId` fresco de Firestore en cada consulta (Bloque A no denormaliza ese campo en ningún otro lugar), así que un cambio de maestro antes de que abra la ventana se refleja automáticamente. El único campo que **sí** se denormaliza a propósito es `RegistroAsistencia.teacherId` (ver Interfaces abajo), congelado al momento del check-in para trazabilidad histórica del check-in ya ocurrido, que no debe cambiar retroactivamente si el maestro se reasigna después.

**Roles y permisos — verificado, no asumido**: `RolUsuario` (`tipos.ts:4-11`) ya incluye `Asistente` como valor del enum, y la función `isInstructor()` de `firestore.rules:51-54` ya incluye `'Asistente'` junto a `'Admin'`, `'Editor'`, `'SuperAdmin'`. El `.txt` §12 pide "Asistente autorizado si el sistema ya contempla ese rol" — **ya lo contempla**, no se requiere ningún cambio de modelo de roles. `filtrarJornadasPorPermiso`: `Admin`/`SuperAdmin`/`Asistente` ven todas las jornadas del tenant en ventana (mismo nivel de acceso que ya les da `isInstructor()` para roster/asistencias); `Editor` (rol que cumple la función de "maestro" en este dominio — no existe un valor de enum `Maestro` separado) solo ve jornadas donde `instructorId === uid`.

## Data Flow — Bloque B

    ClaseEnVivoView (montada por Bloque A con jornadaId de ruta, o sin jornadaId si viene del ítem de menú)
        │
        ▼
    calcularJornadasEnVentana(jornadasDeHoy, ahora) ── 0..N, pura, recalculada c/60s (mismo hook de Bloque A)
        │
        ▼
    filtrarJornadasPorPermiso(jornadas, usuarioActual) ── Admin/Asistente: todas; Editor: solo instructorId===uid
        │
        ├── 0 resultados → estado "sin clase disponible"
        ├── 1 resultado  → se monta directo
        └── 2+ resultados → SelectorClaseActiva (nuevo) → usuario elige → se monta
        ▼
    Sección A: encabezado (clase, hora, sede, maestro, calcularEstadoClaseEnVivo)
    Sección B: EscanerAsistencia (rewire Bloque A) ── QR → registrarAsistenciaJornada (extendido: valida ventana, calcula isLate/duration)
        │
        ├── check-in exitoso → Sección C: ListaAsistenciaClase se actualiza (listener en vivo sobre `asistencias`)
        └── check-out exitoso (dentro del mismo callable, server-side) → enviarWhatsAppCloudApi({telefono, plantilla:'clase_finalizada_notificacion', parametros})
                │   (functions/notificaciones/whatsappCloudApi.js, Admin SDK, sin acción del cliente)
                ├── éxito → NotificacionHistorial: estado='enviada', mensajeId persistido, TipoNotificacion.ClaseFinalizada
                ├── falla (red/API/plantilla no aprobada) → NotificacionHistorial: estado='fallida', errorMensaje persistido, reintento controlado disponible desde UI
                └── sin acudiente registrado → no se invoca; NotificacionHistorial: estado='no_aplica_sin_acudiente' (no bloquea el check-out)
    Sección D: CheckpointMaterialesClase ── lee AsignacionAcademica[] por jornadaId, guarda vía actualizarAsignacion() → publishAsignacion (existente)
    Sección E: cierre ── ObservacionesRapidasClase (nuevo, subcolección `observaciones`) + resumen + confirmar → jornadaService.cerrarJornada() (Bloque A, sin cambios)

## File Changes — Bloque B (Fases 7-15, continúa la numeración de Bloque A que ocupa Fases 0-6)

### Fase 7 — Constantes centralizadas cross-runtime (Decisión 8, 9)

| File | Action | Description |
|------|--------|--------------|
| `constantes.ts` | Modify | Agregar `LIVE_CLASS_OPEN_BEFORE_MINUTES=15`, `LIVE_CLASS_CLOSE_AFTER_MINUTES=15` |
| `functions/academico/constantesClaseEnVivo.js` | Create | CJS, mismos valores, comentario cruzado hacia `constantes.ts` |
| `servicios/academico/ventanaClaseEnVivoService.ts` | Modify | Consumir las constantes de `constantes.ts` en vez de valores locales (ya corregidos en Bloque A Fase 4 según nota de cabecera de este documento) |
| `functions/academico/asistencia.js` (Bloque A) | Modify | Importar `constantesClaseEnVivo.js`; agregar validación server-side de ventana horaria antes de aceptar check-in/check-out |
| `functions/academico/asistencia.test.js` | Modify | Casos: check-in/check-out fuera de ventana rechazados; dentro de ventana aceptados |

### Fase 8 — Check-in/check-out completos (Decisión 10, 11)

| File | Action | Description |
|------|--------|--------------|
| `models/academico/asistencia.ts` (Bloque A) | Modify | Extender `RegistroAsistencia` con `checkedInBy`, `teacherId`, `venueId`, `status`, `isLate`, `minutesLate`, `checkedOutBy`, `attendanceStatus`, `notificationStatus` (ver Interfaces) |
| `functions/academico/asistencia.js` | Modify | Rama "entrada": calcular `isLate`/`minutesLate` comparando `checkInTime` vs `jornada.horaInicio`; rama "salida": calcular `minutosAsistidos`/`attendanceStatus` |
| `functions/academico/asistencia.test.js` | Modify | TDD: llegada a tiempo, llegada tarde (minutos exactos), check-out con duración calculada |
| `servicios/academico/asistenciaService.ts` (Bloque A) | Modify | Puras de soporte para métricas (§11): horas acumuladas por sesión, conteo de tardíos |

### Fase 9 — Selector de clase múltiple (Decisión 12)

| File | Action | Description |
|------|--------|--------------|
| `servicios/academico/ventanaClaseEnVivoService.ts` | Modify | `calcularVentanaClaseEnVivo` → `calcularJornadasEnVentana` (retorna 0..N); agregar `filtrarJornadasPorPermiso` |
| `servicios/academico/ventanaClaseEnVivoService.test.ts` | Modify | Casos: 0/1/N jornadas en ventana; filtro por rol Editor vs Admin/Asistente |
| `hooks/useVentanaClaseEnVivo.ts` (Bloque A) | Modify | Adaptar a array de resultados en vez de valor único |
| `components/academico/SelectorClaseActiva.tsx` | Create | UI de selección cuando `filtrarJornadasPorPermiso(...).length >= 2` |
| `components/academico/SelectorClaseActiva.test.tsx` | Create | Testing Library |

### Fase 10 — Notificación a acudientes vía Meta WhatsApp Cloud API (Decisión 13, reemplazada)

| File | Action | Description |
|------|--------|--------------|
| `tipos.ts:285-306` | Modify | `TipoNotificacion.ClaseFinalizada` (aditivo); `NotificacionHistorial.estado?`, `.intentos?`, `.errorMensaje?` (aditivos, opcionales — no rompen `useGestionNotificaciones.ts`) |
| `functions/notificaciones/whatsappCloudApi.js` (nuevo módulo `functions/notificaciones/`) | Create | `enviarWhatsAppCloudApi({telefono, plantilla, parametros}) → {exito, mensajeId?, error?}`; `axios.post` a `https://graph.facebook.com/v20.0/{WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages`; `defineSecret('WHATSAPP_CLOUD_API_TOKEN')`, `defineSecret('WHATSAPP_CLOUD_API_PHONE_NUMBER_ID')` |
| `functions/notificaciones/whatsappCloudApi.test.js` | Create | TDD: éxito (mock axios 200 → `mensajeId`), error de red/API (mock axios reject/4xx-5xx → `{exito:false,error}`, sin excepción no controlada), credenciales faltantes (`{exito:false,error}` sin llamar a la red) |
| `functions/academico/asistencia.js` (rama salida, Bloque A/B) | Modify | Tras `checkOutTime` exitoso, invoca `enviarWhatsAppCloudApi` server-side con plantilla `clase_finalizada_notificacion` y parámetros del `.txt` §8; persiste `estado`/`mensajeId`/`errorMensaje` en `NotificacionHistorial`; no bloquea el check-out si falla el envío |
| `functions/academico/asistencia.test.js` | Modify | Casos: envío exitoso persiste `estado='enviada'`; falla persiste `estado='fallida'`+`errorMensaje`; sin acudiente registrado → `estado='no_aplica_sin_acudiente'`, no invoca el envío, check-out igual exitoso |
| `vistas/ClaseEnVivoView.tsx` | Modify | UI de reintento si `estado==='fallida'` (invoca de nuevo el callable de check-out o un endpoint de reintento dedicado — el envío ya no es una acción client-side, la UI solo refleja estado y ofrece reintentar) |

### Fase 11 — Checkpoint de materiales (Decisión 14)

| File | Action | Description |
|------|--------|--------------|
| `models/academico/asignacion.ts` | Modify | Campos aditivos: `checkpointInicio?`, `checkpointAvance?`, `checkpointNota?`, `checkpointCierre?` (ver Interfaces) |
| `functions/academico/asignaciones.js:89` | Modify | **Fix requerido** (Decisión 14): no forzar `estado:'publicada'` en updates de doc existente; preservar estado terminal |
| `functions/academico/asignaciones.test.js` | Modify | Caso: actualizar checkpoint sobre asignación `cerrada` no debe revertir su `estado` |
| `components/academico/CheckpointMaterialesClase.tsx` | Create | UI guiada de las 3 sub-fases (§9.1-9.3), checkboxes/selects, nunca prompt libre; usa `actualizarAsignacion()` existente |
| `components/academico/CheckpointMaterialesClase.test.tsx` | Create | Testing Library; casos "clase sin materiales asignados" (empty state) |
| `servicios/academico/checkpointMaterialService.ts` | Create | Puras: transición de sub-estados, cálculo de % de cobertura para el resumen de cierre |
| `servicios/academico/checkpointMaterialService.test.ts` | Create | TDD |

### Fase 12 — Observaciones rápidas grupales

| File | Action | Description |
|------|--------|--------------|
| `models/academico/observacion.ts` | Create | `ObservacionRapidaClase { id, tenantId, jornadaId, categoria, notaCorta?, registradoPorUid, registradoEn }` (ver Interfaces) |
| `servicios/academico/observacionRepository.ts` | Create | CRUD subcolección `jornadas/{j}/observaciones`, patrón mock-cuando-no-configurado |
| `firestore.rules` (junto a línea 259) | Create | `tenants/{t}/jornadas/{j}/observaciones/{id}`: `allow create: if isInstructor()`, `allow read: if isInstructor()`, `allow update, delete: if false` (mismo patrón que `auditoria`) |
| `components/academico/ObservacionesRapidasClase.tsx` | Create | 8 categorías fijas (§10) + nota corta opcional con límite de caracteres |
| `components/academico/ObservacionesRapidasClase.test.tsx` | Create | Testing Library |
| `functions/test/firestore-rules.behavior.test.js` | Modify | Casos emulador para `observaciones` |

### Fase 13 — Estado derivado y flujo visual (Decisión 15)

| File | Action | Description |
|------|--------|--------------|
| `servicios/academico/estadoClaseEnVivoService.ts` | Create | Pura: `calcularEstadoClaseEnVivo` (ver mapeo arriba) |
| `servicios/academico/estadoClaseEnVivoService.test.ts` | Create | TDD, un caso por fila del mapeo |
| `vistas/ClaseEnVivoView.tsx` (Bloque A) | Modify | Ensamblar secciones A-E; A usa `calcularEstadoClaseEnVivo`; C monta `ListaAsistenciaClase` |
| `components/academico/ListaAsistenciaClase.tsx` | Create | Sección C: esperados/con check-in/pendientes/con check-out/tardíos, listener en vivo sobre `asistencias` |
| `components/academico/ListaAsistenciaClase.test.tsx` | Create | Testing Library; caso "clase sin estudiantes esperados" (empty state) |
| `components/EscanerAsistencia.tsx` (Bloque A) | Modify | Mensajes de éxito/error específicos (QR inválido, duplicado, fuera de tenant/clase) para Sección B |

### Fase 14 — Casos especiales y métricas consultables

| File | Action | Description |
|------|--------|--------------|
| `functions/academico/asistencia.test.js`, `servicios/academico/*.test.ts` | Modify | Cubrir los 16 casos de la matriz de abajo como tests explícitos (no ya cubiertos por fases previas) |
| `servicios/academico/metricasClaseEnVivoService.ts` | Create | Puras/queries: asistencias, ausencias, tardíos, horas por sesión, materiales cubiertos/pendientes — consultable, sin dashboard (`.txt` §11 lo excluye explícitamente) |
| `servicios/academico/metricasClaseEnVivoService.test.ts` | Create | TDD |

### Fase 15 — E2E y regresión completa Bloque A+B

| File | Action | Description |
|------|--------|--------------|
| `cypress/e2e/clase-en-vivo-bloque-b.cy.ts` | Create | Flujo completo: matrícula → trigger Agenda → selector (si aplica) → check-in con retraso → checkpoint → check-out → notificación → observación → cierre |
| — | Run | `npm run test:all`, `npm run build` |

## Interfaces / Contracts — Bloque B

```ts
// models/academico/asistencia.ts — RegistroAsistencia extendido (Bloque A + Bloque B)
interface RegistroAsistencia {
  estudianteId: string;
  horaEntrada: string;              // checkInTime (.txt §6)
  horaSalida?: string;              // checkOutTime (.txt §7)
  minutosAsistidos?: number;        // durationMinutes (.txt §7)
  checkedInBy: string;              // uid de quien escaneó el check-in
  checkedOutBy?: string;            // uid de quien escaneó el check-out
  teacherId: string;                // instructorId de la jornada AL MOMENTO del check-in (denormalizado a propósito, ver Decisión 15)
  venueId: string;                  // sedeId de la jornada
  status: 'presente' | 'tarde';
  isLate: boolean;                  // calculado server-side
  minutesLate?: number;             // calculado server-side, solo si isLate
  attendanceStatus: 'en_curso' | 'completa'; // 'completa' tras check-out
  notificationStatus?: 'pendiente' | 'enviada' | 'fallida' | 'no_aplica_sin_acudiente';
}
```

```js
// functions/notificaciones/whatsappCloudApi.js
// enviarWhatsAppCloudApi({ telefono, plantilla, parametros }) -> Promise<{ exito: boolean, mensajeId?: string, error?: string }>
// - telefono: string (formato E.164)
// - plantilla: string (nombre de plantilla pre-aprobada en Meta, ej. 'clase_finalizada_notificacion')
// - parametros: string[] | Record<string,string> (valores posicionales de la plantilla, orden = .txt §8:
//     nombre del estudiante, hora de salida, sede, nombre de la clase)
// Secrets (Firebase Functions v2, defineSecret): WHATSAPP_CLOUD_API_TOKEN, WHATSAPP_CLOUD_API_PHONE_NUMBER_ID
// Endpoint: POST https://graph.facebook.com/v20.0/{WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages (axios)
// Nunca lanza: credenciales faltantes o error de red/API se capturan y retornan como {exito:false, error}
```

```ts
// tipos.ts — NotificacionHistorial extendido (Bloque B, aditivo)
interface NotificacionHistorial {
  // ...campos existentes sin cambios (id, fecha, estudianteId, estudianteNombre, tutorNombre, destinatario, canal, tipo, mensaje, leida)
  estado?: 'enviada' | 'fallida' | 'no_aplica_sin_acudiente'; // ausente = notificaciones previas a este change (retrocompatible)
  intentos?: number;
  errorMensaje?: string;
}
// TipoNotificacion agrega: ClaseFinalizada = 'ClaseFinalizada'
```

```ts
// models/academico/asignacion.ts — AsignacionAcademica, campos aditivos de checkpoint
interface AsignacionAcademica {
  // ...campos existentes sin cambios (id, tenantId, recursoId, jornadaId, estado, etc.)
  checkpointInicio?: 'planea_usar' | 'deja_pendiente' | 'no_aplica';              // §9.1
  checkpointAvance?: 'usado' | 'mencionado' | 'explicado' | 'practicado'
    | 'parcialmente_cubierto' | 'pendiente' | 'no_usado';                         // §9.2
  checkpointNota?: string;                                                        // §9.2, límite de caracteres en UI
  checkpointCierre?: {                                                            // §9.3
    decision: 'confirmar' | 'ajustar' | 'dejar_pendiente';
    porcentajeCobertura?: number;
    registradoPorUid: string;
    registradoEn: string;
  };
}
```

```ts
// models/academico/observacion.ts
type CategoriaObservacionClase =
  | 'buena_energia' | 'baja_energia' | 'requiere_refuerzo' | 'buen_avance_tecnico'
  | 'dificultad_general' | 'clase_interrumpida' | 'material_insuficiente' | 'excelente_participacion';

interface ObservacionRapidaClase {
  id: string;
  tenantId: string;
  jornadaId: string;
  categoria: CategoriaObservacionClase;
  notaCorta?: string;
  registradoPorUid: string;
  registradoEn: string;
}
```

```ts
// servicios/academico/ventanaClaseEnVivoService.ts
function calcularJornadasEnVentana(jornadas: JornadaInstruccion[], ahoraIso: string): JornadaInstruccion[];
function filtrarJornadasPorPermiso(
  jornadas: JornadaInstruccion[],
  usuario: { uid: string; rol: RolUsuario }
): JornadaInstruccion[];
```

```ts
// servicios/academico/estadoClaseEnVivoService.ts
type EstadoClaseEnVivo = 'scheduled' | 'available' | 'in_progress' | 'closed' | 'expired' | 'cancelled';
function calcularEstadoClaseEnVivo(
  jornada: JornadaInstruccion, ahoraIso: string, tieneCheckIns: boolean
): EstadoClaseEnVivo;
```

## Firestore Rules — observaciones rápidas (Fase 12)

```
// Observaciones grupales rápidas, ligadas a la jornada. Baja frecuencia, sin cruce
// a otra colección — mismo nivel de rigor que `auditoria` (create-only, sin update/delete).
match /tenants/{tenantId}/jornadas/{jornadaId}/observaciones/{observacionId} {
  allow read: if isInstructor()
    && currentTenantId() == tenantId;
  allow create: if isInstructor()
    && currentTenantId() == tenantId
    && request.resource.data.tenantId == tenantId
    && request.resource.data.jornadaId == jornadaId;
  allow update, delete: if false;
}
```

## Testing Strategy — Bloque B

| Layer | What | Approach / Mocking |
|-------|------|---------------------|
| Constantes | paridad de valor 15/15 en `constantes.ts` y `constantesClaseEnVivo.js` | Un test en cada runtime (Jest y `node:test`) asertando el valor esperado; comentario en cada archivo señalando actualizar el hermano si cambia |
| Ventana server-side | check-in/check-out fuera de `[horaInicio-15,horaFin+15]` rechazado | `functions/academico/asistencia.test.js`, TDD |
| Cálculo de retraso/duración | `isLate`/`minutesLate`/`minutosAsistidos` | Unit puro + caso en el callable con fechas fijas inyectadas |
| Selector múltiple | `calcularJornadasEnVentana` (0/1/N) + `filtrarJornadasPorPermiso` (Editor vs Admin/Asistente) | Jest, sin mocks, fechas fijas |
| Checkpoint materiales | transiciones de sub-estado, % cobertura, no bloquea check-in, no revierte `estado` terminal | `checkpointMaterialService.test.ts` + `asignaciones.test.js` (fix de Decisión 14) |
| Observaciones | categorías fijas, nota con límite de caracteres, reglas Firestore | Testing Library + `firestore-rules.behavior.test.js`, emulador real |
| Notificación | éxito (mock `axios.post` 200 → `mensajeId`); error de red/API (mock reject/4xx-5xx → `{exito:false,error}`, sin excepción no controlada); credenciales faltantes (`{exito:false,error}` sin llamar a la red); wiring del callable: sin acudiente → no se invoca, `estado='no_aplica_sin_acudiente'`; envío ok → `estado='enviada'`; falla → `estado='fallida'`+`errorMensaje`+reintento controlado | `functions/notificaciones/whatsappCloudApi.test.js` (mocks de `axios`, `node:test`), `functions/academico/asistencia.test.js` (wiring dentro del callable) |
| Estado derivado | las 6 salidas del mapeo, incluyendo `expired` y `cancelled` con prioridad sobre tiempo | `estadoClaseEnVivoService.test.ts`, un caso por fila |
| Casos especiales §16 | matriz completa (ver abajo) | Distribuidos por fase (ver File Changes), consolidados en Fase 14 |
| E2E | flujo completo Bloque A+B | `cypress/e2e/clase-en-vivo-bloque-b.cy.ts` |

## Casos especiales — matriz de cobertura (`.txt` §16)

**Corrección verificada**: el `.txt` titula esta sección "16. Casos especiales" porque es la **sección número 16** del documento, no porque liste 16 casos — contiene textualmente **14 viñetas**. Se verificó contra el archivo real (`Módulo Clase en Vivo.txt`, líneas 458-475): las 14 ya estaban enumeradas en `proposal.md` (incluidos "cambio de maestro asignado desde Agenda" y "clase desactivada antes de iniciar", que la tarea de reconciliación planteaba como posibles faltantes — verificación de código descarta esa hipótesis, ya estaban cubiertos). Se agregan 2 casos adicionales **no listados textualmente en §16** pero exigidos por reglas explícitas de otras secciones, para cobertura completa de requisitos y no solo del rótulo de la sección.

| # | Caso | Origen | Cobertura de diseño |
|---|------|--------|----------------------|
| 1 | Doble QR en check-in | §16 | Callable rechaza si ya existe doc en `asistencias/{estudianteId}` con `horaEntrada` seteada (toggle de Bloque A) |
| 2 | Check-out sin check-in | §16 | Callable rechaza si no existe doc previo con `horaEntrada` |
| 3 | Estudiante del tenant pero no de esa clase | §16 | Validación de pertenencia contra roster (Bloque A Decisión 4) |
| 4 | Estudiante de otro tenant | §16 | `assertTenantAutorizado` (patrón ya usado en `asignaciones.js`) |
| 5 | Cámara no disponible | §16 | `EscanerAsistencia.tsx` ya maneja `errorCamara` (código existente, Sistema C) |
| 6 | QR inválido | §16 | `EscanerAsistencia.tsx` ya maneja `SyntaxError`/mensaje "Código QR inválido" (código existente) |
| 7 | Clase fuera de horario | §16 | Validación de ventana server-side (Decisión 9, Fase 7) |
| 8 | Clase sin materiales asignados | §16 | `CheckpointMaterialesClase` empty state (Fase 11) |
| 9 | Clase sin estudiantes esperados | §16 | `ListaAsistenciaClase` empty state (Fase 13) |
| 10 | Usuario sin permiso intenta operar | §16 | `isInstructor()`/`validarJornada` (Bloque A, ya exige `instructorId===uid` para Editor) |
| 11 | WhatsApp falla | §16 | `enviarWhatsAppCloudApi` retorna `{exito:false,error}` de forma controlada (red, API de Meta, plantilla no aprobada, credenciales faltantes); `notificationStatus`/`NotificacionHistorial.estado:'fallida'`+`errorMensaje` + reintento controlado, sin bloquear el check-out (Fase 10, Decisión 13 reemplazada) |
| 12 | Clase terminó sin cerrar | §16 | Estado derivado `expired` (Decisión 15) |
| 13 | Cambio de maestro asignado desde Agenda antes de la clase | §16 | Sin denormalización de `instructorId` fuera de la jornada — se refleja automático (ver nota bajo Decisión 15) |
| 14 | Clase desactivada antes de iniciar | §16 | Estado derivado `cancelled` tiene prioridad sobre cualquier condición de tiempo (Decisión 15) |
| 15 | Estudiante inactivo intenta check-in | §6 ("Que el estudiante está activo"), no listado en §16 | Callable valida `estudiante.activo` además de pertenencia — distinto del caso 3 (activo pero de otra clase) |
| 16 | No hay acudiente registrado (check-out válido, sin notificación posible) | §8 ("No enviar notificación si no existe acudiente registrado"), no listado en §16 | `notificationStatus:'no_aplica_sin_acudiente'`, distinto del caso 11 (intento fallido vs ausencia de destinatario) |

## Migration / Rollout — Fases Bloque B (continúa la numeración de Bloque A, Fases 0-6)

7. Constantes centralizadas cross-runtime + validación de ventana server-side (Decisión 8, 9)
8. Check-in/check-out completos: modelo extendido + cálculo de retraso/duración (Decisión 10, 11)
9. Selector de clase múltiple + filtro por permisos (Decisión 12)
10. Notificación a acudientes server-side vía Meta WhatsApp Cloud API + extensión aditiva de `NotificacionHistorial` (Decisión 13, reemplazada) — **requiere, además del código, configuración operativa manual en Meta (cuenta Business, Access Token, Phone Number ID, plantilla `clase_finalizada_notificacion` pre-aprobada) antes de que el envío real funcione en producción; el código y los tests no dependen de esa configuración (mocks)**
11. Checkpoint de materiales (incluye el fix de `asignaciones.js:89`, Decisión 14)
12. Observaciones rápidas grupales
13. Estado derivado + ensamblado visual de las 5 secciones
14. Casos especiales (matriz completa) + métricas consultables
15. E2E + regresión completa Bloque A+B (`npm run test:all`, `npm run build`)

**Gate bloqueante explícito**: la Fase 7 de Bloque B no arranca hasta que las Fases 0-6 de Bloque A estén implementadas **y** `sdd-verify` confirme 0 regresiones. Motivo (ver `proposal.md`): construir sobre un módulo con múltiples fuentes de verdad o conexiones rotas reproduciría el problema original. El diseño de ambos bloques, en cambio, ya está completo en este documento — `sdd-tasks` puede generar el checklist de Fases 0-15 de una sola vez, marcando las Fases 7-15 como bloqueadas hasta que se cumpla el gate.

No hay migración de datos en Bloque B: todos los campos nuevos son aditivos y opcionales sobre modelos de Bloque A que todavía no tienen datos en producción.

## Open Questions — Bloque B

- [ ] **Nueva (Decisión 13 reemplazada)**: la plantilla `clase_finalizada_notificacion` debe pre-aprobarse manualmente en Meta Business Manager; hasta entonces `enviarWhatsAppCloudApi` retornará `{exito:false, error}` en producción real (el desarrollo y los tests no se bloquean, usan mocks). No hay forma de automatizar ese paso por código — queda como checklist operativo explícito en `tasks.md`.
- [ ] **Nueva**: `checkpointNota`/`notaCorta` de observaciones — el `.txt` pide "límite de caracteres" sin especificar el número exacto; se propone 240 caracteres (consistente con el patrón de redes sociales) como default de implementación, sujeto a validación de negocio en `sdd-tasks` o durante la implementación.
- [ ] **Nueva**: `Asistente` ve todas las jornadas del tenant en el selector múltiple (mismo nivel que Admin), por ser el comportamiento ya implícito en `isInstructor()`. Si negocio quiere que un Asistente solo opere las clases donde está explícitamente asignado (no solo por tenant), se requiere un modelo de asignación de asistentes a jornadas que hoy no existe — fuera de alcance de Bloque B, diferido a change futuro si aparece el requisito.
- [ ] **Nueva**: Fase 14 (métricas consultables) deja los datos listos para reportes pero no define el esquema exacto de queries agregadas multi-jornada (fuera de alcance explícito, ver `proposal.md` Out of Scope) — un change futuro de dashboards deberá revisar si las queries puras de `metricasClaseEnVivoService.ts` son suficientes o requieren desnormalización adicional (ej. documentos de resumen pre-agregados).
