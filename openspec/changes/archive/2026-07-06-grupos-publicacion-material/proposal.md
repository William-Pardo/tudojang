# Proposal: Grupos de Publicación de Material

## Intent

"Publicación en lote" fuerza un solo destinatario/momento/criterio/fechas para todo lo seleccionado, porque comparte estado top-level con "Clase activa". Los docentes necesitan publicar distintos materiales a distintos grupos/momentos en una acción. Además el título en lote ignora `tituloVisible` (fallback mal ordenado), y los tags de programa se descartan al persistir, forzando un filtro manual repetido.

## Scope

### In Scope
- Rediseñar "Publicación en lote" (`AsignacionesView.tsx`): lista de "grupos" independientes, cada uno con material/clase multi-select y destinatario/grados/momento/criterio/fechas propios, con "+ Agregar grupo" y un "Publicar todo".
- "Publicar todo" = N llamadas secuenciales a `publishAsignacionesBatch` (sin cambio de contrato), una por grupo.
- Fix de una línea en `crearServicioPublishAsignacionesBatch` (`asignaciones.js` ~165): `recurso.tituloVisible || recurso.nombre`.
- `tags?: string[]` persistido en `ProgramaAcademico`, encadenado en `createPrograma()`/`guardarPrograma()`.
- Usar esos tags para priorizar/ordenar (no filtrar duro) materiales al armar un grupo, reemplazando `filtroTagLote`.
- Puente `recursoIdsParaLote` (desde `BibliotecaView`) resuelto vía "grupo activo", default el último agregado.

### Out of Scope
- Change 3 (`gestion-clases-cancelar-reprogramar`), independiente.
- Specs Cypress más allá de lo inevitable (roto localmente, preexistente).
- Bug gemelo de `tipoDestinatario` compartido en "Clase activa" individual — design decide si se resuelve de paso o se difiere.
- Contrato Cloud Function multi-grupo (descartado en exploración).

## Approach

N llamadas cliente-secuenciales a la función batch sin modificar (salvo `tituloVisible`), reutilizando validación/dedup/commit por par ya probados. Sin atomicidad cross-grupo, como ya ocurre cross-par hoy. "Grupo activo" resuelve el punto abierto de exploración.

## Impact (tests)

`AsignacionesView.test.tsx` (1→N llamadas, + "Agregar grupo"), `asignaciones.test.js` (`tituloVisible`), `programaService.test.ts` (`tags`). Suites Jest en verde tras change 1; sin regresión esperada; `coverage_threshold` es 0.

## Affected Areas

|Area|Impact|
|---|---|
|`AsignacionesView.tsx`|Grupos independientes, `publicarLote()` reescrito|
|`asignaciones.js`|Fix `tituloVisible`|
|`programa.ts`|`tags?: string[]`|
|`programaService.ts`|thread `tags`|
|Tests arriba|Aserciones nuevas|

## Risks

|Risk|Likelihood|Mitigation|
|---|---|---|
|Sin atomicidad cross-grupo|Low|Ya así por-par; UI muestra resultado combinado|
|`tags` undefined en programas viejos|Med|Tratar como "sin señal"|
|Cypress roto localmente|High|Cobertura vía Jest/manual, disclosed|

## Rollback Plan

Revert del commit/PR. La función no cambia de contrato; rollback de cliente no requiere infraestructura. `tags` es aditivo/opcional, sin migración para revertir.

## Dependencies

- Change 1 (`centro-recursos-clasificacion-manual`), archivado — provee `tituloVisible`.

## Success Criteria

- [ ] Crear 2+ grupos con destinatarios/momentos distintos, publicar todos con un click.
- [ ] Título en lote usa `tituloVisible` cuando existe.
- [ ] Tags de programa persisten y priorizan sin ocultar el resto.
- [ ] Suites Jest afectadas en verde.
