# Cierre SDD Claude Code - Centro de Estudios

Objetivo: dejar un registro unico, obligatorio y siempre actualizado del trabajo que Claude Code viene haciendo sobre Centro de Estudios via Spec-Driven Development (SDD), para que cualquier IA o sesion futura (esta misma u otra) sepa en que punto va, que falta, y como continuar sin perder contexto ni pisar trabajo ya hecho.

Este documento es al trabajo de Claude Code lo que `CIERRE CENTRO DE ESTUDIOS.md` es al trabajo de Codex, y lo que `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md` es a la coordinacion entre esas dos IAs. Las tres conviven. Si hay conflicto entre documentos, manda este orden:

1. Instrucciones directas del usuario en la conversacion activa.
2. Este documento (para todo lo que es linea de trabajo Claude Code / SDD).
3. `CIERRE CENTRO DE ESTUDIOS.md` (para todo lo que es linea de trabajo Codex/Antigravity).
4. `COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md` (coordinacion entre esas dos).
5. Artefactos de `openspec/changes/{change}/` (detalle tecnico de cada change puntual).

## 0. Que es SDD y donde vive el detalle

Cada unidad de trabajo es una "change" con su propia carpeta:

- Activa: `openspec/changes/{nombre-change}/` (proposal.md, specs/, design.md, tasks.md, verify-report.md)
- Archivada: `openspec/changes/archive/{YYYY-MM-DD}-{nombre-change}/`
- Espec formal acumulada (fuente de verdad de comportamiento por dominio): `openspec/specs/{dominio}/spec.md`

`tasks.md` de cada change ES la lista de tareas real, con evidencia por tarea (que test, que resultado). Este documento (`CIERRE SDD CLAUDE CODE...md`) es el **resumen de alto nivel** para saber rapido en que change/fase estamos - para el detalle tarea-por-tarea, ir siempre a `tasks.md` de la change activa.

## 1. Protocolo obligatorio de ejecucion

Identico en espiritu al de `CIERRE CENTRO DE ESTUDIOS.md`, adaptado a SDD:

1. Toda tarea de codigo sigue TDD real: RED (test que falla) -> GREEN (minimo cambio) -> REFACTOR (limpieza sin cambiar comportamiento) -> VERIFY (correr tests/build/tsc).
2. Ninguna tarea se marca `[x]` en `tasks.md` sin evidencia real ejecutada (no autoreportada sin verificar).
3. Antes de dar por buena una fase completa por un sub-agente, quien retoma la conversacion (Claude Code, orquestador) debe **verificar el estado real del archivo/tests**, no confiar ciegamente en el resumen del sub-agente. Esto ya paso 2 veces hoy (fase 1 atribuyo mal una falla; fase 3 se corto sin dejar nada aplicado en un intento y casi completo en el siguiente) - la verificacion directa es la que evito arrastrar error.
4. Si un agente se corta a mitad de tarea (limite de sesion/rate limit), **antes de reintentar**, verificar el estado real del archivo (grep/read) para no reaplicar o perder trabajo. No asumir "no se aplico nada" ni "se aplico todo" sin chequear.
5. Al cerrar cada fase de una change, actualizar este documento (seccion 3) con: fecha, fase, estado, archivos tocados, pendientes exactos.
6. Si aparece deuda tecnica o un hallazgo fuera del alcance de la tarea activa, se anota en la Seccion 4 (Deuda tecnica diferida) - no se resuelve de prepo ni se pierde.

## 2. Estado general (actualizar esta tabla en cada cierre de fase/change)

| Change | Estado | Ultima actualizacion |
|---|---|---|
| `asignacion-material-por-clase` | Archivada | previo a esta sesion de seguimiento |
| `integracion-agenda-etapa-3` | Archivada | previo a esta sesion de seguimiento |
| `programa-persistencia-gestion-clases` | Archivada | previo a esta sesion de seguimiento |
| `centro-recursos-clasificacion-manual` | Archivada (`archive/2026-07-05-...`) | 2026-07-05 |
| `grupos-publicacion-material` | Archivada (`archive/2026-07-06-...`) — **su UI fue reemplazada por completo en `unificar-flujo-publicar-material`, Fase 3** (ver nota abajo) | 2026-07-06 |
| `gestion-clases-cancelar-reprogramar` | Archivada (`archive/2026-07-06-...`) | 2026-07-06 |
| `unificar-flujo-publicar-material` | Archivada (`archive/2026-07-08-...`) | 2026-07-08 |
| `clase-en-vivo-checkin-trigger-agenda` | PLANIFICACION COMPLETA — `sdd-apply` en progreso parcial: 2 tareas adelantadas fuera de orden desde Bloque B (fix `asignaciones.js:89` de Fase 11, servicio WhatsApp Cloud API de Fase 10), gate de Bloque A (Fases 0-6) todavia no arrancado | 2026-07-08 |

**Nota importante sobre `grupos-publicacion-material`:** esa change fue archivada como exitosa en su momento, pero el diseño de usuario (Figma) exportado despues pidio reemplazar ese flujo entero (el "Publicacion en lote" con `gruposPublicacion[]`) por un wizard unico de 3 pasos. La Fase 3 de `unificar-flujo-publicar-material` **borro por completo** ese codigo. Si alguna IA lee el archive de `grupos-publicacion-material` y ve "PASS, archivado, listo" - ese comportamiento **ya no existe en el codigo actual**. Este documento es la referencia de que quedo superado.

## 3. Change activa: `unificar-flujo-publicar-material`

**Que hace:** reemplaza el carrusel viejo "Clase activa" (ya vestigial/muerto en produccion) y la seccion "Publicacion en lote" (grupos) por un unico flujo: por cada clase activa, una lista de "materiales asignados" que crece de a uno via un modal guiado de 3 pasos (Material -> Configurar -> Grados), replicando un diseño que el usuario armo en Figma Make (codigo fuente real revisado, no solo capturas).

**Ubicacion de artefactos:** `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/` (proposal.md, specs/academico-programa/spec.md, specs/academico-biblioteca/spec.md, design.md, tasks.md — la lista de tareas detallada y autoritativa vive ahi).

