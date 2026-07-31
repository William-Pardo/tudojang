# Catálogo de Soporte Antideriva Specification

## Purpose

Evitar que una vista enrutada nazca, se mueva o pierda su archivo sin que el catálogo de soporte lo refleje, convirtiendo la deriva silenciosa (10 funciones sin entrada, un archivo huérfano, `/jornadas` sin cobertura) en un fallo de pipeline verificable antes del deploy.

## Requirements

### Requirement: Contrato del marcador co-locado `soporteMeta`

El archivo fuente de una vista enrutada SHALL poder declarar un export nombrado `soporteMeta`, con una o más entradas que satisfacen íntegramente el contrato `EntradaCatalogoSoporte` de `shared/soporte/tipos.ts` (id, inventoryId, module, label, intent, aliases, actions, negativeTerms, roles, steps, route, sensitivity, escalationReason, sourceFiles, authorizationRef, owner, introducedIn, lastVerifiedAt, status). El tipo usado para anotar `soporteMeta` MUST derivar de `EntradaCatalogoSoporte` de modo que el compilador rechace un rol, una sensibilidad, un `status` o cualquier otro campo inexistente o mal tipado.

Aclaración: la entrada **emitida** en el catálogo fusionado satisface el contrato `EntradaCatalogoSoporte` completo, incluido `introducedIn`; el TIPO usado para anotar `soporteMeta` en el código fuente es `MarcadorSoporte = Omit<EntradaCatalogoSoporte, 'introducedIn'>` (design.md D2), porque ese campo lo estampa el generador desde `catalog.catalogVersion` al fusionar, no la vista.

#### Scenario: Marcador válido compila

- GIVEN una vista con `export const soporteMeta` anotado con un tipo derivado de `EntradaCatalogoSoporte`
- WHEN se ejecuta `npx tsc --noEmit`
- THEN la compilación MUST pasar sin errores para ese archivo

#### Scenario: Rol inexistente rompe la compilación

- GIVEN un `soporteMeta` que declara un rol fuera de `RolSoporte` (ej. `"Coordinador"`)
- WHEN se ejecuta `npx tsc --noEmit`
- THEN la compilación MUST fallar señalando el campo `roles`

#### Scenario: Campo obligatorio faltante rompe la compilación

- GIVEN un `soporteMeta` al que le falta un campo obligatorio de `EntradaCatalogoSoporte` (ej. `escalationReason`)
- WHEN se ejecuta `npx tsc --noEmit`
- THEN la compilación MUST fallar

### Requirement: Descubrimiento y fusión de marcadores en `generar-catalogo.mjs`

El generador SHALL escanear el árbol de fuentes bajo `vistas/` y `components/` en busca de exports `soporteMeta`, leyéndolos por AST de TypeScript (la misma infraestructura `ts` que ya usa el script) sin importar ni ejecutar el módulo de la vista. El generador MUST fusionar las entradas descubiertas con el núcleo manual de `catalogo.v1.ts` en un único catálogo antes de emitir `catalogo.v1.json` y su `.sha256`, sin alterar el esquema de salida existente.

#### Scenario: Fusión exitosa

- GIVEN un núcleo manual con N entradas y dos vistas con `soporteMeta` válido y con `id` únicos entre sí
- WHEN se ejecuta el generador
- THEN el catálogo emitido MUST contener N más las entradas de los marcadores, y el JSON/checksum MUST mantener el mismo esquema previo a la fusión

#### Scenario: Lectura por AST, sin ejecución

- GIVEN una vista cuyo `soporteMeta` vive en un módulo con JSX o dependencias de navegador
- WHEN el generador escanea ese archivo
- THEN el generador MUST leer el export solo por AST y MUST NOT importar ni ejecutar el módulo

#### Scenario: Id duplicado entre marcador y entrada manual

- GIVEN una entrada manual en `catalogo.v1.ts` con `id: "X"` y un `soporteMeta` en otra vista que también declara `id: "X"`
- WHEN se ejecuta el generador
- THEN el generador MUST fallar de forma dura, con un mensaje que incluya el archivo y el `id` en conflicto

#### Scenario: Id duplicado entre dos marcadores

- GIVEN dos vistas distintas cuyos `soporteMeta` declaran el mismo `id`
- WHEN se ejecuta el generador
- THEN el generador MUST fallar de forma dura, con un mensaje que incluya ambos archivos y el `id` en conflicto

### Requirement: Gate de rutas en CI — línea base congelada, por archivo enrutado

El job `pruebas` SHALL ejecutar un check que compare, por cada componente que `App.tsx` monta efectivamente en una `<ReactRouterDOM.Route path=... element=...>` literal (excluyendo comodines `*`), su cobertura en el catálogo fusionado — unidad "archivo enrutado", no "ruta". Se declara una lista congelada y explícita de archivos ya cubiertos por entrada manual ("línea base de deuda"; ≈27 archivos, 55 entradas — conteo exacto lo fija `sdd-tasks` del change de seguimiento). El check MUST exigir marcador o entrada de catálogo solo para archivos fuera de esa lista. La lista SHALL poder únicamente achicarse: agregar un archivo nuevo a la lista en lugar de cubrirlo MUST hacer fallar el check.

