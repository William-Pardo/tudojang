## Exploration: Integración Programa Académico ↔ Agenda (etapa 3)

### Current State

Investigando el código real aparece un hallazgo mayor: **hay DOS sistemas de "programa + horario" paralelos y desconectados en este repo.**

**Sistema legacy (el que la gente usa hoy para la Agenda real)**:
- `tipos.ts`: `Programa` (comercial — `tipoCobro`, `valor`, `bloquesHorarios?: BloqueHorario[]`) y `BloqueHorario` (`dia`, `horaInicio`, `horaFin`, `sedeId`, `instructorId`, `grupo`, `programaId`).
- `vistas/Horarios.tsx` (la vista real de Agenda): lee `agendaCompleta`/`programas` de `useProgramas()` (`DataContext`), permite agendar clases (`ModalAgendarClase`) filtrando por sede/instructor.
- Este es el sistema que hoy alimenta lo que el usuario llama "la Agenda".

**Sistema académico nuevo (Centro de Estudios, materiales, jornadas)**:
- `models/academico/programa.ts`: `ProgramaAcademico` (curricular — `unidades`, `objetivos`, sin fechas ni horario) y `EjecucionPrograma` (progreso — `unidadActualId`, `objetivosCompletados`, **sin `fechaFin` ni referencia a ningún horario/bloque**).
- `models/academico/jornada.ts`: `JornadaInstruccion` (la "clase" real, state machine completo) y `BloqueRecurrente` (`diaSemana`, `horaInicio/Fin`, `sedeId`, `instructorId`, `grupoId`) — **estructuralmente casi idéntico a `BloqueHorario`, pero en un tipo distinto**.
- `servicios/academico/jornadaService.ts`: **`generateJornadasFromBloque` ya existe y ya hace exactamente lo que se necesita** — dado un `BloqueRecurrente` + rango de fechas, genera todas las `JornadaInstruccion` del período. Hoy solo se usa para chequeo de conflictos de horario (`jornadaRepository.existeConflictoHorario`), nunca para poblar una agenda.
- `servicios/academico/jornadaRepository.ts`: tiene `listarJornadasPorTenant` (agregado en el change `asignacion-material-por-clase` recién completado) — ya listo para alimentar una vista de agenda real.
- `vistas/admin/JornadasView.tsx`: gestiona UNA sola jornada activa (lifecycle borrador→cerrada) con datos demo hardcodeados — no es una vista de calendario/agenda de múltiples clases.
- `vistas/admin/AsignacionesView.tsx`: simula jornadas 100% client-side para su propio preview (`generarJornadasLocalesPrograma`, ver change anterior) — otro simulacro más, van tres formas distintas de generar "clases" en el mismo repo.

**Conclusión clave**: `EjecucionPrograma` no sabe nada de horarios, y `ProgramaAcademico` no sabe nada de fechas. No existe ningún punto donde "Programa académico" + "horario recurrente" produzcan jornadas reales automáticamente — aunque la pieza más difícil (`generateJornadasFromBloque`) ya está escrita y no hay que inventarla.

### Affected Areas

- `models/academico/programa.ts` — `EjecucionPrograma` necesita `bloques: BloqueRecurrente[]` (o referencias) + `fechaFin`
- `servicios/academico/programaService.ts` — `assignProgramaToGrupo` necesita aceptar horario/bloques y fecha de fin
- `servicios/academico/jornadaService.ts` — `generateJornadasFromBloque` ya sirve, reutilizar tal cual
- `servicios/academico/jornadaRepository.ts` — agregar guardado en lote (batch) de las jornadas generadas
- Vista nueva o extensión de `JornadasView.tsx`/`AsignacionesView.tsx` — para visualizar clase+maestro+material+sede+grupo del programa completo
- `vistas/Horarios.tsx`, `tipos.ts` (`Programa`, `BloqueHorario`), `context/DataContext` (`useProgramas`, `agendaCompleta`) — el sistema legacy, candidato a NO tocar en una primera etapa (ver recomendación)

### Approaches

1. **Unificar los dos sistemas (legacy ↔ académico) de una** — hacer que `Horarios.tsx`/`agendaCompleta` lean también `JornadaInstruccion` reales.
   - Pros: una sola fuente de verdad para "la Agenda" desde el día uno, exactamente lo que pidió el usuario.
   - Cons: `Horarios.tsx` es la Agenda REAL que el staff usa hoy para operación y facturación (`Programa.tipoCobro`/`valor`) — tocarla es alto riesgo sobre un flujo comercial en producción. Requiere reconciliar dos modelos de "bloque horario" casi iguales pero no idénticos.
   - Effort: High.

