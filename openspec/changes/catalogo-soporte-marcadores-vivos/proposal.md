# Proposal: Marcadores vivos del catálogo de soporte

## Intent

Hoy `shared/soporte/catalogo.v1.ts` es un archivo que describe **otros** archivos sin ninguna conexión estructural con ellos. Nada obliga a que una vista nueva nazca con su entrada de soporte, ni a que un cambio de archivo o de ruta se refleje en el catálogo. La deriva solo se nota cuando un usuario real recibe una respuesta vacía o equivocada en producción.

Por qué ahora: el 2026-07-30, depurando en producción, se encontraron a mano 10 funciones reales sin ninguna entrada, dos entradas apuntando a `vistas/Horarios.tsx` (archivo huérfano, el componente real es `vistas/admin/AgendaView.tsx`) y cuatro defectos en el modelo de roles — entre ellos `Estudiante` marcado como `reserved`, lo que hacía que `servicios/soporte/matcher.ts:82` descartara **todo** el catálogo local para cualquier estudiante, siempre. Eso ya se corrigió y se liberó; esta propuesta no lo repite: evita que vuelva a pasar.

La deriva no está cerrada. Al escribir esta propuesta se detectó un caso vivo: `App.tsx` enruta 31 rutas distintas (excluyendo los comodines `*`) y `RUTAS_SOPORTE_CONOCIDAS` declara 30. La faltante es `/jornadas` → `vistas/admin/JornadasView.tsx` (Admin y Editor), sin entrada, sin ruta declarada y sin aparecer en ningún `sourceFiles`. Es exactamente el defecto número 11 de la misma familia, y nadie lo vio hasta que se contaron las rutas a mano.

Éxito: que agregar una pantalla enrutada sin cobertura de soporte, o mover el archivo de una pantalla ya cubierta, **rompa el pipeline** en lugar de romper una conversación con un usuario.

## Scope

### In Scope

- Marcador co-locado y tipado: `export const soporteMeta` en el archivo de la vista, con el mismo contrato `EntradaCatalogoSoporte` de `shared/soporte/tipos.ts`, de modo que TypeScript rechace en compilación un rol, una sensibilidad o un campo inexistente.
- Extender `scripts/generar-catalogo.mjs` para escanear el árbol de fuentes en busca de exports `soporteMeta`, fusionarlos con el núcleo manual de `catalogo.v1.ts` y emitir el JSON y el checksum ya existentes sin cambiar su formato de salida.
- Check bloqueante que recorra las rutas reales declaradas en `App.tsx` (`<ReactRouterDOM.Route path=... element=...>`) y falle si una ruta enrutada no tiene cobertura en el catálogo, o si un marcador declara una ruta que `App.tsx` no enruta.
- Cablear ese check en el job `pruebas` de `.github/workflows/deploy.yml`, con el mismo criterio ya vigente para pruebas rotas: si falla, no hay deploy.
- Cablear también `node scripts/generar-catalogo.mjs --check` sobre la raíz del repositorio en ese mismo job. Hoy `scripts/validar-catalogo.test.ts` solo ejecuta el generador contra un directorio temporal, así que **nadie verifica que los JSON comiteados estén en sincronía con la fuente**, y `functions/index.js:22` carga `./generated/soporte/catalogo.v1.json` comiteado: un olvido de regeneración sirve catálogo viejo en producción con CI en verde.
- Prueba de concepto acotada, sin migración masiva: `vistas/BuzonNotificaciones.tsx` (caso simple 1:1), `vistas/admin/AgendaView.tsx` (caso complejo: tres entradas, dos rutas, sensibilidad `privileged`, siete roles — y el archivo que sufrió la deriva de `Horarios.tsx`) y el alta nueva de `/jornadas` sobre `vistas/admin/JornadasView.tsx`, que cierra el hueco vivo y demuestra el camino "pantalla nueva nace con marcador".
- Actualizar `docs/asistente/catalogo.md`, que quedó desactualizado: su línea 40 todavía afirma que `Estudiante` permanece `reserved` y describe cómo activarlo, cuando ya está activo en producción. El documento debe pasar de checklist manual a descripción del mecanismo automático.

### Out of Scope