### 3.1 Fase 1 - Foundation — COMPLETA (2026-07-06)

- `models/academico/jornada.ts`: campo `tema?: string` en `JornadaInstruccion`.
- `servicios/academico/jornadaRepository.ts`: `actualizarTemaJornada(tenantId, jornadaId, tema)` con guard de existencia (getDoc antes de escribir, porque algunas jornadas activas son previews sinteticos nunca persistidos).
- `servicios/academico/asignacionService.ts`: `eliminarAsignacion`/`actualizarAsignacion` reales (antes eran stubs que no hacian nada).
- `firestore.rules`: `asignaciones` delete ampliado de `isAdmin()` a `isInstructor()` (con test de reglas nuevo).
- Tests: 30/30 (`jornadaRepository`+`asignacionService`) + 20/20 (`test:firestore-rules`).
- **Regresion detectada y corregida DESPUES del cierre de fase** (2026-07-06, durante verificacion de Fase 3): el objeto `deps` fallback en `jornadaRepository.ts` linea ~128 no compilaba (`tsc --noEmit` fallaba) porque agregar `getDoc` rompio la asignacion estructural a `JornadaRepositoryDeps`. Corregido con un cast `as unknown as JornadaRepositoryDeps`. **Leccion**: la verificacion de Fase 1 fue solo `npm test`, no incluyo `tsc --noEmit` - por eso se escapo. A partir de ahora, toda fase que toque `.ts`/`.tsx` debe correr `tsc --noEmit` antes de marcarse cerrada.

### 3.2 Fase 2 - Core Implementation — COMPLETA (2026-07-06)

- Nuevo `components/academico/AsignarMaterialWizard.tsx` (standalone, sin consumidor todavia en ese momento): `StepBar`, `Step1` (picker de material con match de tags), `Step2` (destinatario/grupo objetivo/momento/criterio/fechas), `Step3` (grados reales `GradoTKD`, 13 valores agrupados en 6 familias de color), modo `crear`/`editar` con pre-carga y chequeo de cambios (dirty-check) antes de habilitar "Asignar".
- Exporta `familiaDeGrado`/`PALETA_FAMILIAS_GRADO`/`EstiloFamiliaGrado` para reuso.
- Tests: 17/17 en `AsignarMaterialWizard.test.tsx`.

### 3.3 Fase 3 - Integration/Wiring — COMPLETA (2026-07-06)

- `vistas/admin/AsignacionesView.tsx`: eliminado el codigo muerto de "Clase activa" (formulario plano viejo) y toda la seccion "Publicacion en lote" (`gruposPublicacion[]` y sus handlers) - confirmado 0 ocurrencias de `gruposPublicacion` en el archivo.
- Wizard importado y renderizado; "+ Agregar material" abre modo `crear`; boton Editar por fila abre modo `editar` prellenado.
- `crearDestinatario()` corregido: ahora puebla `grados` tambien cuando `tipo==='grupo'` (antes solo lo hacia para `'grado'`).
- Hidratacion real de `asignacionesPublicadas` via `listarAsignacionesPorTenant` al montar/cambiar tenant (antes solo se llenaba localmente en la sesion).
- Fila de asignacion colapsada/expandida con puntos de color por grado, boton Editar y Eliminar reales (llaman a los servicios reales de Fase 1).
- Pildora de `tema` editable inline (blur/Enter -> `actualizarTemaJornada`, sin abrir el wizard).
- Exclusion de duplicados: el picker de material del wizard excluye lo ya asignado a la clase activa (via `useMemo`).
- Bullets de navegacion (gris/azul/rojo/verde) preservados sin cambios, tal como se pidio.
- Verificado (2026-07-06, por el orquestador, no solo por el sub-agente): `npx tsc --noEmit` limpio en `AsignacionesView.tsx`/`AsignarMaterialWizard.tsx`/`jornadaRepository.ts`/`asignacionService.ts` (tras la correccion de la regresion de Fase 1 arriba). El diseño de Figma ya es visible en `http://localhost:5173/#/centro-estudios`.
- **Pendiente cosmetico, no bloqueante**: el titulo interno todavia dice "Clase activa" (texto viejo) en vez de un encabezado mas limpio acorde al mockup. Ajuste menor, no funcional.

### 2026-07-07 - Claude Code - `unificar-flujo-publicar-material` / Fase 3.5 (correcciones de prueba manual)

- Estado: COMPLETA
- Archivos modificados:
  - `vistas/admin/AsignacionesView.tsx` (Fix 1 + ajuste de Fix 2 en `draftDesdeAsignacion`)
  - `components/academico/AsignarMaterialWizard.tsx` (Fix 2)
  - `vistas/admin/AsignacionesView.instructorSeleccion.test.tsx` (nuevo, Fix 1)
  - `components/academico/AsignarMaterialWizard.test.tsx` (Fix 2)
  - `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/tasks.md` (nueva seccion "Phase 3.5")
