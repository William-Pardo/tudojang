# Handover — Módulo 12: Mejora del módulo Agenda

Para quien continúe este trabajo (otra sesión, otra IA, u otro desarrollador).

## Dónde está todo

- **Fuente de requisitos**: `Mejora del módulo Agenda.txt` (raíz del repo).
- **Diagnóstico + plan + registro de avance**: `CIERRE CENTRO DE ESTUDIOS.md`, sección `## 12. Mejora modulo Agenda: parrilla semanal y edicion granular de clase`. Cada subtarea (12.1–12.12) tiene su checklist `[x]`/`[ ]` y, si está cerrada, un bloque `### Registro de cierre` con el ciclo TDD completo, comandos ejecutados y resultado real.
- **Documento viejo, superado**: `PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md` tiene un banner al inicio marcándolo `SUPERADO — 2026-07-08`. **No lo uses como base técnica** — describe un sistema huérfano que nunca se conectó a producción.

## Decisión de arquitectura vigente (no reabrir esta discusión sin evidencia nueva)

Agenda se construye sobre `models/academico/*` + `servicios/academico/*` (entidad `JornadaInstruccion`, persistida en `tenants/{tenantId}/jornadas/{jornadaId}`). El "Sistema B" (`servicios/cohortesApi.ts`, `jornadasApi.ts`, `agendaManualApi.ts`, `claseEnVivoApi.ts`, `asistenciaQrApi.ts`, `progresoClaseApi.ts`, y las entidades `CohorteAcademica`/`JornadaAcademica`/`ClaseEnVivo`/`EventoAsistenciaQr`/`AsistenciaJornada` en `tipos.ts`) queda fuera de alcance — no tocar, no extender, no usar como referencia de implementación.

## Qué está hecho (verificado, no solo reportado)

| Subtarea | Estado | Qué hace |
|---|---|---|
| 12.1 | COMPLETA | Auditoría técnica del módulo, tabla de gaps por requisito. |
| 12.2 | COMPLETA | `firestore.rules` exige `instructorId == request.auth.uid` (salvo Admin) para editar una jornada; `MisClasesView.tsx` oculta acciones con `puedeEditarJornada(jornada, usuarioId, esAdmin)`. |
| 12.3 | COMPLETA | `existeConflictoHorario` detecta choques de instructor entre sedes distintas (antes solo detectaba dentro de la misma sede/espacio); devuelve `{ hayConflicto, motivo?: 'instructor' \| 'espacio' }`; helper `mensajeConflictoHorario` da el texto específico por campo. |
| 12.4 | COMPLETA | `guardarJornada(jornada, { actualizadoEnEsperado })` rechaza con `ConflictoConcurrenciaError` si otro usuario ya guardó; vistas muestran "La clase fue modificada por otro usuario...". |
| 12.5 | COMPLETA | `registrarAuditoria` ahora exige `rol` y `fuente: 'jornadas' \| 'mis_clases' \| 'asignaciones'` (se descubrió un tercer call site real en `AsignacionesView.tsx` no listado en 12.1); `cambios` pasó de objeto plano a `CambioAuditoriaJornada[]` vía el helper `diffCambiosJornada`; un fallo de auditoría ya no es silencioso (`MENSAJE_ADVERTENCIA_AUDITORIA` visible en UI), aunque no revierte el guardado principal (sin transacción). Nota para 12.8: sumar `'agenda'` al union type `FuenteAuditoriaJornada` cuando exista esa vista. |
| 12.6 | COMPLETA (guarda) / DIFERIDO (UI a 12.9) | `eliminarJornadasEnLote` queda intacta (hard delete sin guardas, solo para limpiar previews en `AsignacionesView.tsx`). Nueva `eliminarJornadaSegura(jornada)` aplica `evaluarEliminacionSegura` (bloquea si `asistenciaRegistrada === true` o `estado` en `en_curso\|pendiente_cierre\|cerrada\|parcial`) y lanza `EliminacionNoPermitidaError` sin borrar nada si no es segura. El modal de confirmación con el copy de la sección 8 (`MENSAJE_CONFIRMACION_ELIMINAR_CLASE`, ya exportado) queda diferido a 12.9: hoy no existe ningún botón "eliminar clase" individual en ninguna vista real. |

