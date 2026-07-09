# Design: Integración Programa Académico ↔ Agenda (etapa 3)

## Technical Approach

Aditivo en dos frentes: (1) `EjecucionPrograma` gana horario recurrente opcional, y al confirmarse genera+persiste `JornadaInstruccion` reales reusando `generateJornadasFromBloque` (ya existe); (2) `Horarios.tsx` gana una fuente de datos adicional (clases académicas) sin tocar `DataContext`/`ProgramasContext`, que es puramente comercial.

**Hallazgo que reencuadra el alcance**: `Horarios.tsx` es una vista de **plantilla semanal recurrente** (7 columnas por día de la semana — Lunes...Domingo — sin fecha concreta), mientras que `JornadaInstruccion` son **ocurrencias fechadas** (pueden ser docenas por programa). No hay una correspondencia 1:1 directa — se resuelve en la Decisión 4.

## Architecture Decisions

| Decisión | Elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| Modelo de horario en `EjecucionPrograma` | Campos opcionales `bloques?: BloqueRecurrente[]` + `fechaFin?: string` en el tipo existente | Entidad nueva `HorarioPrograma` separada | Reutiliza `BloqueRecurrente` ya existente; opcional = no rompe los 5 tests actuales de `programaService.test.ts` ni `JornadasView.tsx` |
| Persistencia batch de jornadas generadas | Nueva `guardarJornadasEnLote()` en `jornadaRepository.ts`, trocea en chunks de 400 y corre `firestore.batch()` por chunk secuencialmente | Un solo `batch()` sin chunking | Firestore limita a 500 ops/batch; 400 deja margen. Mismo riesgo ya documentado (sin resolver) en `asignacion-material-por-clase` |
| Cómo `Horarios.tsx` combina las dos fuentes | Hook nuevo `useClasesAcademicas(tenantId)` que llama `listarJornadasPorTenant` + resuelve materiales por `jornadaId`, normaliza a forma compatible con `BloqueHorario` (+ `origen: 'academico'`, `materialAsignado?: string[]`) | Modificar `ProgramasContext`/`agendaCompleta` para incluir jornadas académicas | `ProgramasContext` es puramente comercial (`agregarPrograma`/`actualizarPrograma` de `Programa`) — mezclar dominios ahí complica ese contexto sin necesidad |
| Plantilla semanal vs ocurrencias fechadas | Colapsar todas las ocurrencias del mismo bloque recurrente en UNA tarjeta por día-de-semana (igual que hoy con `BloqueHorario`), mostrando el material de la PRÓXIMA ocurrencia futura | Rediseñar `Horarios.tsx` a calendario navegable por fecha | Mucho mayor esfuerzo/riesgo sobre una vista en uso real; el usuario pidió ver clase+material en la Agenda, no necesariamente un calendario fechado nuevo |

## Data Flow