- **Fix 1 - instructorId real + gating por rol**: bug confirmado por grep, no supuesto: `programa.instructor` era un nombre libre y `crearBloquesDesdePrograma` hacia `instructorId: slugificar(programa.instructor)`, pero `functions/academico/asignaciones.js` valida `jornada.instructorId === auth.uid` (UID real de Firebase Auth) para autorizar `publishAsignacion`. Un slug de nombre nunca puede coincidir con un UID real -> publicar material estaba roto para cualquier usuario real en produccion. Decision explicita del usuario: dos roles pueden asignar instructor - Admin/SuperAdmin elige cualquiera de `opciones.instructores` (la lista real ya existia en `jornadaContextService.ts`, no se usaba en el form); Editor ("Maestro") queda bloqueado a autoasignarse. Se agrego `instructorId: string` a `ProgramaAcademicoAsignacion`, se elimino el `slugificar()` del instructor, el campo del modal quedo gated por `puedeElegirInstructor` (Admin: `<select>` real por `id`; Editor: `<input disabled>` con su propio nombre), y `guardarPrograma()` fuerza defensivamente el instructor/instructorId de `useAuth()` para cualquier rol no-Admin al momento de guardar (no confia en el estado previo del formulario).
- **Fix 2 - remocion del campo Destinatario del wizard**: a pedido explicito del usuario ("Si, sacalo"). Se quito el `<select>` de Destinatario (grupo|estudiante) del Paso 2 de `AsignarMaterialWizard.tsx`; el campo `destinatario` del tipo `AsignacionDraft` se conserva (otro codigo lo sigue leyendo) pero el wizard lo fuerza a `'grupo'` de forma incondicional al inicializar su estado, sin importar `draftInicial`. `draftDesdeAsignacion()` en `AsignacionesView.tsx` se simplifico igual, en vez de derivar `'estudiante'` del tipo de la asignacion existente.
- Tests ejecutados (comando + resultado exacto):
  - `npx jest --runInBand --testPathPattern "AsignacionesView.instructorSeleccion"` -> RED inicial 4/4 fallan; GREEN final 4/4 pasan.
  - `npx jest --runInBand --testPathPattern "AsignarMaterialWizard.test.tsx"` -> RED inicial 2/18 fallan (los 2 nuevos/modificados); GREEN final 18/18 pasan.
  - `npx jest --runInBand --testPathPattern "AsignacionesView|AsignarMaterialWizard|jornadaContextService"` (regresion completa pedida) -> **19 failed, 46 passed, 65 total** en 5 suites: `AsignacionesView.test.tsx` se mantiene exactamente en 19 failed/17 passed (deuda pre-existente de Fase 4, sin cambios, confirmado antes y despues del fix); `AsignarMaterialWizard.test.tsx` 18/18; `AsignacionesView.instructorSeleccion.test.tsx` (nuevo) 4/4; `AsignacionesView.wizard.test.tsx` (integracion Fase 3, no tocado) 6/6; `jornadaContextService.test.ts` 1/1.
- tsc --noEmit: limpio en `AsignacionesView.tsx` y `AsignarMaterialWizard.tsx` (0 errores nuevos). El `tsc --noEmit` de proyecto completo muestra ~219 errores `TS2339`/`TS2551` tipo "`toBeInTheDocument`/`toEqual` no existe en `Assertion`" en archivos `.test.tsx` de todo el proyecto (incluyendo `AsignacionesView.wizard.test.tsx`, no tocado) - es ruido preexistente de tipado jest-dom-vs-chai en la config de `tsc` plano (no en `ts-jest`, que es el que corre los tests reales), no algo introducido por este fix.
- Pendientes exactos:
  - Fase 4 (rewrite completo de `AsignacionesView.test.tsx`) sigue intacta, sin tocar, tal como se pidio.
  - Riesgo documentado en `tasks.md` 3.5.6: editar (via el wizard) una asignacion vieja con `destinatario.tipo==='estudiante'` ahora la normaliza a `'grupo'` al guardar, porque ya no hay control en la UI para mantener 'estudiante'. Es el comportamiento pedido por el usuario, pero es una perdida de informacion en asignaciones existentes si se re-editan. Ver Seccion 4 si esto necesita revisarse antes de Fase 4.
- Siguiente accion concreta: continuar con Fase 4 (rewrite de `AsignacionesView.test.tsx`), ahora teniendo en cuenta que el modal de Programa gana un `puedeElegirInstructor`/`instructorId` y que el wizard ya no tiene control de Destinatario.

### 2026-07-07 - Claude Code - `unificar-flujo-publicar-material` / Fase 3.6 (rediseño minimalista header "Clase activa")

- Estado: COMPLETA
- Archivos modificados:
  - `components/Iconos.tsx` (nuevos `IconoFlechaIzquierda`/`IconoFlechaDerecha`)
  - `vistas/admin/AsignacionesView.tsx` (fila de navegacion de "Clase activa")
  - `vistas/admin/AsignacionesView.claseActivaHeader.test.tsx` (nuevo, aislado)
  - `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/tasks.md` (nueva seccion "Phase 3.6")
- **Que se cambio**: el usuario confirmo via screenshot anotado ("MANTENER ESTE MISMO DISEÑO", apuntando a este header exacto) que la fila "Clase anterior" (boton bordeado con texto) / "Clase N de M" (parrafo aparte) / "Clase siguiente" (boton bordeado con texto) / "Instructor: X · Grupo: Y" (parrafo aparte) debia reemplazarse por el mockup de Figma: una unica fila `<` icono-only — "CLASE N DE M" centrado — `>` icono-only, sin la linea Instructor/Grupo. Se agregaron 2 iconos nuevos (`IconoFlechaIzquierda`/`IconoFlechaDerecha`, mismo patron `BaseIcon` que el resto de `Iconos.tsx`, chevron via `<polyline>`). Los botones de texto se reemplazaron por botones cuadrados icono-only reutilizando la convencion ya existente en el archivo para botones-icono de accion (`h-[52px] w-[52px] rounded-2xl bg-red-50 text-tkd-red hover:bg-red-100`, la misma usada por "Editar programa"/"Crear programa"), sumando `disabled:opacity-40` (los botones originales si tenian estado disabled en los limites del carrusel). Se conservo `aria-label`/`title` con el texto original ("Clase anterior"/"Clase siguiente") para accesibilidad, pese a ser icono-only. "Clase N de M" ahora es un unico `<p>` centrado entre ambos botones, con peso `font-medium` (mas liviano que el resto de labels `font-black`) pero misma familia de color (`text-gray-400`). Se elimino por completo la linea "Instructor: {instructor} · Grupo: {grupo}" (los datos `instructorJornada`/`jornadaActiva.instructor` se siguen leyendo en otro punto del archivo para publicar, no se toco el acceso a datos, solo se dejo de renderizar esa linea aqui). La linea de fecha/hora/sede NO se toco en contenido (no estaba en el pedido de remocion), solo se centro debajo de la nueva fila. No se toco la pildora `tema`, la fila de bullets (gris/azul/rojo/verde), el wizard, ni la seccion de materiales asignados — scope estrictamente limitado a esta fila.
- Tests ejecutados (comando + resultado exacto):
  - Baseline previo al fix (confirmado antes de tocar codigo): `npx jest --runInBand --testPathPattern "AsignacionesView.test.tsx"` -> 19 failed, 17 passed, 36 total. `npx jest --runInBand --testPathPattern "AsignacionesView.wizard.test.tsx|AsignacionesView.instructorSeleccion.test.tsx|AsignarMaterialWizard"` -> 3 suites passed, 28 passed, 28 total.
  - RED: `npx jest --runInBand --testPathPattern "AsignacionesView.claseActivaHeader.test.tsx"` -> 2/2 fallan (confirmado: uno por texto visible "Clase anterior"/"Clase siguiente" dentro del boton en vez de icono-only, otro por la linea Instructor/Grupo seguir presente).
  - GREEN: mismo comando -> 2/2 pasan.
  - Regresion completa pedida: `npx jest --runInBand --testPathPattern "AsignacionesView|AsignarMaterialWizard"` -> **19 failed, 47 passed, 66 total** en 5 suites. `AsignacionesView.test.tsx` (legado) se mantiene exactamente en 19 failed/17 passed, sin cambios. El resto (`AsignarMaterialWizard.test.tsx`, `AsignacionesView.instructorSeleccion.test.tsx`, `AsignacionesView.wizard.test.tsx`, `AsignacionesView.claseActivaHeader.test.tsx` nuevo) suma 47/47 en verde.
