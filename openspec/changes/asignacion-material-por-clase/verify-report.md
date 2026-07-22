# Verification Report

**Change**: asignacion-material-por-clase
**Version**: N/A

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 33 |
| Tasks complete | 32 |
| Tasks incomplete | 1 |

- **5.5** aparece `[ ]` sin marcar en `tasks.md`, pero el trabajo real SÍ se hizo — verificado leyendo `Plan_de_Implementación_Refactor_Modal_Programa_Académico_y_Publicar_Material.md:547-548`, D7 y D8 están marcados `[x]` con referencia a este change. Es un desface de tracking (checkbox olvidado), no trabajo pendiente real.

---

## Build & Tests Execution

**Build**: ✅ Passed — `npm run build` completó en 1m51s. Solo warnings preexistentes (chunk size >500kB, "use client" de framer-motion/react-router ignorado, dynamic+static import mixto) — ninguno nuevo ni relacionado a este change.

**Tests** (`npm test -- --runInBand`, comando configurado en `rules.verify.test_command`):
```
Test Suites: 7 failed, 101 passed, 108 total
Tests:       26 failed, 3 skipped, 824 passed, 853 total
```

Desglose de las 7 suites en rojo:
- 6 suites (25 tests) — **sin relación de código con este change** (confirmado por grep de imports: `App.routing.test.ts`, `components/FilaEstudiante.test.tsx`, `components/ModalImportacionMasiva.test.tsx`, `components/ModalRegistrarPago.test.tsx`, `components/academico/ProgresoResumenCard.test.tsx`, `servicios/pagosApi.complementaria.test.ts`). Preexistentes del working tree del usuario.
- 1 suite (1 test) — **`vistas/admin/AsignacionesView.test.tsx` › "bloquea duplicados, permite editar asignacion y muestra listado final con filtros"**, timeout de 5000ms excedido corriendo dentro de la suite completa (367s, 108 suites). Investigado en detalle — ver Issues.

**Coverage**: No configurado (`coverage_threshold: 0` en `openspec/config.yaml`).

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Vínculo real asignación-clase | Publicar asignación con clase real | `functions/academico/asignaciones.test.js > publishAsignacion crea asignacion con tenant y maestro validos` + batch equivalent | ✅ COMPLIANT |
| Vínculo real asignación-clase | Compatibilidad con asignaciones legacy | (ninguno) | ❌ UNTESTED |
| Publicación batch multi-material x multi-clase | Publicación en bloque | `asignaciones.test.js > publishAsignacionesBatch crea una asignacion por cada combinacion recurso x jornada` | ✅ COMPLIANT |
| Publicación batch multi-material x multi-clase | Duplicado parcial en el batch | `asignaciones.test.js > publishAsignacionesBatch saltea combinaciones duplicadas sin abortar el resto` | ✅ COMPLIANT |
| Filtro de materiales por tag | Filtrar por tag existente | `AsignacionesView.test.tsx > filtra materiales por tag en la seccion de publicacion en lote` | ✅ COMPLIANT |
| Filtro de materiales por tag | Tag sin coincidencias | (mismo test, no asserta el mensaje de estado vacío explícito) | ⚠️ PARTIAL |
| Uso de jornadas reales | Clases mostradas coinciden con las persistidas | (ninguno — y el código NO implementa esto, ver Issues) | ❌ FAILING |
| Uso de jornadas reales | Programa con más de 60 jornadas | (ninguno — límite de 60 sigue intacto) | ❌ UNTESTED |
| Seguridad de Firestore para jornadaId | Aislamiento entre tenants | `firestore-rules.behavior.test.js > instructor from another tenant cannot read or write an academic assignment with jornadaId` (emulador real) | ✅ COMPLIANT |
| Seguridad de Firestore para jornadaId | Rol sin permiso de publicación | (ninguno) | ❌ UNTESTED |

