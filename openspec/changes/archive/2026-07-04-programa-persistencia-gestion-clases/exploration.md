## Exploration: Persistencia real de Programa/Ejecución + gestión de clases

### Current State

Confirmado con grep (no queda ninguna duda): `servicios/academico/programaService.ts` (`createPrograma`/`publishPrograma`/`assignProgramaToGrupo`/`advanceCiclo`/`generarJornadasDeEjecucion`) son funciones 100% puras — cero imports de Firestore, cero llamadas a ningún repositorio. `ProgramaAcademico` y `EjecucionPrograma` se arman en memoria dentro de `guardarPrograma()` (`vistas/admin/AsignacionesView.tsx`) SOLO para generar las jornadas, y después se descartan. El "programa" que ve el usuario vive en `useState<ProgramaAcademicoAsignacion[]>` local, sembrado siempre con el mismo `programaInicial` demo — no sobrevive a un remount ni a navegar afuera y volver.

**Hallazgo con buena noticia**: `jornadaRepository.ts` YA TIENE `guardarEjecucion(ejecucion)` implementado y funcional (persiste en `tenants/{tenantId}/ejecucionesPrograma/{id}`) — lo confirmé leyendo el código. Grep en `AsignacionesView.tsx` muestra que **nunca se llama** — un descuido concreto de Fase 5, no un gap de arquitectura. Arreglar la mitad de "Ejecución" es trivial.

Para `ProgramaAcademico` no existe ningún repositorio: grep de `listarProgramas`/`obtenerProgramas`/`listarEjecuciones` en todo `servicios/` no encuentra nada para el dominio académico (`programasApi.ts` que sí aparece es el modelo COMERCIAL legacy, `Programa`/`BloqueHorario`, un dominio distinto).

`vistas/admin/JornadasView.tsx` (la única UI de ciclo de vida de una jornada: borrador→confirmada→en_curso→cerrada, reutilizando `confirmarJornada`/`iniciarJornada`/`marcarPendienteCierre`/`cerrarJornada` de `jornadaService.ts`, ya probadas) gestiona una única jornada hardcodeada de demo (`crearEstadoInicialJornada`) — nunca conectada a jornadas reales de un programa.

Sobre el estado "duplicado" que planteé para investigar: `programaJornada`/`sedeJornada`/`grupoJornada`/`instructorJornada`/`espacioJornada` **no están muertos** — se siguen usando como fallback de display (líneas 1453-1456), en filtros (1060-1061), y en una sección de UI que parece ser del modo NO-embedded ("Paso 3B", líneas ~1967-2007). Es decir, el componente tiene dos modos (embedded/standalone) con conceptos parcialmente duplicados — no es basura para borrar sin más, es una consolidación real a diseñar.

Sobre los dos flujos de publicar: confirmado que el botón "Publicar material" (single) y la sección "Publicación en lote" conviven ambos dentro del mismo bloque `embedded`, uno seguido del otro — fusionarlos es técnicamente viable (el de lote ya soporta 1 material × 1 clase).

### Affected Areas

- `servicios/academico/programaRepository.ts` — **crear**, mismo patrón que `jornadaRepository.ts`: `guardarPrograma`, `listarProgramasPorTenant`
- `vistas/admin/AsignacionesView.tsx` — `guardarPrograma()` debe llamar `repositoryJornada.guardarEjecucion()` (ya existe, solo falta el llamado) + el nuevo `programaRepository.guardarPrograma()`; al montar, leer programas reales en vez de sembrar solo el demo
- Vista nueva o sección nueva "Mis clases" — tabla de jornadas reales del programa (fecha, hora, estado, material) con acciones confirmar/iniciar/cerrar, reusando `jornadaService.ts` (ya probado) y `agendaAcademicaService.ts` (resolución de material, ya construido en el change anterior)
- `vistas/admin/JornadasView.tsx` — evaluar si se extiende para aceptar una jornada real por prop/ruta, o si la nueva vista de "Mis clases" es un componente separado
- Limpieza de estado: `programaJornada`/`sedeJornada`/`grupoJornada`/`instructorJornada`/`espacioJornada` — consolidar con `programaSeleccionado` donde el modo sea `embedded`
- Fusión de flujos de publicar (single + lote) dentro del bloque `embedded`

### Approaches

1. **Persistencia completa + vista de gestión de clases (todo junto)** — persistir Programa (nuevo repo) y Ejecución (ya existe, solo conectar), listar programas reales al montar, construir la tabla "Mis clases" con acciones de ciclo de vida.
   - Pros: resuelve los 2 bugs reportados de raíz; deja el módulo genuinamente completo y usable en producción real.
   - Cons: alcance más grande — toca persistencia nueva + una vista nueva.
   - Effort: Medium-High.

2. **Solo persistencia (sin vista de gestión de clases todavía)** — arreglar que programa y ejecución se guarden y se puedan releer, dejar la gestión de clases (bug 2) para una iteración siguiente.
   - Pros: más rápido, resuelve bug 1 completo.
   - Cons: bug 2 sigue sin resolver — el usuario dijo explícitamente que quiere ver las clases para editarlas.
   - Effort: Low-Medium.

3. **Bundle de simplificación** (fusionar flujos de publicar + limpiar estado embedded/standalone duplicado) — ortogonal a 1/2, se puede hacer en la misma change o después.
   - Pros: menos código, UI más clara, menos pasos como pidió el usuario.
   - Cons: toca código ya estable (single-flow tiene 0 regresiones hoy) — riesgo de romper algo que funciona por pulir.
   - Effort: Medium (si se hace junto con 1).

### Recommendation

Approach 1, con el Approach 3 (fusión de flujos + limpieza de estado) como fases dentro de la MISMA change, ya que se toca el mismo archivo de todas formas. Empezar por el fix trivial (`guardarEjecucion` ya existe, solo conectarlo) da una victoria rápida y de bajo riesgo antes de construir lo nuevo (`programaRepository` + vista de "Mis clases").

### Risks

- `listarProgramasPorTenant` nuevo necesita reglas de Firestore para `tenants/{tenantId}/programasAcademicos` (o el nombre de colección que se use) — verificar/agregar en `firestore.rules`, no existe hoy para este dominio.
- La vista "Mis clases" va a mostrar potencialmente muchas jornadas (una por cada ocurrencia generada, no colapsadas como en la Agenda) — considerar paginación desde el diseño, no como afterthought.
- Fusionar los dos flujos de publicar toca código con 0 regresiones hoy — hacerlo con TDD estricto, no de un tirón.
- Limpiar el estado `programaJornada`/etc. requiere primero entender bien qué hace el modo NO-embedded (standalone) de este componente, que no se investigó a fondo en esta exploración — puede requerir una pasada de lectura adicional en `sdd-design`.

### Ready for Proposal

Sí. Alcance claro, causa raíz confirmada con evidencia de código (no especulación), approach recomendado identificado con una victoria rápida de por medio (`guardarEjecucion` ya construido).