- tsc --noEmit: limpio en `AsignacionesView.tsx` y `components/Iconos.tsx` (0 errores nuevos). Los unicos errores que involucran archivos tocados son en `AsignacionesView.claseActivaHeader.test.tsx` (`toBeInTheDocument`/`toBe`/`toBeNull` "no existe en `Assertion`"), el mismo ruido preexistente de tipado jest-dom-vs-chai documentado en el cierre de Fase 3.5, presente por igual en `AsignacionesView.wizard.test.tsx` (no tocado en este fix).
- Pendientes exactos: ninguno nuevo. Sigue pendiente Fase 4 (rewrite de `AsignacionesView.test.tsx`) y Fase 5 (cleanup), sin cambios respecto a lo documentado en 3.5.
- Siguiente accion concreta: continuar con Fase 4 (rewrite de `AsignacionesView.test.tsx`), sin cambios de alcance respecto a lo ya documentado — este fix solo tocó el header visual, no wiring de datos ni contratos de props.

### 2026-07-07 - Claude Code - `unificar-flujo-publicar-material` / Fase 3.7 (rediseño en tarjetas 3x3 con paginación de `MisClasesView.tsx`)

- Estado: COMPLETA
- Archivos modificados:
  - `components/Iconos.tsx` (nuevos `IconoCalendario`/`IconoReloj`)
  - `vistas/admin/MisClasesView.tsx` (rediseño completo: tabla sin estilos -> grilla de tarjetas 3x3 con paginación)
  - `vistas/admin/MisClasesView.test.tsx` (1 query ajustada + nuevo `describe` de paginación con 4 tests)
  - `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/tasks.md` (nueva sección "Phase 3.7")
- **Que se cambio**: tarea de seguimiento fuera del alcance original de esta change, descubierta durante prueba manual - no viene del mockup Figma, es idea propia del usuario. `MisClasesView.tsx` (gestion del ciclo de vida de jornadas por programa - Confirmar/Iniciar/Cerrar/Cancelar/Reprogramar, con checkboxes de asistencia/objetivos para cerrar una `en_curso`) seguia siendo una `<table>` completamente sin estilos Tailwind, distinta de `AsignacionesView.tsx` (que ya tiene el rediseño Figma). Se reemplazo por una grilla `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` de tarjetas (`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md`, siguiendo la misma convencion visual ya usada en `AsignacionesView.tsx`), mostrando hasta 9 tarjetas por pagina; cuando el programa tiene mas de 9 jornadas aparece una `<nav aria-label="Paginacion de clases">` con un boton por pagina debajo de la grilla. Cada tarjeta muestra fecha/hora con los iconos nuevos `IconoCalendario`/`IconoReloj` (mismo patron `BaseIcon` del resto de `Iconos.tsx`, sin usar `lucide-react`, que se reconfirmo sigue sin ningun uso real en el codigo fuente de la app), un badge de estado con color (`ESTILO_POR_ESTADO`, convencion nueva - no existia ningun mapeo estado-a-color en el proyecto antes de esta fase, confirmado por busqueda - definida asi: borrador=gris, confirmada/reprogramada=azul, en_curso/pendiente_cierre/parcial/pendiente_sustitucion=ambar, cerrada=verde, cancelada=rojo; `Record` exhaustivo sobre los 10 valores de `EstadoJornada` aunque este flujo hoy solo produce 5 de ellos), material asignado, y las mismas acciones/checkboxes/formularios inline de cancelar y reprogramar que ya existian, re-skinned pero con la MISMA logica de negocio: `transicionar()`, `cancelarClase()`, `reprogramarClase()`, `accionesDisponibles()`, el gating de asistencia/objetivos para `en_curso`, las llamadas de auditoria, el manejo de errores (`setError`) y la logica de `cargar()` (via `repository.listarJornadasPorTenant`/`listarAsignacionesPorTenant`) no se tocaron. Se agrego solo: estado `paginaActual` (0-indexado), constante `porPagina = 9`, un `React.useMemo` que recorta `jornadas` a la pagina actual, y el reset de `paginaActual` a 0 dentro de `cargar()` (justo despues de `setJornadas(delPrograma)`) para que una pagina vieja nunca quede apuntando mas alla del nuevo total tras una recarga.
- Tests ejecutados (comando + resultado exacto):
  - Baseline previo al fix: `npx jest --runInBand --testPathPattern MisClasesView` -> 9 passed, 9 total.
  - RED: mismo comando tras ajustar 1 query existente (el badge ahora dice "En curso", no el string crudo "en_curso") y agregar 4 tests nuevos de paginacion -> **4 failed, 9 passed, 13 total** (confirmado: 1 por el cambio de texto del badge, 3 por funcionalidad de paginacion/grilla que aun no existia).
  - GREEN: mismo comando tras el rediseño -> **13 passed, 13 total**.
  - Regresion ampliada: `npx jest --runInBand --testPathPattern "MisClasesView|Iconos|AsignacionesView"` -> **19 failed, 42 passed, 61 total** en 5 suites: `AsignacionesView.test.tsx` (legado, roto a proposito, pendiente de Fase 4) se mantiene exactamente en 19 failed, sin cambios; `AsignacionesView.wizard.test.tsx`, `AsignacionesView.instructorSeleccion.test.tsx`, `MisClasesView.test.tsx` (13/13) y `AsignacionesView.claseActivaHeader.test.tsx` en verde - 0 regresiones.
