# Tasks: Grupos de Publicación de Material

## Phase 1: Foundation — tipos y contratos

- [x] 1.1 Agregar `tags?: string[]` a `ProgramaAcademico` en `models/academico/programa.ts`.
- [x] 1.2 RED: test en `servicios/academico/programaService.test.ts` — `createPrograma` con `tags` los devuelve tal cual; sin `tags` no rompe.
- [x] 1.3 GREEN: agregar `tags?: string[]` a `CrearProgramaInput` y threadearlo en el return de `createPrograma()` (`servicios/academico/programaService.ts`).
- [x] 1.4 Declarar `GrupoPublicacion` y `ResultadoGrupoPublicacion` (shape del design) dentro de `vistas/admin/AsignacionesView.tsx`.

## Phase 2: Core — fix tituloVisible y priorización por tags

- [x] 2.1 RED: extender el describe de batch en `functions/academico/asignaciones.test.js` — recurso con `tituloVisible` distinto de `nombre` usa `tituloVisible`; recurso sin `tituloVisible` usa `nombre`.
- [x] 2.2 GREEN: en `functions/academico/asignaciones.js` (~línea 165) cambiar a `titulo: asignacionBase.titulo || recurso.tituloVisible || recurso.nombre`.
- [x] 2.3 RED: test en `AsignacionesView.test.tsx` — recursos con `ficha.tags` que intersecan `programaSeleccionado.tags` (case-insensitive/trim) listan primero; el resto sigue visible/seleccionable; `tags` undefined no rompe.
- [x] 2.4 GREEN: reemplazar `filtroTagLote`/`recursosFiltradosPorTag` por un `.sort()` estable sobre `recursosDisponibles`, sin ocultar nada.

## Phase 3: Core — modelo de grupos

- [x] 3.1 RED: test — la sección de lote renderiza un `role="group"` con `aria-label="Grupo 1"` y un botón "+ Agregar grupo" (arranca con 1 grupo).
- [x] 3.2 GREEN: reemplazar `recursosLoteIds`/`jornadasLoteIds` por estado `gruposPublicacion: GrupoPublicacion[]` (seed: 1 grupo); agregar `agregarGrupo()`/`quitarGrupo()`.
- [x] 3.3 RED: test — 2 grupos con destinatario/momento distintos coexisten sin pisarse. **Labels de checkbox repiten por grupo** — escopear con `within(screen.getByRole('group', {name: /Grupo 1/i}))` y `.../Grupo 2/i` para evitar match ambiguo.
- [x] 3.4 GREEN: mover destinatario/grados/momento/criterio/fechas a campos por grupo; envolver cada grupo en `<fieldset aria-label="Grupo N">`.

## Phase 4: Integración — grupo activo y publicar todo

- [x] 4.1 RED: test — `recursoIdsParaLote` con 2 grupos existentes se une solo al último agregado (`within` por grupo: el primero no cambia).
- [x] 4.2 GREEN: agregar `grupoActivoId` (set solo en `agregarGrupo()`) + `grupoActivoIdRef`; reescribir el efecto puente de Biblioteca para mergear en `gruposPublicacion[activo]` vía el ref.
- [x] 4.3 RED: test — "Publicar todo" con 2 grupos llama `publicarAsignacionesBatchFn` 2 veces en secuencia y muestra resultado combinado.
- [x] 4.4 RED: test — falla el grupo 1 (reject/`ok:false`); el grupo 2 igual se publica y su resultado queda visible (sin rollback).
- [x] 4.5 GREEN: reescribir `publicarLote` como `publicarTodo()`: `for` secuencial, try/catch por grupo, merge incremental en `asignacionesPublicadas` + `resultadosLote: ResultadoGrupoPublicacion[]`; renombrar botón a "Publicar todo".

## Phase 5: Regresión de tests existentes

- [x] 5.1 Actualizar tests de un solo grupo (`publica en lote...`, `bloquea duplicados...`, auditoría) al botón "Publicar todo"; agregar scoping `within(getByRole('group', {name: /Grupo 1/i}))` donde el checkbox se repita entre grupos. *(Sin ambigüedad de checkboxes en los 4 tests: todos renderizan 1 solo grupo. Además se actualizaron `vistas/CentroEstudios.test.tsx` líneas 221/232/239 — también referenciaban el botón viejo "Publicar en lote" y fallaban en la regresión final.)*
- [x] 5.2 Actualizar test de `recursoIdsParaLote` para afirmar que el destino es el grupo activo (último agregado), no el primero. *(Extendido: tras agregar Grupo 2, el lote se une solo a Grupo 2 y Grupo 1 conserva su selección manual intacta.)*
- [x] 5.3 Correr `npm test -- --runInBand AsignacionesView programaService asignaciones.test` y confirmar verde. *(Jest: 2 suites / 39 tests verdes — AsignacionesView 28, programaService 11. `functions/academico/asignaciones.test.js` usa `node:test` (Jest ignora `functions/`): `node --test` → 8/8 verdes.)*