**Compliance summary**: 4/10 COMPLIANT, 1/10 PARTIAL, 4/10 UNTESTED, 1/10 FAILING

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Vínculo real asignación-clase | ✅ Implementado | `jornadaId?: string` en `AsignacionAcademica`, escrito por ambos callables |
| Publicación batch | ✅ Implementado | `publishAsignacionesBatch` + `publicarAsignacionesBatch` + UI |
| Filtro por tag | ✅ Implementado | `recursosFiltradosPorTag` |
| Uso de jornadas reales | ❌ No implementado tal como lo describe el spec | Decisión Opción B (aprobada por el usuario): el preview sigue siendo client-side, no se lee `JornadaInstruccion` real al mostrar la lista — se persiste recién al publicar. **El spec.md nunca se actualizó para reflejar esta desviación** |
| Seguridad Firestore | ✅ Implementado (sin cambios de reglas, confirmado por evidencia real) | |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| `jornadaId` singular por doc (no array) | ✅ Sí | |
| Batch resuelto server-side en un callable | ✅ Sí | |
| Reusar `crearClavePublicacionAsignacion` para dedup en batch | ⚠️ Desvió | `publicarLote()` no lo usa — el dedup real ocurre server-side por ID determinístico de documento. Funcionalmente correcto, pero el design.md decía explícitamente que se reutilizaría esa función |
| Retirar `ProgramaAcademicoAsignacion`/`generarJornadasLocalesPrograma` | ⚠️ Desvió (aprobado) | Opción B, checkpoint explícito con el usuario vía AskUserQuestion durante sdd-apply |
| Tabla de "File Changes" del design.md | ⚠️ Incompleta | No listaba `servicios/academico/jornadaRepository.ts` (modificado en Fase 4 para `listarJornadasPorTenant`) ni los archivos de test correspondientes |

---

## Issues Found

**CRITICAL** (must fix before archive):
1. **`spec.md` está desactualizado respecto a la implementación aprobada.** El requirement "Uso de jornadas reales" y sus 2 escenarios describen un comportamiento (leer `JornadaInstruccion` persistidas, paginar más de 60) que la Opción B — aprobada explícitamente por el usuario durante sdd-apply — decidió NO implementar. El spec nunca se corrigió con una delta reflejando esa decisión. Esto deja el artefacto de spec mintiendo sobre el comportamiento real. Recomendación: correr `sdd-spec` de nuevo para esta change con una delta MODIFIED que reemplace ese requirement por el comportamiento real acordado (preview client-side + persistencia diferida al publicar), antes de archivar.
2. **`tasks.md` tarea 5.5 sin marcar** aunque el trabajo está hecho — checkbox debe corregirse antes de archivar para que el registro sea preciso.

**WARNING** (should fix):
1. **Test flaky/borderline detectado**: `AsignacionesView.test.tsx > "bloquea duplicados..."` tardó 2946ms / 4199ms / 4823ms en tres corridas aisladas distintas, y superó el timeout de 5000ms una vez corriendo dentro de la suite completa (108 suites, 367s). Es un test ya al límite antes de este change (4823ms ya observado en Fase 4), pero la sección nueva "Publicación en lote" se renderiza en cada render del componente (incluyendo re-renders de esta prueba), agregando costo de render no nulo. No pude probar causalidad determinística, pero es un riesgo real de flakiness que vale la pena investigar (subir el timeout del test puntual, o perfilar el render).
2. **3 escenarios de spec sin ningún test** (compatibilidad legacy sin `jornadaId`, rol sin permiso de publicación en la colección `asignaciones`, tag sin coincidencias como estado explícito) — funcionalmente casi seguro que ya funcionan (por diseño del código/reglas compartidas), pero no hay prueba que lo demuestre.
3. Límite de `firestore.batch()` de 500 operaciones (open question de `design.md`, nunca resuelta) — no hay chunking ni test para el caso de un batch que lo exceda.
4. Tabla de "File Changes" de `design.md` no reflejaba `jornadaRepository.ts` — menor, pero vale actualizar para que el design quede fiel a lo implementado.

**SUGGESTION** (nice to have):
1. Considerar deprecar/documentar por qué `publicarLote()` no reusa `crearClavePublicacionAsignacion`, para que quien lea el código no piense que es un olvido.

---

## Verdict

**PASS WITH WARNINGS**

La funcionalidad central (batch multi-material×multi-clase + filtro por tag + seguridad) está implementada y probada con evidencia real de ejecución (tests unitarios + reglas contra emulador real + build exitoso). El hallazgo más serio no es de código sino de **documentación desincronizada**: el spec.md describe un requirement ("jornadas reales", con paginación de +60) que la Opción B decidió explícitamente no cumplir — eso necesita una delta de spec formal antes de dar el change por cerrado, para que el rastro de decisiones quede honesto.