- tsc --noEmit: limpio en `MisClasesView.tsx` y `components/Iconos.tsx` (0 errores nuevos). Los unicos errores en `MisClasesView.test.tsx` son el mismo ruido preexistente `toBeInTheDocument`/`toHaveBeenCalledWith`/`objectContaining`/`toHaveLength` no-existe-en-`Assertion`/`ExpectStatic` de tipado jest-dom-vs-chai documentado en el cierre de Fase 3.5/3.6, presente por igual en archivos de test no tocados.
- Pendientes exactos: ninguno nuevo. La deuda tecnica ya documentada en la Seccion 4 de este documento sobre `MisClasesView.tsx` (falta de test de "iniciar" a nivel de componente; cerrar desde "Mis clases" no avanza `advanceCiclo()`) sigue igual, no se toco en esta fase. Sigue pendiente Fase 4 (rewrite de `AsignacionesView.test.tsx`) y Fase 5 (cleanup), sin cambios respecto a lo documentado en 3.6.
- Siguiente accion concreta: continuar con Fase 4 (rewrite de `AsignacionesView.test.tsx`), sin cambios de alcance respecto a lo ya documentado - este fix solo toco `MisClasesView.tsx`/`Iconos.tsx`, un componente distinto sin relacion de wiring con `AsignacionesView.tsx` mas alla de ser importado y renderizado tal cual.

### 3.4 Fase 4 - Testing — COMPLETA (2026-07-07)

- `vistas/admin/AsignacionesView.test.tsx` reescrito por completo (de ~1017 lineas de flujos viejos a 22 tests contra el comportamiento real actual): unico punto de entrada del asistente, exclusion de duplicados (incluida la propia asignacion en edicion), pildora de tema editable inline (blur y Enter), hidratacion real de asignaciones tras un reload (`listarAsignacionesPorTenant`) con editar/eliminar reales sobre ids persistidos, destinatario-grupo-grados extremo a extremo, badge de coincidencia de tags en el Paso 1, bridge con Biblioteca (`recursoIdsParaLote`), y CRUD del modal de Programa academico (crear/validar/editar/generar jornadas reales).
- **Bug real y acotado encontrado y corregido durante la escritura de tests** (no una desviacion de diseño, un gap de wiring genuino): `materialesDisponiblesWizard` (useMemo en `AsignacionesView.tsx`) excluia el recurso de la asignacion EN EDICION contra si mismo, tratandolo como duplicado de otra asignacion de la misma clase. Esto dejaba a `AsignarMaterialWizard` sin el recurso real en `materialesDisponibles`, forzando el chip generico "Material asignado" en el Paso 2 en vez del titulo real del material. Fix de una linea: la exclusion ahora filtra `asignacionesClaseActiva` excluyendo la que coincide con `asignacionEditandoWizard?.id` antes de construir el set de ids ya asignados.
- **Decision de consolidacion de archivos de test:** `AsignacionesView.wizard.test.tsx` (Fase 3) fue ABSORBIDO y ELIMINADO — su cobertura es exactamente el alcance central de esta Fase 4 y mantenerlo hubiera duplicado las mismas aserciones en dos archivos. `AsignacionesView.instructorSeleccion.test.tsx` (Fase 3.5, gating de rol Admin/Editor en el selector de Instructor del modal de Programa) y `AsignacionesView.claseActivaHeader.test.tsx` (Fase 3.6, regresion visual/DOM del header de navegacion de clase) se MANTIENEN separados: son sub-flujos narrows y no se solapan con nada de esta reescritura.
- Tests ejecutados (comando + resultado exacto):
  - Baseline previo (confirmado antes de tocar codigo): `npx jest --runInBand --testPathPattern "AsignacionesView.test.tsx"` -> 19 failed, 17 passed, 36 total (identico al reportado en cada fase anterior desde 3.3).
  - RED (archivo reescrito, contra el `AsignacionesView.tsx` sin el fix): `npx jest --runInBand --testPathPattern "AsignacionesView.test.tsx"` -> 1 failed, 21 passed, 22 total (la unica falla es el test de auto-exclusion en edicion, por la razon correcta: mostraba "Material asignado" en vez del titulo real).
  - GREEN (tras el fix de una linea en el useMemo): mismo comando -> **22 passed, 22 total**.
  - Regresion focalizada: `npx jest --runInBand --testPathPattern "AsignacionesView|AsignarMaterialWizard"` -> **46 passed, 46 total** en 4 suites (`AsignacionesView.test.tsx` 22, `AsignacionesView.instructorSeleccion.test.tsx` 4, `AsignacionesView.claseActivaHeader.test.tsx` 2, `AsignarMaterialWizard.test.tsx` 18).
  - Suite completa: `npm run test:app` -> **7 suites / 28 tests fallando** de 114 suites / 937 tests totales. Confirmado que ninguna de las 7 (`vistas/CentroEstudios.test.tsx`, `App.routing.test.ts`, `components/ModalImportacionMasiva.test.tsx`, `components/FilaEstudiante.test.tsx`, `components/ModalRegistrarPago.test.tsx`, `servicios/pagosApi.complementaria.test.ts`, `servicios/academico/bibliotecaService.test.ts`) referencia `AsignacionesView` (grep sin matches) ni fue tocada en esta fase. En particular, `vistas/CentroEstudios.test.tsx` espera un boton "Publicar todo" que ya no existe en NINGUN `.tsx` de produccion (confirmado por grep) — es la misma deuda de Fase 3 (2026-07-06, el mismo commit que rompio a proposito el `AsignacionesView.test.tsx` original) sin relacion con el trabajo de hoy. Documentado como deuda diferida en la Seccion 4, no resuelto aqui por estar fuera de alcance de la Fase 4 (que es exclusivamente `AsignacionesView.test.tsx`).
  - `npx tsc --noEmit`: 0 errores nuevos en `AsignacionesView.tsx` (confirmado con grep exacto sobre la salida). Los errores en `AsignacionesView.test.tsx` (y por igual en los 2 archivos hermanos no tocados) son el mismo ruido preexistente `toBeInTheDocument`/`toHaveBeenCalledWith`/`objectContaining`/etc. "no existe en `Assertion`/`ExpectStatic`" de tipado jest-dom-vs-chai documentado desde Fase 3.5.