- **Ejecutar** la migración de las entradas manuales restantes en esta entrega (siguen viviendo como `entry(...)` manual). Corrección post-`sdd-design`: la PoC migra 4 entradas (no 3 — `AgendaView.tsx` sola aporta `agenda.read`+`agenda.manage`+`agenda.standalone`), dejando **55 entradas manuales en ≈27 archivos distintos** (varias entradas comparten archivo, ej. todas las `config.*` viven en `Configuracion.tsx`). El conteo exacto de archivos lo fija `sdd-tasks` del change de seguimiento al enumerarlos uno por uno. Su planificación NO queda fuera de alcance: es condición de cierre crear el change de seguimiento `catalogo-soporte-migracion-deuda` con esa lista como tareas concretas (ver Decisión #7 y Success Criteria).
- Migrar el núcleo transversal que no corresponde a una vista puntual: `shell.session`, `master.support`, `master.tenants`, `master.kicho`, `master.analytics` y las rutas públicas sin componente 1:1 claro. Conviven de forma permanente como entradas manuales; el mecanismo no las fuerza.
- Cambiar el esquema del catálogo, el contenido de las respuestas, el matcher, el fallback de IA o el escalamiento.
- Detectar deriva de elementos no enrutados (modales, pestañas, botones, paneles internos). Esta entrega cubre la unidad "ruta enrutada", que es donde ocurrió la deriva observada.
- Verificar `authorizationRef` contra guardas reales de backend o `firestore.rules`. El marcador documenta; no prueba autorización.
- Traducir el catálogo, versionar entradas por tenant o generar contenido con IA.

## Capabilities

### New Capabilities

- `catalogo-soporte-antideriva`: contrato del marcador co-locado, reglas de fusión con el núcleo manual y gate de CI que compara rutas enrutadas contra cobertura del catálogo.

### Modified Capabilities

- `catalogo-soporte`: pasa de fuente única manual a fuente doble (núcleo manual + marcadores co-locados) fusionada en generación. El artefacto publicado (`catalogo.v1.json` y su `.sha256`) no cambia de forma.

## Approach

Tres capas, de la más barata a la más fuerte:

1. **Tipado** (`soporteMeta` co-locado): mueve el error de "alguien no actualizó un archivo lejano" a "el compilador no deja". Cubre campos y roles inválidos.
2. **Generación** (escaneo y fusión en `generar-catalogo.mjs`): mantiene un único artefacto publicado, sin tocar el consumo en cliente ni en `functions/`. El script ya transpila TypeScript con `ts.transpileModule`, así que el escaneo reutiliza infraestructura existente.
3. **Gate de CI** (rutas de `App.tsx` contra cobertura): cubre lo que el tipo no puede ver — la ausencia. Una vista sin marcador no produce error de compilación; sí produce un fallo de pipeline.

Por qué no las alternativas evaluadas:

- *Solo checklist documentada*: ya existe (`docs/asistente/catalogo.md`, sección "Checklist de alta y revisión") y no evitó ninguno de los 11 defectos. Un control que depende de que alguien lo lea no es un control.
- *Migración total a marcadores en un solo corte*: 59 entradas movidas de un golpe, sin haber validado el mecanismo end-to-end, con riesgo de romper el catálogo que sostiene el soporte en producción. Se prefiere probar el mecanismo con 3 vistas y migrar por goteo.
- *Generar el catálogo entero desde el código*: no es viable — buena parte del contenido (aliases en lenguaje de usuario, pasos, términos negativos) es criterio de producto, no derivable del código.

Evidencia de deriva que motiva el diseño:

| Deriva observada | Capa que la habría detectado |
|---|---|
| 10 funciones reales sin entrada | Gate de CI (ruta enrutada sin cobertura) |
| `agenda.read` / `agenda.manage` → `vistas/Horarios.tsx` huérfano | Marcador co-locado (el archivo borrado se lleva su marcador) |
| `Estudiante` en `reserved` con rol activo en producción | Tipado y prueba de roles (ya cubierto tras la corrección de hoy) |
| `Maestro` ausente del tipo `RolSoporte` | Tipado |
| `/jornadas` sin cobertura (abierto hoy) | Gate de CI |
| JSON comiteado desincronizado de la fuente | `generar-catalogo.mjs --check` sobre la raíz en CI |

## Impact

| Area | Impact |
|---|---|
| `shared/soporte/tipos.ts` | Modified — tipo o alias exportable para el marcador co-locado |
| `scripts/generar-catalogo.mjs` | Modified — escaneo de `soporteMeta` y fusión con el núcleo manual |
| `shared/soporte/catalogo.v1.ts` | Modified — salen 3 entradas migradas; el conteo fijo de 59 en `assertCatalog` deja de ser válido |
| `App.tsx` | Read-only — fuente de verdad de rutas para el gate |
| `vistas/BuzonNotificaciones.tsx`, `vistas/admin/AgendaView.tsx`, `vistas/admin/JornadasView.tsx` | Modified — prueba de concepto con marcador |
| `.github/workflows/deploy.yml` (job `pruebas`) | Modified — gate de rutas y `--check` sobre la raíz |
| `docs/asistente/catalogo.md` | Modified — checklist manual → mecanismo automático; corregir la línea sobre `Estudiante` |
| `functions/generated/soporte/catalogo.v1.json`, `public/generated/soporte/catalogo.v1.json` y `.sha256` | Regenerated — mismo formato, contenido equivalente |

Tests afectados:

- `shared/soporte/catalogo.v1.test.ts` — el golden `INVENTARIO_ESPERADO` y los dos `toHaveLength(59)` deben pasar a contar el catálogo **fusionado**, no el array literal, o las 3 entradas migradas lo rompen.
- `scripts/validar-catalogo.test.ts` — `expect(CATALOGO_SOPORTE_V1.entries).toHaveLength(59)` tiene el mismo problema; además se agregan casos de fusión, de marcador duplicado y de ruta inexistente.
- Nuevo test del gate de rutas (ruta enrutada sin cobertura → falla; marcador con ruta que `App.tsx` no enruta → falla; catálogo íntegro → pasa).
- Tests de las 3 vistas de la prueba de concepto: deben seguir en verde con el export adicional (`AgendaView`, `BuzonNotificaciones`, `JornadasView` y sus suites asociadas).
- `App.routing.test.ts` — no cambia de comportamiento, pero pasa a ser vecino del gate y sirve de referencia de las rutas esperadas.
- `servicios/soporte/matcher.test.ts` y `servicios/soporte/contexto.test.ts` — regresión: la fusión no debe alterar resolución ni confianza para las entradas existentes.

Evidencia de cobertura actual: en la sesión previa de hoy el repositorio quedó en 161/161 suites y 1716/1719 pruebas (3 skipped), con `catalogo.v1.test.ts` cubriendo las 59 entradas por golden y `validar-catalogo.test.ts` validando esquema, checksum y drift **solo contra un directorio temporal**. Cobertura real del riesgo que ataca esta propuesta: 0% — ninguna prueba compara hoy `App.tsx` contra el catálogo, y ninguna verifica los artefactos comiteados.

Objetivo de cobertura: 100% de las ramas del gate (ruta huérfana, marcador huérfano, marcador duplicado, catálogo íntegro) y de la lógica de fusión del generador; suites existentes sin regresión (161/161); `--check` sobre la raíz en verde en CI.

## Risks

| Risk | Mitigation |
|---|---|
| El gate nace en rojo por las ≈27 archivos (55 entradas) sin migrar y el equipo aprende a ignorarlo | Resuelto por Decisión #1 (línea base congelada): el gate entra en verde el día uno, exige marcador solo fuera de la lista de deuda |
| El change de seguimiento (`catalogo-soporte-migracion-deuda`) se crea pero nunca se ejecuta, y la deuda queda colgada igual bajo otro nombre | Decisión #7 lo hace condición de cierre de ESTA entrega (no opcional); el aviso no bloqueante de Decisión #6 sigue empujando la migración cada vez que alguien toca un archivo de la lista, independientemente de cuándo se ejecute el change de seguimiento |
| Falso positivo por rutas dinámicas, comodines `*`, redirecciones o rutas condicionadas por rol | El parser reconoce solo `path=` literales y excluye `*` de forma explícita; casos declarados en el spec con Given/When/Then |
| Parsear `App.tsx` con expresiones regulares se rompe con un cambio de formato | Usar el AST de TypeScript, que el script ya tiene disponible vía `ts` |
| El escaneo de fuentes encarece el generador y el arranque de CI | Limitar el escaneo a `vistas/` y `components/` y medir el tiempo antes y después |
| Importar vistas React desde un script Node rompe por JSX o dependencias del navegador | Leer el marcador por AST sin ejecutar el módulo; nunca importar el componente |
| Dos marcadores con el mismo `id` en archivos distintos | Falla dura del generador con el archivo y el id en el mensaje |
| La prueba de concepto de `/jornadas` introduce contenido de soporte sin revisión de producto | El contenido nuevo es mínimo y se marca para revisión del dueño del catálogo antes del cierre |

## Rollback Plan

Cada capa se revierte por separado y ninguna deja al asistente sin catálogo:

1. Quitar los pasos nuevos del job `pruebas` en `.github/workflows/deploy.yml` desactiva el gate en un solo commit, sin tocar la aplicación.
2. Revertir `scripts/generar-catalogo.mjs` a la versión que solo lee `catalogo.v1.ts` y devolver las 3 entradas migradas a `entry(...)` restituye el estado actual exacto; el artefacto publicado no cambia de forma en ningún momento, así que cliente y `functions/` no requieren cambio.
3. Los exports `soporteMeta` que queden en las vistas son inertes: no se importan en runtime y no afectan el bundle si el generador deja de leerlos.

Verificación posterior al rollback: `npm test -- --runInBand`, `npx tsc --noEmit`, `node scripts/generar-catalogo.mjs --check` y checksum del JSON idéntico al de la versión previa.

## Dependencies

- Ninguna externa. Sin nuevas dependencias de npm: `typescript` (AST) y el runner de Node ya están en el proyecto.
- Requiere que `App.tsx` siga siendo el único lugar donde se declaran rutas. Si aparece un segundo router, el gate debe extenderse.
- Requiere permiso para editar `.github/workflows/deploy.yml`.

## Success Criteria

- [ ] Agregar una `<Route path=...>` sin cobertura de soporte hace fallar el job `pruebas` con un mensaje que nombra la ruta y el archivo.
- [ ] Mover o borrar el archivo de una vista con marcador hace fallar el pipeline en lugar de dejar una referencia huérfana como la de `vistas/Horarios.tsx`.
- [ ] Un marcador no puede declarar un rol, una sensibilidad o un campo que no exista: falla `npx tsc --noEmit`.
- [ ] Las 3 vistas de prueba de concepto producen sus entradas por marcador y el catálogo generado es funcionalmente equivalente al actual más `/jornadas`.
- [ ] `node scripts/generar-catalogo.mjs --check` corre sobre la raíz en CI y falla si los JSON comiteados quedaron viejos.
- [ ] `docs/asistente/catalogo.md` describe el mecanismo real y ya no afirma que `Estudiante` está `reserved`.
- [ ] Suites en verde (161/161) y `npm run build` sin cambios de comportamiento en el asistente.
- [ ] Tocar (modificar) un archivo de la lista de deuda congelada produce un aviso visible en CI, sin bloquear el pipeline.
- [ ] Existe `openspec/changes/catalogo-soporte-migracion-deuda/proposal.md` + `tasks.md` con los ≈27 archivos restantes (55 entradas manuales) listados explícitamente, uno por uno, antes de que esta entrega se archive.

## Decisiones confirmadas (usuario, 2026-07-30)

1. **Línea base del gate: Opción B — línea base congelada.** Se declara una lista explícita de rutas/archivos ya cubiertos por entrada manual (≈27 archivos, 55 entradas, que no se migran en esta entrega). El gate exige marcador únicamente para rutas/archivos fuera de esa lista. Toda ruta nueva nace obligada a tener marcador; migrar una vista existente se hace sacando su entrada de la lista de deuda. La lista solo puede achicarse, nunca crecer — si alguien intenta agregar una ruta a la lista de deuda en vez de cubrirla, el gate también debe rechazar eso. Resuelto en `sdd-design`: la línea base vive en `shared/soporte/deuda-catalogo.json`.

2. **Unidad de cobertura: por archivo enrutado**, no por ruta. Cubre mejor paneles internos con múltiples sub-vistas bajo la misma ruta (`/` en Administración). El gate verifica que cada componente que `App.tsx` efectivamente monta en una `<Route>` tenga cobertura — no que la ruta en abstracto tenga *alguna* entrada.

3. **Alcance de la prueba de concepto: se incluyen las 3.** `BuzonNotificaciones` (simple), `AgendaView` (complejo) y el alta nueva de `JornadasView` — cierra el hueco real de `/jornadas` detectado hoy mismo en esta misma entrega, en vez de dejarlo abierto.

6. **Aviso no bloqueante al tocar deuda.** El gate compara el diff del PR contra la lista congelada de deuda: si un archivo de esa lista aparece modificado, el pipeline sigue en verde pero deja un comentario/anotación visible ("este archivo está en la lista de deuda del catálogo de soporte, considerá migrarlo ya que estás acá"). No bloquea, pero convierte el momento de mayor leverage (alguien ya está en el archivo) en el empujón natural para pagar deuda.

7. **La lista de deuda tiene fecha de cierre, no queda colgada indefinidamente.** Esta entrega NO migra los ≈27 archivos restantes (ver Alcance/Riesgo de PR grande), pero como condición de cierre de ESTA entrega (antes de `sdd-archive`) se crea el change de seguimiento `catalogo-soporte-migracion-deuda` con su propio `tasks.md` listando explícitamente cada archivo pendiente, uno por uno (el conteo exacto lo fija esa fase al enumerarlos contra `shared/soporte/deuda-catalogo.json`), como checklist verificable. La deuda deja de ser "algún día" y pasa a ser un change real, versionado, con tareas concretas — aunque su ejecución quede para otra sesión, su existencia y alcance no son opcionales.

4. **Cobertura obligatoria por rol: sí.** El gate exige que toda ruta/archivo cubierto declare al menos un rol con `status: 'active'` en `ROLES_SOPORTE`. Esto habría atrapado el defecto de `Estudiante` en `reserved` del 2026-07-30. Aumenta el mantenimiento del gate a cambio de cerrar la misma familia de bug de raíz, no solo la mitad.

5. **Fix del JSON de producción: sí, incluir.** `node scripts/generar-catalogo.mjs --check` corre sobre la raíz real del repositorio (no solo un directorio temporal) como paso del job `pruebas` en CI.