2. **Completar el dominio académico de punta a punta (generar + persistir + visualizar), sin tocar la Agenda legacy** — extender `EjecucionPrograma` con bloques+fechaFin, generar y persistir `JornadaInstruccion` reales al confirmar el programa (reusando `generateJornadasFromBloque`, ya escrito), y construir/extender una vista propia (dentro de Centro de Estudios) que muestre clase+maestro+material+sede+grupo usando `listarJornadasPorTenant` (ya existe).
   - Pros: reutiliza código ya probado (`generateJornadasFromBloque`), cero riesgo sobre la Agenda comercial en uso, resuelve el 100% del tope de 60-sin-paginar que quedó pendiente del change anterior (porque ahora las jornadas SÍ se persisten de una).
   - Cons: el usuario sigue teniendo "dos agendas" (la comercial y la académica) hasta que se decida unificar — puede sentirse como una solución parcial si lo que se esperaba era una sola pantalla.
   - Effort: Medium.

3. **Solo el backend (generar + persistir), sin vista nueva todavía** — extender el modelo y persistir jornadas reales al confirmar el programa, pero dejar la visualización para una iteración siguiente.
   - Pros: el trabajo más chico y de menor riesgo; desbloquea el dato real para que cualquier vista futura (incluida una eventual unificación con la Agenda legacy) lo consuma.
   - Cons: no se "ve" nada nuevo todavía — el usuario no percibe el beneficio hasta la siguiente iteración.
   - Effort: Low-Medium.

### Recommendation

**[CORREGIDO tras aclaración del usuario]** La recomendación inicial era Approach 2 (dominio académico solo, sin tocar la Agenda legacy) por ser la de menor riesgo. El usuario aclaró explícitamente: espera que el programa cree las clases "de manera real en LA agenda" (la agenda existente que usa hoy) mostrando grupo, maestro, sede, programa, material asignado, día y hora — no una pantalla nueva separada dentro de Centro de Estudios.

Esto apunta a **Approach 1** (unificación), con una sub-decisión pendiente de confirmar con el usuario:
- **1a — Integración aditiva**: `Horarios.tsx`/`agendaCompleta` empiezan a leer TAMBIÉN `JornadaInstruccion` (vía `listarJornadasPorTenant`) y mostrarlas junto a los `BloqueHorario` existentes, sin fusionar los tipos. Menor riesgo que una fusión total, pero conviven dos modelos de bloque horario permanentemente.
- **1b — Unificación real de modelos**: migrar `BloqueHorario`/`Programa` (legacy) para que se apoyen en `BloqueRecurrente`/`ProgramaAcademico`/`JornadaInstruccion`, una sola fuente de verdad. Mayor esfuerzo y riesgo (toca facturación en vivo), pero es la solución "correcta" a largo plazo.

Recomiendo 1a como punto de partida — reutiliza `generateJornadasFromBloque` y `listarJornadasPorTenant` ya construidos, entrega exactamente lo que el usuario pidió visualmente, y no reescribe el modelo comercial que sostiene la facturación hoy. 1b queda como evolución posterior si 1a demuestra que vale la pena unificar del todo.

### Risks

- `BloqueRecurrente` vs `BloqueHorario`: son casi el mismo concepto en dos tipos distintos — si más adelante se decide unificar (Approach 1), va a haber que mapear/migrar datos entre ambos, no es gratis.
- `generateJornadasFromBloque` genera jornadas para UN bloque (un día de la semana) — un programa con clases Lunes/Miércoles/Viernes necesita 3 `BloqueRecurrente` y 3 llamadas; hay que decidir cómo se modela "el horario completo de un programa" (¿array de bloques en `EjecucionPrograma`?).
- Persistir jornadas de todo un período (potencialmente meses) en batch al confirmar el programa puede acercarse al límite de 500 operaciones de `firestore.batch()` para programas largos con múltiples bloques — mismo riesgo ya anotado (sin resolver) en `asignacion-material-por-clase`.
- `EjecucionPrograma` no tiene `fechaFin` hoy — agregarlo es un cambio de modelo que puede afectar a quien ya lea/escriba ese tipo (`advanceCiclo`, `JornadasView.tsx`, tests existentes de `programaService`) — auditar usos antes de tocar.

### Ready for Proposal

Sí. **Decisión confirmada por el usuario: Approach 1a (integración aditiva)** — la Agenda existente (`Horarios.tsx`) leerá también `JornadaInstruccion` reales generadas y persistidas desde el programa académico (grupo, maestro, sede, programa, material asignado, día, hora), sin fusionar `BloqueHorario`/`BloqueRecurrente`. Approach 1b (unificación total de modelos) queda descartado para esta etapa.