- Archivos modificados: `vistas/admin/AsignacionesView.tsx` (fix de una linea), `vistas/admin/AsignacionesView.test.tsx` (reescritura completa), `vistas/admin/AsignacionesView.wizard.test.tsx` (eliminado), `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/tasks.md`, `CIERRE SDD CLAUDE CODE - CENTRO ESTUDIOS.md`, `CIERRE CENTRO DE ESTUDIOS.md`.
- Riesgos o deuda tecnica: la deuda de `vistas/CentroEstudios.test.tsx` (espera "Publicar todo", ya inexistente) queda documentada en la Seccion 4, sin resolver — es una reescritura de alcance comparable a la de hoy pero para OTRO archivo, fuera del scope pedido para esta Fase 4.
- Estado final: COMPLETA
- Siguiente accion concreta: continuar con Fase 5 (Cleanup): confirmar sin cambios necesarios en `functions/academico/asignaciones.js`, correr suite completa + `tsc --noEmit` + `npm run build`, verificacion manual end-to-end en navegador. Considerar tambien, como tarea separada (no parte de esta change), la reescritura de `vistas/CentroEstudios.test.tsx` para alinearlo con el flujo real (mismo tipo de deuda que motivo esta Fase 4, pero en otro archivo).

### 3.5 Fase 5 - Cleanup — COMPLETA (2026-07-07)

- [x] 5.1 Confirmado sin cambios necesarios en `functions/academico/asignaciones.js`: el `.set()` (upsert) de `publishAsignacion` cubre crear y editar, porque `actualizarAsignacion` delega en `publicarAsignacion` reenviando el mismo `id` (confirmado en codigo, no solo en el diseño).
- [x] 5.2 Suite completa (`npm run test:app`), `npx tsc --noEmit`, `npm run build` — mismas 7 suites/28 tests de siempre, 0 nuevas; `tsc` con 2 hallazgos preexistentes sin relacion funcional con este change (ver detalle en Registro de cierre de `CIERRE CENTRO DE ESTUDIOS.md` 11.8); build exitoso.
- [x] 5.3 Verificacion manual con Playwright (Cypress sigue roto) contra la app real corriendo (`npm run dev`) con bypass de auth E2E. Header/tema/wizard-Step1 confirmados visualmente; Steps 2/3 del wizard y grilla de Mis Clases bloqueados por limitacion de entorno (sin sesion real de Firebase Auth) mas un hallazgo nuevo de resiliencia en `MisClasesView.cargar()` (ver Seccion 4).

**Detalle completo de la Fase 5** (comandos exactos, evidencia, hallazgos): ver Registro de cierre de la Seccion 11.8 en `CIERRE CENTRO DE ESTUDIOS.md` — este documento no duplica ese nivel de detalle, solo el resumen de alto nivel.

**Siguiente accion concreta**: correr `sdd-verify` (skill `sdd-verify`) y luego `sdd-archive` para cerrar formalmente la change, igual que se hizo con las 3 anteriores. La change queda funcionalmente completa; el unico pendiente real es el hallazgo de resiliencia en `MisClasesView.cargar()` (Seccion 4), que es deuda preexistente, no bloqueante, y no se resolvio aqui por estar fuera del alcance de la Fase 5 (verificacion, no fix de bugs nuevos descubiertos).

## 3B. Change activa: `clase-en-vivo-checkin-trigger-agenda` (2026-07-08 — planificacion completa, pendiente `sdd-apply`)

**Origen:** auditoria de codigo solicitada por el usuario sobre el modulo "Clase en Vivo" encontro 3 sistemas paralelos desconectados entre si y de `JornadaInstruccion` (fuente de verdad real de Centro de Estudios): Sistema B (`ClaseEnVivoView.tsx`+`claseEnVivoApi.ts`, con un bug de firma confirmado que rompe Iniciar/Cerrar Clase silenciosamente y nunca persiste en Firestore) y Sistema C (`EscanerAsistencia.tsx`, camara QR real pero desconectada de jornada/grado/programa, con su coleccion `asistencia` cayendo en el deny catch-all de `firestore.rules`). Ademas, `App.tsx:76-82` tenia una ventana de activacion placeholder (siempre `true`, sin logica temporal real). Durante la exploracion, el usuario tomo una decision de producto explicita al ver el gap de trazabilidad: la pertenencia estudiante↔jornada **no** se resuelve por inferencia de atributos (grado/grupo del estudiante contra el grupo objetivo de la jornada), porque eso no distingue dos secciones simultaneas del mismo grado (mismo `grupoObjetivo`, distinta `EjecucionPrograma`) — exige en cambio un **roster explicito de matricula** (`InscripcionEjecucionPrograma`) por `EjecucionPrograma`. Despues de esa decision, el usuario entrego `E:\Apps\Tudojang\Módulo Clase en Vivo.txt` como especificacion funcional completa a cumplir (check-in/check-out QR con todos los campos, notificacion a acudientes, checkpoint de materiales, observaciones grupales, ventana dinamica, estados derivados, roles/permisos, 16 casos especiales), con instruccion explicita: aplicar la depuracion PRIMERO (Bloque A) y construir la funcionalidad completa DESPUES (Bloque B), sobre una base ya depurada — no en paralelo ni al reves, para no repetir el problema original de conexiones rotas/multiples fuentes de verdad.

