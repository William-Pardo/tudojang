## Exploration: Asignación de materiales a clases (Camino A)

### Current State

El flujo conceptual de Centro de Estudios es: conectar Drive → cargar archivos → taggear como `RecursoAcademico` (material) → armar `ProgramaAcademico` con `JornadaInstruccion` (clases, con agenda/sede/instructor) → asignar materiales de la biblioteca a cada clase. El último paso (asignación material→clase) es el punto de fricción reportado.

Modelo de datos actual:
- **`RecursoAcademico`** (`models/academico/recurso.ts:77`): el material. Vive en `tenants/{tenantId}/recursos/{id}`. Campos clave: `externalFileId` (FK real a Drive), `ficha: FichaAcademica | null` con `tags?: string[]` — tags libres, sin entidad propia, matcheados case-insensitive contra una lista hardcoded `TAGS_ACADEMICOS_ESTANDAR` en `vistas/admin/AsignacionesView.tsx:127`.
- **`ProgramaAcademico`** (`models/academico/programa.ts:17`): `unidades: UnidadTematica[]`, sin link directo a jornadas. `EjecucionPrograma` (línea 29) trackea `unidadActualId` de progreso, tampoco referencia jornadas.
- **`JornadaInstruccion`** (`models/academico/jornada.ts:3`): la "clase" real, con state machine de 10 estados (`servicios/academico/jornadaService.ts:35-46`), `programaId`, `ejecucionProgramaId`, `grupoId`, `sedeId`, `instructorId`, `fecha/horaInicio/horaFin`.
- **`AsignacionAcademica`** (`models/academico/asignacion.ts:37`): el vínculo material→destino. **No tiene `jornadaId` como campo de primera clase** — su `destinatario` apunta a `grupo`/`grado`/`estudiante`. El vínculo a jornada existe solo como parámetro fuera de banda en `PublicarAsignacionRequest` (`models/academico/asignacionService.types.ts:26-30`) y se agrega ad hoc en la UI como `AsignacionPublicadaLocal.jornadaId` (`vistas/admin/AsignacionesView.tsx:206-210`).

Servicios:
- `bibliotecaService.ts`: ciclo Drive→recurso (import→ficha→approve→archive), un archivo a la vez, sin clasificación bulk.
- `asignacionService.ts` (`publishAsignacion`/`publicarAsignacion`): publica **un recurso a un destinatario/jornada por llamada**. No hay endpoint batch.
- `jornadaService.ts`: state machine limpia por jornada individual; genera jornadas de programa vía `generateJornadasFromBloque`.

UI (`vistas/admin/AsignacionesView.tsx`, embebida en `CentroEstudios.tsx:166-170`, 2038 líneas):
- **Reimplementa un modelo paralelo de jornadas** (`ProgramaAcademicoAsignacion`, línea 188) con IDs de preview falsos (`jornada-{programaId}-{fecha}-{hora}`), en vez de usar `JornadaInstruccion` real. Solo UNA jornada real se persiste como "jornada de referencia" (`asegurarJornadaPrograma`, línea 821).
- Flujo: elegir UN recurso (`abrirModalRecurso`, línea 803) → llenar formulario (destinatario, grupo/grados como texto separado por comas, fechas) → `publicar()` (línea 631) publica **una asignación por click**, atada a la jornada de referencia — no itera sobre las clases generadas.
- Hay un carrusel de preview de jornadas (`jornadasProgramaActivas`/`jornadaActivaIndex`, líneas 460-466), tope de 5 items visibles (máx. 60 generadas, línea 286), pero publicar NO aplica en bloque sobre la selección.

Backlog propio ya documentado en `Plan_de_Implementación_Refactor_Modal_Programa_Académico_y_Publicar_Material.md:279` ("Publicar material debe operar clase por clase"), con dos ítems explícitamente sin marcar:
- **D7** (línea 547/575): filtrar materiales por match de tags — no implementado.
- **D8** (línea 548/576): asignar uno o varios materiales a la jornada activa — no implementado; hoy es un recurso por acción.

### Affected Areas