```
Confirmar EjecucionPrograma (con bloques[] + fechaFin)
        │
        ▼
Por cada bloque: generateJornadasFromBloque(bloque, fechaInicio, fechaFin)
        │
        ▼
guardarJornadasEnLote() — trocea en chunks de 400, batch.commit() por chunk
        │
        ▼
Firestore: tenants/{tenantId}/jornadas/{id}  (ya existente, sin cambios de reglas)
        │
        ▼
Horarios.tsx: useClasesAcademicas(tenantId)
   ├── listarJornadasPorTenant(tenantId)
   ├── agrupa por (diaSemana, bloqueRecurrenteId) → 1 tarjeta por bloque
   └── resuelve AsignacionAcademica.jornadaId de la ocurrencia futura más próxima
        │
        ▼
agendaFiltrada = [...agendaCompleta (comercial), ...clasesAcademicas (nuevo)]
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `models/academico/programa.ts` | Modificar | `EjecucionPrograma` +`bloques?: BloqueRecurrente[]`, +`fechaFin?: string` |
| `servicios/academico/programaService.ts` | Modificar | `assignProgramaToGrupo` acepta `bloques`/`fechaFin` opcionales |
| `servicios/academico/jornadaRepository.ts` | Modificar | Nueva `guardarJornadasEnLote()` con chunking |
| `servicios/academico/jornadaService.ts` | Sin cambio | `generateJornadasFromBloque` se reutiliza tal cual |
| `servicios/academico/agendaAcademicaService.ts` | Crear | Hook/función `useClasesAcademicas` / `obtenerClasesAcademicas`: lista jornadas + resuelve material asignado, normaliza a forma tipo `BloqueHorario` |
| `vistas/Horarios.tsx` | Modificar | Concatena clases académicas a `agendaFiltrada`; sin editar/eliminar (solo lectura) |
| `servicios/academico/asignacionService.ts` | Modificar | **[agregado post-apply]** Nueva `listarAsignacionesPorTenant` — la lectura de asignaciones era 100% demo, se necesitaba real para resolver material en la Agenda |
| `vistas/admin/AsignacionesView.tsx` | Modificar | **[agregado post-apply, el cambio más grande del change]** `guardarPrograma()` conecta de punta a punta con `programaService` real (Opción B, ver sección Desviaciones); `asegurarJornadaPrograma`/`asegurarJornadaParaPreview` simplificadas a solo-seleccionar-nunca-crear |

## Interfaces / Contracts

```typescript
interface ClaseAcademicaAgenda {
  id: string;
  origen: 'academico';
  dia: string;               // día de semana, derivado de diaSemana del bloque
  horaInicio: string;
  horaFin: string;
  sedeId: string;
  instructorId: string;
  grupo: string;
  nombrePrograma: string;
  proximaFecha: string;              // fecha concreta de la próxima ocurrencia
  materialAsignado: string[];        // títulos de AsignacionAcademica de esa ocurrencia
}
```

## Testing Strategy

| Capa | Qué testear | Enfoque |
|---|---|---|
| Unit | `guardarJornadasEnLote`: chunking correcto en lotes >400 | Nuevo test en `jornadaRepository.test.ts` |
| Unit | `assignProgramaToGrupo` con `bloques`/`fechaFin`: genera N jornadas correctas | Extender `programaService.test.ts`, los 5 tests existentes no deben romperse |
| Unit | `agendaAcademicaService`: agrupación por bloque + resolución de material de la ocurrencia próxima | Nuevo test |
| Componente | `Horarios.tsx`: clases académicas conviven con `BloqueHorario` sin ocultarse | Nuevo test — hoy `Horarios.tsx` no tiene ninguno |

## Migration / Rollout

Sin migración de datos — `bloques`/`fechaFin` son opcionales, las `EjecucionPrograma` existentes siguen funcionando sin ellos. Deploy backend-first (modelo + generación + persistencia), después `Horarios.tsx`.

## Desviaciones descubiertas durante `sdd-apply`

**[Fase 5, checkpoint con el usuario]** El diseño original asumía que "ajustar `AsignacionesView.tsx`" era acotado (leer jornadas reales en vez del preview fake). Se descubrió que el "programa" de esa vista estaba 100% desconectado de `programaService.ts` — el usuario eligió conectar todo de punta a punta (Opción B): `guardarPrograma()` ahora llama `createPrograma`+`publishPrograma` (sintetizando una `UnidadTematica` desde `tema`/`objetivoClase`, ya que el modal no captura curriculum real) + `assignProgramaToGrupo` + `generarJornadasDeEjecucion` + `guardarJornadasEnLote`. Esto además obligó a agregar `listarAsignacionesPorTenant` a `asignacionService.ts` (no estaba en el plan — la lectura de asignaciones era 100% demo hasta ahora) para poder resolver material real en la Agenda.

**Efecto secundario real detectado**: el test preexistente "bloquea duplicados..." (ya borderline desde el change anterior, 2946-4823ms) empezó a fallar con más frecuencia (4510-5861ms) tras el wiring de Fase 5 — evidencia de que el `useEffect` nuevo de `jornadasProgramaActivas` agrega costo de render real. Se le subió el timeout a 15000ms como mitigación mínima.

## Open Questions

- [ ] Verificar si `firestore.rules` ya cubre lecturas de `tenants/{tenantId}/jornadas` para el rol que usa `Horarios.tsx` (probablemente sí, ya que `jornadas` ya permite `read: if authenticated() && currentTenantId() == tenantId` — confirmar en `sdd-apply`, no bloquea el diseño).
- [ ] Si una ocurrencia futura no existe (programa ya terminado), ¿la tarjeta desaparece de la Agenda o se mantiene mostrando la última pasada? Definir en `sdd-apply` si surge, no es una decisión de arquitectura.
