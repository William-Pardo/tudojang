# Resumen de codebase — relevante a la sesión del módulo Agenda (2026-07-08)

Este archivo cubre solo la porción del codebase tocada o relevante para el módulo 12 (Mejora del módulo Agenda). No es un mapa completo del repo.

## Sistema real (vigente) — usar esto

```
models/academico/
  jornada.ts          → interface JornadaInstruccion (id, tenantId, programaId, ejecucionProgramaId,
                         grupoId, sedeId, espacioId, instructorId, bloqueRecurrenteId?, fecha,
                         horaInicio, horaFin, estado, objetivosPlaneados[], objetivosImpartidos[],
                         asistenciaRegistrada, motivoCancelacion?, tema?, creadoEn, actualizadoEn)
  programa.ts          → ProgramaAcademico, EjecucionPrograma
  asignacion.ts         → AsignacionAcademica (incluye jornadaId? — material por jornada individual)
  index.ts               → EstadoJornada: borrador | pendiente_confirmacion | confirmada | en_curso |
                          pendiente_cierre | cerrada | cancelada | reprogramada | parcial |
                          pendiente_sustitucion

servicios/academico/
  jornadaRepository.ts   → guardarJornada (con lock optimista desde 12.4), existeConflictoHorario
                          (con motivo desde 12.3), registrarAuditoria, guardarJornadasEnLote,
                          eliminarJornadasEnLote (HARD DELETE real — cuidado), actualizarTemaJornada
  jornadaService.ts       → createJornada, confirmarJornada, iniciarJornada, cerrarJornada,
                          cancelarJornada, reprogramarJornada, máquina de estados
  programaService.ts      → createPrograma, publishPrograma, generarJornadasDeEjecucion
  programaRepository.ts   → CRUD Firestore de ProgramaAcademico/EjecucionPrograma
  asignacionService.ts    → listarAsignacionesPorTenant, publishAsignacion, actualizarAsignacion
  agendaAcademicaService.ts → obtenerClasesAcademicasDelTenant (fuente de lectura de Horarios.tsx)
  confirmJornada.ts       → validarConfirmacionJornada (más completa que existeConflictoHorario,
                          pero NO conectada a ninguna vista — decisión consciente en 12.3 de no
                          wirearla, ver Registro de cierre 12.3)
  espacioService.ts        → createEspacio, updateEspacio, getDisponibilidad
  jornadaContextService.ts → contexto de selects (programas/sedes/instructores); espacio
                          hardcodeado a un único 'tatami-1' (gap documentado, pendiente 12.7)

vistas/
  Horarios.tsx            → única vista "agenda-like" existente hoy; grilla por día, sin franja
                          horaria, sin navegación de semanas, solo lectura para clases académicas
  admin/JornadasView.tsx  → flujo demo de ciclo de vida de UNA jornada sintética (no recibe
                          jornadaId real); tiene el formulario inline "Programa" (líneas ~302-388)
                          candidato a extraer en 12.7
  admin/MisClasesView.tsx → grilla 3x3 paginada de jornadas reales por programaId; acciones
                          inline (no modal) confirmar/iniciar/cerrar/cancelar/reprogramar; ya
                          tiene el gating de permisos (12.2), el mensaje de conflicto de horario
                          (12.3) y el manejo de ConflictoConcurrenciaError (12.4)
  admin/AsignacionesView.tsx → flujo "Publicar material"; wizard AsignarMaterialWizard.tsx
                          candidato a reutilizar como pestaña "Materiales" del futuro modal (12.7/12.9)

components/academico/AsignarMaterialWizard.tsx → ya desacoplado vía props (materialesDisponibles,
                          tagsPrograma, gruposObjetivo, draftInicial, onConfirmar) — reutilizable
                          tal cual para la pestaña Materiales del modal de edición (12.9)

firestore.rules → bloque `match /tenants/{tenantId}/jornadas/{jornadaId}`: regla `update` ajustada
                  en 12.2 para exigir instructorId == uid salvo Admin. NOTA: el archivo tiene
                  mojibake preexistente en varios comentarios (acadÃ©mico en vez de académico) —
                  no causado por esta sesión, ver ERROR_LOG.md.
```

## Sistema huérfano ("Sistema B") — NO USAR, fuera de alcance del módulo 12

```
servicios/cohortesApi.ts, jornadasApi.ts, agendaManualApi.ts, claseEnVivoApi.ts,
asistenciaQrApi.ts, progresoClaseApi.ts   → sueltos en servicios/ (no en servicios/academico/),
                                          params: any sin tipar, sin persistencia real confirmada
vistas/ClaseEnVivoView.tsx                 → único consumidor real, y solo de claseEnVivoApi/
                                          asistenciaQrApi; confirmado roto en
                                          openspec/changes/clase-en-vivo-checkin-trigger-agenda/
                                          proposal.md
tipos.ts (bloque CohorteAcademica/JornadaAcademica/ClaseEnVivo/EventoAsistenciaQr/
          AsistenciaJornada)              → tipos del sistema huérfano
```

## Archivos modificados en esta sesión (2026-07-08)

- `CIERRE CENTRO DE ESTUDIOS.md` — nueva sección módulo 12 + registros de cierre 12.1–12.4.
- `PLAN_INTEGRACION_AGENDA_PROGRAMA_CLASE_EN_VIVO.md` — banner "SUPERADO" agregado.
- `firestore.rules` — regla `update` de `jornadas` (12.2).
- `functions/test/firestore-rules.behavior.test.js` — 6 tests nuevos (12.2).
- `servicios/academico/jornadaRepository.ts` — `existeConflictoHorario` con motivo (12.3),
  `guardarJornada` con lock optimista (12.4), `ConflictoConcurrenciaError` (12.4).
- `servicios/academico/jornadaRepository.test.ts` — tests de 12.3 y 12.4.
- `vistas/admin/JornadasView.tsx` / `.test.tsx` — gating (12.2), mensajes (12.3), manejo de
  conflicto de concurrencia (12.4).
- `vistas/admin/MisClasesView.tsx` / `.test.tsx` — ídem.
- `vistas/admin/AsignacionesView.tsx` — prop `esAdmin` pasada a `MisClasesView` (12.2).
