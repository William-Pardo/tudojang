# Proposal: Integración Programa Académico ↔ Agenda (etapa 3)

## Intent

Hoy no existe conexión entre `ProgramaAcademico` y ninguna agenda real de clases — `EjecucionPrograma` no tiene horario ni fecha de fin. El usuario espera que al confirmar un programa, sus clases se generen automáticamente y aparezcan en **la Agenda real** (`vistas/Horarios.tsx`, la que el staff usa hoy), mostrando grupo, maestro, sede, programa, material asignado, día y hora.

## Scope

### In Scope
- `EjecucionPrograma` gana `bloques: BloqueRecurrente[]` + `fechaFin`
- `assignProgramaToGrupo` (o función nueva) acepta el horario recurrente y fecha de fin
- Al confirmar la asignación, generar `JornadaInstruccion` reales por bloque vía `generateJornadasFromBloque` (ya existe) y persistirlas en lote vía `jornadaRepository`
- `Horarios.tsx` lee también `JornadaInstruccion` (vía `listarJornadasPorTenant`) y las muestra junto a los `BloqueHorario` comerciales existentes
- La Agenda resuelve y muestra el material asignado por clase usando `AsignacionAcademica.jornadaId` (ya construido en `asignacion-material-por-clase`)

### Out of Scope
- Unificar/migrar `BloqueHorario`↔`BloqueRecurrente` o `Programa`↔`ProgramaAcademico` (Approach 1b, descartado para esta etapa)
- Edición de horario ya generado o reprogramación en bloque
- Resolver el límite de 500 operaciones de `firestore.batch()` para programas muy largos (riesgo documentado, no resuelto — mismo pendiente del change anterior)

## Approach

Approach 1a de `exploration.md`: integración aditiva. La Agenda comercial no se toca en su lógica de facturación/operación — solo gana una fuente de datos adicional de solo lectura.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `models/academico/programa.ts` | Modified | `EjecucionPrograma` +`bloques`, +`fechaFin` |
| `servicios/academico/programaService.ts` | Modified | `assignProgramaToGrupo` acepta horario+fechaFin |
| `servicios/academico/jornadaService.ts` | Sin cambio | `generateJornadasFromBloque` se reutiliza tal cual |
| `servicios/academico/jornadaRepository.ts` | Modified | guardado en lote de jornadas generadas |
| `vistas/Horarios.tsx` | Modified | lee y muestra `JornadaInstruccion` junto a `BloqueHorario` |

## Impacto en Tests

- **Cobertura actual**: `servicios/academico/programaService.test.ts` existe y cubre `assignProgramaToGrupo`/`advanceCiclo` — hay que extenderlo. `vistas/Horarios.tsx` **no tiene ningún test hoy** — se crea desde cero.
- **Cobertura esperada**: tests nuevos para generación+persistencia batch de jornadas al confirmar programa, y para el render de clases académicas en `Horarios.tsx` — TDD estricto (RED→GREEN→REFACTOR).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|--------------|
| Agregar `bloques`/`fechaFin` rompe consumidores existentes (`advanceCiclo`, `JornadasView.tsx`) | Medium | Auditar usos antes de escribir; campos aditivos/opcionales |
| Batch de jornadas al confirmar un programa largo se acerca al límite de 500 ops | Low-Medium | Trocear en múltiples batches si el volumen lo requiere |
| Modelar mal "un horario con varios días" (un `BloqueRecurrente` = un día de semana) | Medium | Definir explícitamente `bloques: BloqueRecurrente[]`, uno por día |
| `Horarios.tsx` es la Agenda comercial en uso real (factura/opera) | Medium | Cambio aditivo de solo lectura, sin tocar lógica de facturación existente |

## Rollback Plan

Aditivo en su totalidad: revertir = dejar de leer `JornadaInstruccion` en `Horarios.tsx` y quitar `bloques`/`fechaFin` de `EjecucionPrograma` (opcionales, sin migración destructiva — documentos existentes sin esos campos siguen funcionando).

## Dependencies

`listarJornadasPorTenant` y `AsignacionAcademica.jornadaId`, ambos construidos en `asignacion-material-por-clase` (prerrequisito ya completo).

## Success Criteria

- [ ] Confirmar un programa con horario genera `JornadaInstruccion` reales persistidas para todo el período
- [ ] `Horarios.tsx` muestra esas clases junto a las comerciales: grupo, maestro, sede, programa, material asignado, día, hora
- [ ] El `BloqueHorario`/`Programa` comercial existente sigue funcionando sin cambios