- `models/academico/asignacion.ts` — agregar `jornadaId`/`jornadaIds[]` como campo real de `AsignacionAcademica`.
- `models/academico/asignacionService.types.ts` — revisar `PublicarAsignacionRequest` para soportar múltiples recursos y múltiples jornadas en una sola request.
- `servicios/academico/asignacionService.ts` — nuevo endpoint/variante batch para publicar N recursos × M jornadas en una operación (o iteración controlada con resultado agregado).
- `vistas/admin/AsignacionesView.tsx` — eliminar el modelo paralelo `ProgramaAcademicoAsignacion` y `generarJornadasLocalesPrograma`; consumir `JornadaInstruccion` real vía `jornadaService.ts`. Rediseñar el flujo de publicación a multi-select (materiales × clases) con filtro por tag (D7).
- `servicios/academico/jornadaService.ts` — posiblemente exponer una función de listado/consulta de jornadas reales de un programa que hoy no se usa desde la vista de asignación (se usa el modelo paralelo en su lugar).
- `firestore.rules` / `firestore.indexes.json` — validar reglas de seguridad para el nuevo campo `jornadaId`/`jornadaIds` en `AsignacionAcademica` y para queries de jornadas por programa desde la vista de asignación.
- Tests: `functions/test/firestore-rules.security.test.js`, `functions/test/firestore-rules.behavior.test.js`, `servicios/academico/asignacionService.test.ts` (no listado en el diff actual pero es donde correspondería agregar cobertura), `vistas/CentroEstudios.test.tsx`.

### Approaches

1. **Migración incremental con campo dual-write** — agregar `jornadaId`/`jornadaIds[]` a `AsignacionAcademica` manteniendo `destinatario` como está, sin tocar semántica de grupo/grado/estudiante. La vista deja de generar jornadas fake y consulta `JornadaInstruccion` real. El publish pasa a aceptar arrays y itera server-side (Cloud Function) o client-side con Promise.all controlado.
   - Pros: no rompe la semántica actual de `destinatario` (grupo/grado/estudiante) que otras partes del sistema puedan usar; cambio acotado al módulo de asignación.
   - Cons: sigue habiendo dos "formas" de apuntar un destinatario (destinatario lógico vs. jornada física) conviviendo en el mismo modelo — hay que documentar bien cuándo se usa cada una.
   - Effort: Medium.

2. **Reemplazo de destinatario por jornada como target primario** — redefinir que toda `AsignacionAcademica` relevante a Centro de Estudios apunte primero a `jornadaId(s)`, derivando grupo/sede/instructor desde la jornada en vez de pedirlos sueltos en el formulario.
   - Pros: modelo más limpio conceptualmente, elimina inputs redundantes (grupo/grados como texto libre hoy).
   - Cons: cambio de mayor alcance — puede afectar otros consumidores de `AsignacionAcademica` que no pasan por jornada (asignaciones a estudiante individual fuera de una clase, si existen). Requiere auditar todos los usos actuales del campo `destinatario` antes de tocarlo.
   - Effort: High.

### Recommendation

Approach 1 (migración incremental con campo dual-write). Resuelve el dolor concreto (D7 + D8) sin arriesgar romper otros flujos que ya dependen de `destinatario` como está modelado hoy, y es la base mínima necesaria antes de evaluar Camino B (herencia por unidad temática) más adelante — decisión ya registrada en Engram (`tudojang/centro-estudios/asignacion-material-clase`), Camino B queda explícitamente fuera de alcance de este change.

### Risks

- Auditar TODOS los usos actuales de `AsignacionAcademica.destinatario` antes de agregar `jornadaId` — si algún flujo ya asume que jornada y destinatario son mutuamente excluyentes o los infiere de otra forma, el dual-write puede introducir ambigüedad.
- El carrusel de jornadas (`jornadaActivaIndex`, tope 5 de 60 generadas) necesita rediseño de UI para multi-select — no es un cambio cosmético, cambia el patrón de interacción (de "una jornada activa" a "selección múltiple").
- Firestore rules: cualquier campo nuevo en `AsignacionAcademica` requiere reglas de seguridad explícitas y tests (`firestore-rules.security.test.js`) — el proyecto tiene TDD estricto (`strict_tdd: true` en `openspec/config.yaml`), no se puede saltar esta cobertura.
- Reimplementar la generación de jornadas en la vista para usar `JornadaInstruccion` real puede exponer performance/paginación no contemplada hoy (el modelo fake soporta hasta 60 preview items; las jornadas reales persistidas podrían tener otra forma de paginación/query).

### Ready for Proposal

Sí. El alcance está acotado (Camino A únicamente), el enfoque recomendado está identificado, y las áreas afectadas están mapeadas con evidencia concreta de código. Recomiendo continuar con `sdd-propose` para formalizar el rollback plan y el impacto de tests antes de pasar a specs/design.