#### Scenario: Archivo enrutado sin cobertura

- GIVEN un componente que `App.tsx` monta en una `<Route>`, fuera de la lista de deuda congelada y sin entrada ni marcador en el catálogo
- WHEN corre el check de rutas
- THEN el check MUST fallar con un mensaje que nombre la ruta y el archivo

#### Scenario: Marcador con ruta no enrutada

- GIVEN un `soporteMeta` cuyo campo `route` no corresponde a ninguna `<Route path=...>` real de `App.tsx`
- WHEN corre el check de rutas
- THEN el check MUST fallar señalando la ruta declarada y el archivo del marcador

#### Scenario: Cobertura sin ningún rol activo

- GIVEN un archivo enrutado cuya(s) entrada(s) en el catálogo tienen `roles` en los que ninguno tiene `status: 'active'` en `ROLES_SOPORTE`
- WHEN corre el check de rutas
- THEN el check MUST fallar, aun cuando el archivo tenga cobertura nominal

#### Scenario: Archivo en deuda, no tocado en el diff

- GIVEN un archivo en la lista de deuda congelada que no aparece en el diff del PR
- WHEN corre el check de rutas
- THEN el check MUST pasar sin emitir ningún aviso

#### Scenario: Archivo en deuda, tocado en el diff

- GIVEN un archivo en la lista de deuda congelada que sí aparece modificado en el diff del PR
- WHEN corre el check de rutas
- THEN el check MUST pasar (no bloquea) Y SHALL emitir un aviso visible no bloqueante indicando que ese archivo está en deuda del catálogo de soporte

#### Scenario: Intento de crecer la lista de deuda

- GIVEN un cambio que agrega un archivo/ruta nuevo a la lista congelada de deuda en lugar de cubrirlo con marcador o entrada manual
- WHEN corre el check de rutas
- THEN el check MUST fallar, rechazando el crecimiento de la lista

### Requirement: Verificación de artefactos comiteados (`--check` sobre la raíz)

El job `pruebas` SHALL ejecutar `node scripts/generar-catalogo.mjs --check` contra la raíz real del repositorio (no un directorio temporal), comparando `public/generated/soporte/catalogo.v1.json` y `functions/generated/soporte/catalogo.v1.json` (y sus `.sha256`) contra lo que generaría la fuente actual (núcleo manual + marcadores fusionados).

#### Scenario: Artefactos sincronizados

- GIVEN que los JSON comiteados coinciden con lo que generaría la fuente actual
- WHEN corre `--check` sobre la raíz
- THEN el check MUST pasar

#### Scenario: Drift detectado

- GIVEN que la fuente cambió (núcleo manual o un marcador) pero los JSON comiteados no se regeneraron
- WHEN corre `--check` sobre la raíz
- THEN el check MUST fallar, identificando el artefacto desincronizado

### Requirement: Condición de cierre — migración de deuda planificada

Antes de archivar este change (`catalogo-soporte-marcadores-vivos`), MUST existir `openspec/changes/catalogo-soporte-migracion-deuda/proposal.md` y `openspec/changes/catalogo-soporte-migracion-deuda/tasks.md`, con TODOS los archivos restantes de la lista de deuda congelada (`shared/soporte/deuda-catalogo.json`) listados explícitamente, uno por uno, como checklist verificable.

#### Scenario: Cierre bloqueado sin change de seguimiento

- GIVEN que `proposal.md` o `tasks.md` de `catalogo-soporte-migracion-deuda` no existen, o `tasks.md` no lista todos los archivos de la línea base de deuda
- WHEN se intenta archivar `catalogo-soporte-marcadores-vivos`
- THEN el archivado MUST bloquearse

#### Scenario: Cierre habilitado

- GIVEN que ambos archivos existen y `tasks.md` lista explícitamente todos los archivos pendientes de la línea base de deuda
- WHEN se intenta archivar `catalogo-soporte-marcadores-vivos`
- THEN el archivado MAY proceder, sujeto a los demás criterios de `sdd-verify`

## Open Questions (not resolved by the proposal)

- **Forma exacta de `soporteMeta` (única entrada vs. arreglo).** La propuesta dice "el mismo contrato `EntradaCatalogoSoporte`" pero `AgendaView.tsx` necesita 3 entradas y 2 rutas en un solo archivo. Esta spec exige "una o más entradas" sin fijar si el tipo TS es `EntradaCatalogoSoporte`, `EntradaCatalogoSoporte[]`, o una unión de ambos — se deja como decisión de `sdd-design`.