| 12.7 | COMPLETA | `PestanaProgramaJornada.tsx` reemplazó el formulario inline de `JornadasView.tsx` (mismo comportamiento, 13 tests intactos). `PestanaMaterialesJornada.tsx` envuelve `AsignarMaterialWizard` para una jornada puntual (sin consumidor real todavía, listo para 12.9). `espacioRepository.ts` (solo lectura) reemplazó el hardcode `tatami-1` en `jornadaContextService.ts`. **Riesgo abierto real**: ningún tenant tiene espacios cargados en Firestore hoy (`EspaciosView.tsx` es demo con estado local, nunca persiste) — el selector de espacio va a mostrar vacío en la práctica hasta que exista un CRUD real de espacios (fuera de alcance de Agenda). |

## Qué falta (en orden sugerido, ver checklist completo en `CIERRE CENTRO DE ESTUDIOS.md`)

- **12.8** Vista Agenda: parrilla semanal 7am–10pm con navegación de semanas (no existe ruta `/agenda` hoy).
- **12.9** Modal de edición singular enganchado a la parrilla.
- **12.10** Constantes `LIVE_CLASS_OPEN_BEFORE_MINUTES`/`CLOSE_AFTER_MINUTES` + reemplazo del placeholder `showClaseEnVivo = true` en `App.tsx`.
- **12.11** Exposición mínima para Hub Estudiantes (decisión ya tomada: solo servicio de lectura, no UI completa — no hay roster estudiante-jornada real).
- **12.12** Validación final (matriz de casos, regresión completa).

## Reglas de trabajo para quien continúe

1. **TDD estricto obligatorio**: RED → GREEN → REFACTOR → VERIFY → TRACE. Ninguna tarea se marca `[x]` sin evidencia (comandos + resultado) registrada en `CIERRE CENTRO DE ESTUDIOS.md`.
2. **Nunca `npm run build`** tras cambios (instrucción explícita del usuario, ver `~/.claude/CLAUDE.md`).
3. **No commitear**: el usuario pidió explícitamente revisar el diff acumulado de **todo** el módulo 12 recién al final, no subtarea por subtarea. No hacer `git add`/`git commit` hasta que el usuario lo pida.
4. **Verificar antes de dar por cerrada una subtarea delegada**: leer el diff real (`git diff`, `Grep`/`Read` sobre los archivos tocados), no confiar ciegamente en el resumen de un subagente.
5. **Alcance acotado por subtarea**: cada subtarea debe tocar solo lo que le corresponde; no reabrir subtareas ya cerradas salvo necesidad imprescindible, documentándolo.

## Riesgo/nota operativa

Un subagente (12.3) se cortó a mitad de tarea por límite de sesión de la API (`session limit · resets ...`). Se resolvió reanudándolo con `SendMessage` usando su `agentId`, pasándole un resumen de dónde había quedado. Si vuelve a pasar, ese es el patrón a seguir: no relanzar desde cero, reanudar el mismo agente.

## Por qué 12.5 quedó sin arrancar (aclaración 2026-07-09)

Esta sesión no se cerró porque el usuario decidiera pausar el módulo 12. Se cortó porque un hook `Stop` agregado desde **otra** ventana de Claude Code (compartida vía `.claude/settings.json`, config de proyecto con recarga en vivo) empezó a dispararse acá también mientras el usuario atendía esa otra ventana. Ver `ERROR_LOG.md`, ítems 5 y 6, para el detalle completo. **12.5–12.12 siguen pendientes y deben retomarse como próximo paso**, no como trabajo de baja prioridad.