**Ubicacion de artefactos:** `openspec/changes/clase-en-vivo-checkin-trigger-agenda/` (proposal.md, specs/academico-programa/spec.md, specs/academico-clase-en-vivo/spec.md, design.md, tasks.md — sin archivar todavia, change activa).

**Estructura de fases (16, numeradas 0-15, todas con TDD estricto RED→GREEN→VERIFY y `npm test -- --runInBand` en verde antes de cerrar cada una):**

- Bloque A — Depuracion y unificacion (prerrequisito bloqueante):
  - Fase 0: Roster explicito de matricula (BLOQUEANTE — ninguna fase 1-15 arranca sin esta completa y verde)
  - Fase 1: Callable de asistencia server-side (`registrarAsistenciaJornada`)
  - Fase 2: Wiring cierre de jornada (`asistenciaRegistrada` real, no checkbox manual)
  - Fase 3: Rewire de escaneo (`EscanerAsistencia.tsx` + rewrite de `ClaseEnVivoView.tsx`)
  - Fase 4: Ventana dinamica (15/15, anclada a `horaInicio`/`horaFin`) + trigger real de Agenda
  - Fase 5: Archivo del Sistema B (`git mv` a `_archive/`, no borrado)
  - Fase 6: E2E y verificacion manual de Bloque A
- Bloque B — Funcionalidad completa "Clase en Vivo" (deriva 1:1 de `Módulo Clase en Vivo.txt`):
  - Fase 7: Constantes centralizadas cross-runtime (`LIVE_CLASS_OPEN_BEFORE_MINUTES`/`LIVE_CLASS_CLOSE_AFTER_MINUTES`) + validacion de ventana server-side
  - Fase 8: Check-in/check-out completos (todos los campos del `.txt`, calculo de retraso/duracion)
  - Fase 9: Selector de clase multiple filtrado por permisos (paralelizable con 10, 11, 12)
  - Fase 10: Notificacion a acudientes (client-side, reusa mecanismo WhatsApp existente)
  - Fase 11: Checkpoint de materiales en 3 sub-fases + fix de bug pre-existente (ver hallazgo abajo)
  - Fase 12: Observaciones rapidas grupales
  - Fase 13: Estado derivado (`calcularEstadoClaseEnVivo`) + ensamblado visual de las 5 secciones (bloqueada por 9+10+11+12 verdes)
  - Fase 14: Casos especiales (matriz de 16) + metricas consultables
  - Fase 15: E2E y regresion completa Bloque A+B

**Gate bloqueante explicito:** la Fase 7 (inicio de Bloque B) NO arranca hasta que `sdd-verify` confirme 0 regresiones sobre las Fases 0-6 (Bloque A) completas. Motivo documentado en `proposal.md`/`design.md`: construir Bloque B sobre un Bloque A no verificado reproduciria exactamente el problema original (logica de check-in sobre conexiones rotas o multiples fuentes de verdad). El diseño de ambos bloques ya esta completo en `design.md`; lo unico secuencial es la implementacion.

**Hallazgo a preservar (bug pre-existente, no introducido por este change):** `functions/academico/asignaciones.js:89` (`crearServicioPublishAsignacion`) fuerza `estado: 'publicada'` de forma incondicional en cada `set()`, sin merge — si Bloque B reusa este callable para persistir el checkpoint de materiales sobre una asignacion que ya esta `cerrada`/`vencida`, la revertiria silenciosamente a `'publicada'`. Documentado como tareas 11.1-11.2 de `tasks.md` (RED→GREEN: test "actualizar checkpoint sobre asignacion `cerrada` no debe revertir su `estado`"; fix: preservar `estado` existente en updates de doc ya existente, aplicar el default `'publicada'` solo en creacion real).

**Cross-referencias:**
- `CIERRE CENTRO DE ESTUDIOS.md`, Modulo 13 "Clase en Vivo" (agregado en paralelo por otro agente en esta misma sesion) — vision funcional/negocio del mismo trabajo, complementaria a este resumen tecnico SDD.
- Engram: contenido completo persistido bajo `mem_search(topic_key: 'sdd/clase-en-vivo-checkin-trigger-agenda/{proposal|spec|design|tasks}', project: 'tudojang')` seguido de `mem_get_observation(id)` para el texto integro (los resultados de busqueda vienen truncados).

**Siguiente accion concreta:** correr `sdd-apply` arrancando por la Fase 0 (roster explicito de matricula), que es bloqueante de absolutamente todo lo demas — sin roster no hay contra que validar pertenencia estudiante↔jornada, y ninguna tarea de las Fases 1-15 puede iniciar antes de que la Fase 0 este completa y verde.

**Actualizacion de estado (2026-07-08, fuera de orden):** por pedido explicito del usuario se adelantaron 2 tareas de Bloque B, ejecutadas con TDD real ANTES de que arrancara la Fase 0 y sin que el gate Bloque A -> Bloque B (Fase 6, ver arriba) se haya corrido todavia. Esto es una excepcion puntual autorizada por el usuario, no un cambio del orden general del plan — la Fase 0 sigue siendo bloqueante para el resto de las Fases 1-15.

