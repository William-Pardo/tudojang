# Delta for Academico Programa

## ADDED Requirements

### Requirement: Persistencia de tags del programa

`ProgramaAcademico` MUST soportar `tags?: string[]`, persistido en Firestore vía `createPrograma()`/`guardarPrograma()`.

#### Scenario: Tags persisten tras recargar

- GIVEN un programa creado con tags
- WHEN se guarda y se recarga la página
- THEN los mismos `tags` MUST reaparecer al recuperarlo
- AND un programa previo sin `tags` MUST tratarse como "sin tags", sin error ni backfill

### Requirement: Publicación en grupos independientes

"Publicación en lote" (`AsignacionesView.tsx`) MUST permitir 2+ "grupos de publicación" independientes por sesión, cada uno con su propia selección de material/clases, destinatario, grados, momento, criterio y fechas.

#### Scenario: Agregar un segundo grupo con destinatario distinto

- GIVEN un grupo ya configurado con un destinatario
- WHEN el usuario agrega otro grupo con destinatario/momento distinto
- THEN ambos MUST coexistir sin interferirse

#### Scenario: Publicar todo dispara una llamada por grupo

- GIVEN 2 grupos con material seleccionado
- WHEN el usuario hace click en "Publicar todo"
- THEN el sistema MUST invocar `publishAsignacionesBatch` una vez por grupo, en secuencia, y mostrar un resultado combinado
- AND un fallo en un grupo MUST NOT invalidar los resultados de los grupos publicados antes

### Requirement: Priorización de materiales por tags del programa

Al listar material disponible para un grupo, el sistema SHOULD priorizar los recursos cuyos `ficha.tags` intersequen (case-insensitive, trim) con `programaSeleccionado.tags`, sin ocultar el resto.

#### Scenario: Materiales con tag coincidente aparecen primero

- GIVEN un programa con tag `"grados-superiores"` y recursos con y sin ese tag
- WHEN se arma la lista de material del grupo
- THEN los recursos con tag coincidente MUST listarse primero, y el resto MUST seguir visible y seleccionable
- AND si `programaSeleccionado.tags` es `undefined`/vacío, el sistema MUST usar el orden por defecto, sin error

## MODIFIED Requirements

### Requirement: Publicación de material unificada

El sistema MUST ofrecer un único flujo para publicar material; dentro de él, el lote MAY organizarse en grupos independientes (ver arriba), sin reintroducir un segundo formulario o punto de entrada.
(Previously: no contemplaba grupos independientes dentro del lote.)

#### Scenario: Grupos múltiples no cuentan como un segundo flujo

- GIVEN la vista mostrando 3 grupos de lote
- WHEN el usuario busca publicar material
- THEN MUST encontrar un único punto de entrada, con los grupos como subdivisión interna
