# Registro 12.4 — bloqueado por dependencias de jornada/programa

- [ ] 12.4 Escribir test E2E del flujo de cierre de jornada: maestro registra asistencia + objetivos -> cierra jornada -> programa avanza posicion -> asignaciones de refuerzo publicadas.

## Estado

Bloqueado para cierre real.

## Dependencias faltantes

La verificacion local no encontro implementaciones completas de:

- `programaService` / `advanceCiclo` — requerido por 5.1.
- `jornadaService` / modelo `JornadaInstruccion` — requerido por 7.1.
- Cloud Function `confirmJornada` — requerido por 7.2.
- Cloud Function `closeJornada` — requerido por 7.3.
- `JornadasView` — requerido por 7.4.
- Cloud Function `publishAsignacion` — requerido por 8.2.
- `AsignacionesView` — requerido por 8.3.

## Decision

No se marca 12.4 como completada porque hacerlo seria una falsa validacion.
El siguiente paso desbloqueador es implementar 5.1: modelo y servicio base de programa academico con avance de ciclo testeado.
