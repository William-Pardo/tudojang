# Proposal: Persistencia real de Programa/Ejecución + gestión de clases

## Intent

El usuario probó manualmente el flujo real y encontró 2 bugs: el programa creado no queda guardado para reeditarlo, y no hay forma de ver/gestionar las clases generadas. Causa raíz confirmada: `programaService.ts` es 100% funciones puras — `ProgramaAcademico`/`EjecucionPrograma` nunca se persisten en Firestore, solo las jornadas derivadas.

## Scope

### In Scope
- Conectar `repositoryJornada.guardarEjecucion()` (ya existe y funciona) desde `guardarPrograma()` — hoy nunca se llama
- Crear `programaRepository.ts` (mismo patrón que `jornadaRepository.ts`): `guardarPrograma`, `listarProgramasPorTenant`
- `AsignacionesView.tsx` lee programas reales al montar en vez de sembrar solo el demo
- Vista/sección nueva "Mis clases": tabla de jornadas reales del programa (fecha, hora, estado, material asignado) con acciones confirmar/iniciar/cerrar, reusando `jornadaService.ts` y `agendaAcademicaService.ts` ya construidos
- Fusionar el flujo de publicar "single" con el de "lote" (el de lote ya soporta 1×1)
- Consolidar el estado duplicado embedded/standalone donde aplique, sin romper el modo standalone

### Out of Scope
- Rediseñar el modo standalone (no-embedded) de `AsignacionesView.tsx` — solo se toca lo estrictamente necesario para consolidar estado, no su UX completa
- Paginación avanzada de "Mis clases" más allá de un límite razonable simple
- Unificación con la Agenda comercial (`Horarios.tsx`) — ya resuelta en `integracion-agenda-etapa-3`, no se toca de nuevo acá

## Approach

Persistencia completa primero (incluye la victoria rápida de conectar `guardarEjecucion`), después la vista de gestión de clases, después la fusión/limpieza — todo en la misma change, en fases, dado que tocan los mismos archivos.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `servicios/academico/programaRepository.ts` | Nuevo | `guardarPrograma`, `listarProgramasPorTenant` |
| `vistas/admin/AsignacionesView.tsx` | Modificado | Conectar `guardarEjecucion`, persistir programa real, leer programas al montar, fusión de flujos de publicar, limpieza de estado |
| `vistas/admin/JornadasView.tsx` o componente nuevo | Nuevo/Modificado | Vista "Mis clases" |
| `firestore.rules` | Modificado | Reglas para colección nueva de programas académicos |

## Impacto en Tests

- **Cobertura actual**: `AsignacionesView.test.tsx` (18 tests), `jornadaRepository.test.ts`, `programaService.test.ts` — todos verdes hoy, ninguno cubre persistencia de programa/ejecución real ni gestión de clases.
- **Cobertura esperada**: tests nuevos para `programaRepository.ts`, para la conexión de `guardarEjecucion`, y para la vista "Mis clases" — TDD estricto.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|--------------|
| Reglas de Firestore nuevas sin cubrir para programas académicos | Medium | Agregar y testear contra emulador real, mismo patrón que changes anteriores |
| Vista "Mis clases" con volumen grande de jornadas sin colapsar | Medium | Límite simple + mensaje si excede, sin sobre-diseñar paginación |
| Fusionar flujos de publicar rompe algo que hoy funciona (0 regresiones) | Medium | TDD estricto, correr suite completa antes/después de cada paso |
| Modo standalone no investigado a fondo | Low-Medium | Auditar sus usos antes de tocar estado compartido, en `sdd-design` |

## Rollback Plan

Aditivo en su mayoría (repositorio nuevo, campos nuevos). La fusión de flujos de publicar es lo único potencialmente destructivo — revertir = mantener ambos flujos por separado como estaban.

## Dependencies

`jornadaRepository.guardarEjecucion` (ya existe), `jornadaService.ts` (ya probado), `agendaAcademicaService.ts` (ya construido en `integracion-agenda-etapa-3`).

## Success Criteria

- [ ] Un programa creado sigue apareciendo para editar después de recargar la página
- [ ] Existe una vista donde ver todas las clases reales de un programa y gestionar su ciclo de vida
- [ ] Un solo flujo de publicar material (no dos)
- [ ] 0 regresiones en tests existentes