1. **Fix de bug pre-existente `functions/academico/asignaciones.js:89`** (tareas 11.1-11.2, el hallazgo documentado arriba en este mismo apartado): `publishAsignacion` forzaba `estado:'publicada'` incondicionalmente sobre asignaciones ya `'cerrada'`/`'vencida'`. RED con 2 tests nuevos (8 pass/2 fail) -> GREEN con `ESTADOS_TERMINALES` + `get()` previo para preservar el estado terminal (10/10 pass). Archivos: `functions/academico/asignaciones.js`, `functions/academico/asignaciones.test.js`. Estado: COMPLETA.
2. **Servicio server-side de WhatsApp (Meta Cloud API)**, `functions/notificaciones/whatsappCloudApi.js` + `whatsappCloudApi.test.js` (nuevos, 9/9 tests, regresion completa de `functions/` en 76/76). Esto es una **desviacion explicita** de lo planificado para la Fase 10 en la Seccion 13.10 arriba (que preveia reusar el mecanismo client-side existente y prohibia explicitamente un proveedor server-side nuevo, por indicacion del `.txt` original) — el usuario decidio en esta sesion construir el proveedor server-side real porque no existia ninguno. El modulo esta completo en codigo y testeado pero bloqueado para produccion hasta 3 pasos operativos manuales (numero de WhatsApp Business verificado, plantilla `clase_finalizada_notificacion` aprobada por Meta, secrets cargados); todavia no hay callable que lo invoque. Estado: COMPLETA PARA CODIGO, BLOQUEADA PARA PRODUCCION POR CONFIGURACION EXTERNA.

**Registros de cierre completos de ambas tareas** (formato estandar RED/GREEN/REFACTOR/comandos/riesgos): `CIERRE CENTRO DE ESTUDIOS.md`, Modulo 13, subsecciones 13.11 (fix de bug) y 13.10 (servicio WhatsApp), agregados 2026-07-08.

## 4. Deuda tecnica diferida (de changes ya archivadas, no perder de vista)

Estos items fueron encontrados durante verify de changes anteriores, marcados como no-bloqueantes, y quedaron pendientes para el futuro:

- Tests de reglas de Firestore dedicados para `programasAcademicos`/`ejecucionesPrograma`/`jornadas` (hoy la cobertura es indirecta).
- Un test de integracion unico y encadenado que prueba "programa persiste tras recargar" de punta a punta (hoy se prueba componiendo 3 tests separados).
- `MisClasesView.tsx`: la transicion "iniciar" no tiene test a nivel de componente (la funcion pura si esta testeada).
- Limitacion aceptada: cerrar una clase desde "Mis clases" no avanza el ciclo curricular (`advanceCiclo()`) como si lo hace cerrar desde `JornadasView.tsx`, porque `jornadaRepository.ts` no tiene un getter para traer una `EjecucionPrograma` por id. Documentado, no resuelto.
- Escenario de "tituloVisible sin valor cae a nombre" sin test dedicado (solo cubierto incidentalmente).
- **(Fase 3.5, 2026-07-07)** Al remover el selector de Destinatario del wizard (Fix 2, "Si, sacalo"), editar una asignacion vieja con `destinatario.tipo==='estudiante'` la normaliza silenciosamente a `'grupo'` al guardar (ya no hay control en la UI para preservar 'estudiante'). Es el comportamiento pedido explicitamente por el usuario, pero conviene revisar antes/durante la Fase 4 si hace falta una migracion o aviso para asignaciones existentes tipo estudiante.
- Ejecucion real de Cypress: sigue rota en esta maquina (binario corrupto, ver notas de sesiones previas). Toda verificacion E2E de esta linea de trabajo es manual, no automatizada.
- **(Fase 4, 2026-07-07)** `vistas/CentroEstudios.test.tsx` tiene al menos 2 tests rotos (confirmado con `npm run test:app` completo) que esperan el boton "Publicar todo" y el flujo de "Publicacion en lote" que la Fase 3 (2026-07-06) elimino de `AsignacionesView.tsx` — la misma clase de deuda que motivo la reescritura de `AsignacionesView.test.tsx` en esta Fase 4, pero en un archivo distinto, fuera del alcance pedido. Ademas hay otras 6 suites fallando en la corrida completa (`App.routing.test.ts`, `components/ModalImportacionMasiva.test.tsx`, `components/FilaEstudiante.test.tsx`, `components/ModalRegistrarPago.test.tsx`, `servicios/pagosApi.complementaria.test.ts`, `servicios/academico/bibliotecaService.test.ts`) confirmadas sin relacion alguna con `AsignacionesView` (sin referencias cruzadas via grep) ni tocadas por este trabajo — deuda preexistente de otras lineas de trabajo, no diagnosticada en profundidad aqui por estar fuera de alcance.
- **(Fase 5, 2026-07-07, hallazgo — RESUELTO en Fase 5.1, 2026-07-07)** ~~`vistas/admin/MisClasesView.tsx`, funcion `cargar()`: hacia `Promise.all([repository.listarJornadasPorTenant(tenantId), listarAsignacionesPorTenant(tenantId)])` sin ningun `.catch()`; si `listarAsignacionesPorTenant` rechazaba (confirmado en vivo: `permission-denied` sin sesion real de Firebase Auth), el `.then()` nunca corria y `setJornadas` nunca se llamaba, ocultando jornadas que SI existian.~~ Corregido con TDD estricto (RED→GREEN→REFACTOR) en la Fase 5.1 de `unificar-flujo-publicar-material`: `cargar()` ahora resuelve `listarJornadasPorTenant` de forma independiente (fija `jornadas` sin depender de nada mas) y anida la carga de `listarAsignacionesPorTenant` con su propio `.catch()`, que solo hace `console.warn` y deja `materialPorJornadaId` degradado (badge "Sin material asignado") sin afectar la lista de jornadas. Detalle completo (comandos, test nuevo, conteos antes/despues): Registro de cierre 11.9 en `CIERRE CENTRO DE ESTUDIOS.md`.

## 5. Formato obligatorio de registro (usar este bloque al cerrar cada fase)

```md
### YYYY-MM-DD - Claude Code - Change/Fase

- Estado: COMPLETA / PARCIAL / BLOQUEADA
- Archivos modificados:
- Tests ejecutados (comando + resultado exacto):
- tsc --noEmit: (limpio / errores nuevos - cuales)
- Pendientes exactos:
- Siguiente accion concreta:
```

Actualizar la tabla de la Seccion 2 y, si aplica, la Seccion 3 (o crear una nueva subseccion 3.x si es una change distinta) en el mismo commit de trabajo en el que se cierra la fase.