## Phase 6: Cleanup

- [x] 6.1 Eliminar `filtroTagLote`, `alternarRecursoLote`/`alternarJornadaLote` y el estado plano ya reemplazado por `gruposPublicacion`. *(Verificación: ya habían sido eliminados en Fases 2-3. Grep confirma cero identificadores muertos en código fuente — solo queda un comentario histórico en `AsignacionesView.tsx:240` y `alternarRecursoLoteSeleccionado` en `BibliotecaView.tsx`, que es una función distinta y en uso activo.)*
- [x] 6.2 Correr `npx tsc --noEmit` para confirmar sin regresiones de tipos tras el refactor de `GrupoPublicacion`. *(`vistas/admin/AsignacionesView.tsx`: 0 errores. Se corrigió con TDD el bug preexistente en `editarAsignacionPublicada` (~línea 987): leía `destinatario.estudiantes` — campo inexistente; el modelo define `estudianteIds` — vaciando los estudiantes al editar y deshabilitando "Actualizar publicación". Test nuevo: `editar una publicacion con destinatario estudiante conserva los estudianteIds`. Los ~2050 errores restantes de tsc son el clash preexistente jest-dom/chai en archivos de test, fuera de alcance.)*

## Phase 7: Correcciones de sdd-verify

- [x] 7.1 RED (WARNING 1): tests en `AsignacionesView.test.tsx` — `guardarPrograma` persiste los tags al crear el `ProgramaAcademico` real, y un programa real recargado conserva sus propios tags (no hereda los del demo). *(RED confirmado: ambos fallaron antes del fix — el create no recibía tags y el rehydrate mostraba/priorizaba con los tags del demo.)*
- [x] 7.2 GREEN (WARNING 1): threadear `tags: programaNormalizado.tags` en el input de `createPrograma` (vista) y mapear `tags: real.tags ?? []` en el rehydrate de programas reales.
- [x] 7.3 RED (WARNING 2): tests — el flujo individual pre-carga el título con `tituloVisible || nombre` y lo usa como respaldo al publicar con título vacío. *(2 tests, ambos RED antes del fix.)*
- [x] 7.4 GREEN (WARNING 2): usar `tituloVisible || nombre` en el prefill (~línea 790) y en el fallback de `publicar()` (~línea 836).
- [x] 7.5 RED (WARNING 3): test — `publicarTodo()` refleja `tituloVisible` en el listado local optimista, igual que el servidor. *(RED: el listado mostraba `nombre`.)*
- [x] 7.6 GREEN (WARNING 3): alinear el título optimista de `publicarTodo()` a `tituloVisible || nombre`.
- [x] 7.7 RED (WARNING 4): test — quitar el grupo activo reasigna el activo al último grupo restante; la selección entrante de Biblioteca no se descarta. *(RED: el checkbox del Grupo 1 quedaba sin marcar — selección descartada.)*
- [x] 7.8 GREEN (WARNING 4): `quitarGrupo` reasigna `grupoActivoId` (y su ref) cuando elimina el grupo activo.
- [x] 7.9 (WARNING 5) Cobertura AND-clause: programa sin tags ⇒ orden por defecto de materiales, sin error (vía UI con programa real recargado). *(Resultó RED antes del fix 7.2 — el programa sin tags heredaba los del demo y priorizaba mal; no era solo un gap de cobertura sino la otra cara del bug de rehydrate. GREEN tras 7.2.)*
- [x] 7.10 Regresión final: jest focalizado (AsignacionesView|programaService|CentroEstudios|BibliotecaView|bibliotecaService) + `node --test functions/academico/asignaciones.test.js` + `npm run build`. *(Jest: 9 suites / 108 tests verdes — AsignacionesView pasó de 29 a 36 tests. node --test: 8/8 verdes. `npm run build`: exit 0, solo el warning preexistente de chunk >500 kB.)*
