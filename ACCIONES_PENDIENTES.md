# Acciones pendientes — Tudojang

Registro de todo lo abierto que NO se atendió en la sesión del 2026-07-21, ordenado por
severidad. La sesión se dedicó exclusivamente a **pruebas de integración de Centro de
Estudios** (ver `TEST_REPORT.md`); todo lo de abajo quedó anotado por decisión explícita
del usuario.

---

## 🔴 P0 — Sin verificar contra entorno real

### 0-A. `limiteEstudiantes`: commiteado, pero NUNCA corrido contra el emulador de Firestore

**Estado:** el código está commiteado (`70865de`) y sus tests unitarios pasan (los 197
tests de `functions/academico/estudiantes.test.js` corren dentro de los 263 de Functions).
**Lo que NO se hizo:** correr `npm run test:firestore-rules`, que levanta el emulador real y
valida las reglas de verdad.

Se commiteó **confiando en el diff de otra sesión y en sus tests unitarios**, no en
verificación propia contra reglas reales. Esa es exactamente la clase de confianza que esta
misma sesión demostró que no hay que dar: el fixture de check-ins mentía sobre la forma del
dato y los 9 tests pasaban igual; `RolUsuario.Instructor` no existía y el test pasaba igual.

Concretamente falta confirmar:

1. Que `firestore.rules` bloquee de verdad el `create` directo de cliente sobre
   `estudiantes/{id}` (`allow create: if false`), contra el emulador — no leyendo el diff.
2. Que `components/ModalImportacionMasiva.tsx` pase por la callable `crearEstudiante` y no
   por el write directo. Es el camino que más fácil se saltea el límite: invoca el alta en
   loop, una vez por fila del archivo importado.
3. Que el mensaje de error del límite llegue a la UI de forma legible y no como un código
   crudo de Firebase.

Comando: `npm run test:firestore-rules` (necesita el emulador de Firestore corriendo).

### 0-B. La eliminación de `Login.tsx` quedó en el commit equivocado

Cosmético, pero registrado para que no aparezca como misterio en un `git blame`.

`Login.tsx` (huérfano de febrero con import roto) se eliminó como parte del trabajo de
typecheck, pero el `git rm` quedó en el índice antes de empezar a commitear por temas, así
que la eliminación se arrastró al **primer** commit — `315b262 fix(deploy): planes-config…`,
cuyo mensaje no la menciona. El motivo está anotado dentro del mensaje de `bcb908d`.

La rama `claude/dev-modulos` es **local y sin upstream**, así que reescribir la historia es
seguro si alguien quiere limpiarlo. Se dejó como está para no arriesgar 6 commits ya
verificados por una cuestión estética.

---

## 🔴 P0 — Bloqueante de deploy

### 1. ✅ RESUELTO — `planes-config.json` (eran DOS bloqueantes, no uno)

**Cerrado el 2026-07-22 en `315b262`.** El gitignore era solo la mitad del problema.

| # | Bloqueante | Fix |
|---|---|---|
| 1 | La regla `*.json` lo dejaba **fuera de git**: existía solo en la máquina local, y en clone limpio/CI el build de Vite y las Functions reventaban | Excepción explícita en `.gitignore` |
| 2 | Quedaba **fuera del paquete de Functions**: `firebase.json` declara `"source": "functions"`, así que el deploy sube ÚNICAMENTE esa carpeta. Los `require('../../planes-config.json')` resolvían a la raíz del repo → `MODULE_NOT_FOUND` en cold start → se caían `sedes`, `crearEstudiante` y el cobro automático de Wompi | Se movió el archivo a `functions/planes-config.json` |

Se descartó el paso `predeploy` que copiara el archivo: un solo archivo físico, siempre
empaquetado, no tiene un paso que alguien pueda saltearse en un deploy manual. El frontend lo
importa hacia adentro (`./functions/planes-config.json`), que resuelve porque Vite construye
desde la raíz.

> **Trampa a recordar — localmente SIEMPRE funciona.** `node -e "require(...)"` daba OK
> incluso con el archivo en la raíz, porque la raíz existe en la máquina de desarrollo. La
> única verificación válida es **resolver la ruta y confirmar que cae dentro de
> `<repo>/functions/`**. Repetir ante cualquier `require` nuevo dentro de `functions/`:
> nada fuera de esa carpeta se sube.

<details>
<summary>Detalle original del hallazgo (histórico)</summary>

### 1-bis. `planes-config.json` está gitignoreado y cuatro archivos dependen de él

**Qué pasa:** la sesión anterior centralizó los límites de plan en `planes-config.json`
(raíz del repo) para eliminar las tres copias hardcodeadas. La decisión es correcta. El
problema es que `.gitignore:19` tiene una regla `*.json` que lo captura, así que el archivo
**existe solo en la máquina local y no está trackeado**.

Verificado:

```
$ git check-ignore -v planes-config.json
.gitignore:19:*.json    planes-config.json
$ git ls-files planes-config.json
(vacío — no trackeado)
```

**Consumidores hoy:**

| Archivo | Forma de consumo | Qué rompe si falta |
|---|---|---|
| `constantes.ts:4` | `import planesConfig from './planes-config.json'` | Build de Vite del frontend |
| `functions/academico/estudiantes.js:23` | `require('../../planes-config.json')` | Cloud Function en runtime |
| `functions/academico/sedes.js` | `require` | Cloud Function en runtime |
| `functions/wompiCobroAutomatico.js` | `require` | Cobro automático en runtime |

**Impacto:** en un clone limpio, en CI, o cuando Firebase empaqueta las functions para
deploy, el archivo no existe. El build revienta y las Cloud Functions revientan.

**Fix:** agregar `!planes-config.json` al `.gitignore` y `git add -f planes-config.json`
antes de commitear el WIP. Es una línea, pero sin ella el próximo deploy se cae.

**Nota adicional:** las functions se empaquetan desde `functions/`, así que un `require`
que sube dos niveles (`../../planes-config.json`) hay que verificar que resuelva dentro
del bundle desplegado — no solo que el archivo esté en git.

> Esta "nota adicional" resultó ser el bloqueante grande, no una nota al pie. Ver el bloque
> resuelto de arriba.

</details>

---

## 🟠 P1 — WIP sin commitear, hay que cerrarlo

> **✅ El WIP ya está commiteado (2026-07-22).** Los 30+ archivos que estaban sueltos se
> repartieron en 9 commits temáticos sobre `claude/dev-modulos`, con el árbol limpio y
> verificación completa: typecheck en 0, frontend 1460 pass / 22 fail (las mismas 5 suites
> preexistentes), Functions 263 pass / 0 fail.
>
> Lo único que sobrevive de esta sección es la **verificación contra el emulador** del ítem
> 2, que sigue sin hacerse — promovida a **P0 (ítem 0-A)** arriba, porque commitear no es
> verificar.

### 2. Terminar de verificar el enforcement server-side de `limiteEstudiantes`

Hallazgo #4 de la auditoría de integración (2026-07-18). El límite de alumnos del plan solo
se validaba client-side en `hooks/useGestionEstudiantes.ts:86` — un write directo a
Firestore creaba estudiantes sin límite, incluida la importación masiva.

**Lo que ya está hecho (sin commitear):**
- `functions/academico/estudiantes.js` (127 líneas) — callable `crearEstudiante`
- `functions/academico/estudiantes.test.js` (197 líneas)
- Wiring en `functions/index.js:643`
- Cambios en `firestore.rules` y `servicios/estudiantesApi.ts`

**Lo que falta verificar antes de dar por cerrado:**
- Que `firestore.rules` efectivamente bloquee el `create` directo de cliente sobre
  `estudiantes/{id}` (correr los tests del emulador, no asumirlo del diff).
- Que `components/ModalImportacionMasiva.tsx` pase por la callable y no por el write
  directo — es el camino que más fácil se saltea el límite (invoca el alta en loop).
- Que el mensaje de error del límite llegue a la UI de forma legible.

### 3. Commitear el bloque completo del WIP

22 archivos modificados + 3 sin trackear acumulados sin commitear. Con múltiples sesiones
de IA sobre el MISMO working tree (no worktrees separados) esto es una condición de carrera
esperando ocurrir — ya pasó una vez, documentada en `HANDOVER.md`.

Contenido del bloque: hallazgos #1, #2, #4, #5, #6, #7 de la auditoría + los dos archivos de
integración nuevos de esta sesión.

---

## 🟡 P2 — Deuda de testing conocida

### 4. Suite `vistas/CentroEstudios.test.tsx` — 4 tests rotos, preexistentes

Verificado en esta sesión que **no** los causó el WIP ni el trabajo de integración: se
restauró temporalmente la versión de `MisClasesView.tsx` de HEAD y los 4 fallan idéntico.

```
● CentroEstudios › integra plan y cierre de clase para admin dentro del Centro de Estudios
● CentroEstudios › habilita publicar todo cuando hay material y clase seleccionados
● CentroEstudios › ubica el switcher de pestañas antes del stepper y oculta el stepper fuera de la pestaña "flujo"
● CentroEstudios › refleja en la tarjeta el progreso local guardado al cerrar un quiz aprobado
```

Síntoma del primero: `Unable to find role="group" and name /^recursos aprobados$/i`. El
archivo de test tiene como último commit `f2d16b5` (checkpoint viejo, 12+ commits atrás):
es **drift** — la suite quedó congelada mientras los componentes que monta evolucionaron.
Decidir entre actualizar las queries o retirar los casos que ya no describen la UI real.

### 5. E2E Cypress — PAUSADO explícitamente por el usuario (2026-07-19)

No está a medias por descuido: hay decisión de atenderlo en sesión dedicada. La
investigación ya está completa, **no hace falta repetirla**:

- El checkbox "Asistencia registrada" que el spec clickea **ya no existe en ninguna
  pantalla** — tanto `JornadasView.tsx` como `MisClasesView.tsx` derivan asistencia de
  check-ins QR reales. Un E2E que cierre una jornada necesita un check-in real antes.
- El mecanismo para simular un check-in en modo test (gate `window.Cypress` en
  `asistenciaClaseService.ts`) **solo existía en el worktree ya eliminado**. Habría que
  reconstruirlo.
- No hay script headless (`cypress:run`), solo `cypress:open` (GUI, no sirve para CI).
- Hay **10 specs** en `cypress/e2e/`, solo uno auditado.
- Nadie pudo confirmar que el binario de Cypress corra en un entorno sandboxeado.

Orden acordado si se retoma: (1) decidir si vale reconstruir el check-in simulado,
(2) auditar los 9 specs restantes, (3) crear script headless, (4) recién ahí conectar a CI.

### 6. `App.routing.test.ts` roto hace semanas

Re-etiquetado como "preexistente, no relacionado" sesión tras sesión sin arreglarse ni
borrarse. El import roto (`obtenerRutaInicioUsuario` / `construirUrlCallbackDrive` /
`obtenerCodigoCallbackDrive`, ya no exportados de `App.tsx`) puede estar **escondiendo una
regresión real de ruteo** detrás del ruido de una falla ya conocida. Arreglarlo o borrarlo
— dejarlo en rojo permanente es lo peor de las dos opciones.

### 7. CI no corre ningún test antes de deployar

`.github/workflows/deploy.yml` hace `npm run build` y deploya directo. Todo el testing es
manual/local. Con `npm run test:all` ya incluyendo `test:firestore-rules` (fix del WIP), hay
material suficiente para un gate real de CI.

---

### 4-bis-A. ✅ RESUELTO — Bug de 5 horas entre el scheduler y la ventana de Clase en Vivo

**Encontrado y corregido el 2026-07-22**, en la primera junta que se probó de la cadena de
Clase en Vivo. Es el hallazgo más grave de la sesión.

**El defecto:** `fecha`/`horaInicio`/`horaFin` son texto plano sin zona horaria que el usuario
carga pensando en la hora del dojang. Dos módulos los interpretaban distinto:

| Módulo | Interpretación |
|---|---|
| `functions/academico/jornadasScheduler.js:9` | `America/Bogota` (UTC-5) — documentado explícitamente |
| `servicios/academico/ventanaClaseEnVivoService.ts:25` | **UTC** (`new Date(\`${fecha}T${hora}:00.000Z\`)`) |

**Consecuencia, verificada numéricamente** para una clase cargada 10:00–11:00:

```
Clase cargada por el usuario : 10:00-11:00 (hora Bogota)
Ventana que abre el escaner  : 04:45-06:15 (hora Bogota)  <-- 5h ANTES
Durante la clase real (10:00 Bogota) la ventana esta: CERRADA
```

El botón **"Iniciar Clase en Vivo"** (`App.tsx`, `Horarios.tsx`, `AgendaView.tsx`,
`hubEstudiantesService.ts`) aparecía de madrugada con el dojang cerrado y estaba **ausente
durante la clase real** — es decir, no se podía escanear ningún check-in QR en el único
momento en que hacía falta. El cron marcaba la jornada `en_curso` mientras el botón no estaba.

**Por qué ningún test lo detectaba:** cada módulo es internamente coherente y sus suites
propias pasaban. El defecto vivía EXACTAMENTE en la junta, y solo aparece al cruzar las dos
interpretaciones sobre el mismo dato. Es el caso de manual de por qué las pruebas unitarias
con mocks no sustituyen a las de integración.

**El fix (ciclo RED → GREEN real, no caracterización):**
1. **RED** — `servicios/academico/claseEnVivo.integracion.test.ts` (NUEVO, 8 tests): carga el
   scheduler real vía `require` (CommonJS, sin deps de firebase-admin a nivel de módulo) y el
   servicio de ventana real, y cruza ambos sobre la misma jornada. **7 de 8 fallaron.** El
   único que pasó fue el del scheduler puro — el que no toca la ventana.
2. **GREEN** — `combinarFechaHoraUtc` → `combinarFechaHoraEnZonaDelClub`, con
   `OFFSET_ZONA_CLUB = '-05:00'` (Colombia no tiene horario de verano, offset fijo). 8/8.
3. Se actualizaron las **4 suites** que codificaban el comportamiento UTC —o sea, que
   codificaban el bug—: `ventanaClaseEnVivoService.test.ts` (16 instantes corridos +5h),
   `Horarios.test.tsx`, `hooks/useVentanaClaseEnVivo.test.ts`, `vistas/admin/AgendaView.test.tsx`.

> **Nota de método:** la estimación inicial del radio de impacto fue de 3 suites y resultaron
> 4. Las dos que faltaban (`useVentanaClaseEnVivo`, `AgendaView`) usan el servicio de forma
> indirecta y no aparecían al buscar por nombre de función. **Buscar consumidores por grep de
> símbolo no alcanza: hay que correr la suite completa y comparar contra la línea base.**

**Pendiente relacionado:** `'America/Bogota'` sigue hardcodeado en 3 lugares
(`jornadasScheduler.js`, `vencerAsignacionesAcademicas`, y ahora el offset en
`ventanaClaseEnVivoService.ts`), igual que `LIVE_CLASS_OPEN_BEFORE/CLOSE_AFTER_MINUTES`.
Centralizarlos estaba planificado para la "Fase 7" del change y sigue sin hacerse — mismo
patrón de drift que tenían los límites de plan antes de `planes-config.json`.

### 4-bis-B. ✅ RESUELTO — las tres juntas de Clase en Vivo quedaron cubiertas

**Cerrado el 2026-07-22.** 51 tests de integración en 5 suites, todas en verde.

| Junta | Suite | Qué fija |
|---|---|---|
| #1 escáner → callable → repositorio | `servicios/academico/checkInQr.integracion.test.ts` (14) | Contrato entre los dos SDK + toggle + precondiciones |
| #2 ventana → habilitación del escáner | `vistas/ClaseEnVivoView.integracion.test.tsx` (8) | Qué habilita realmente el escaneo |
| #3 scheduler ↔ ventana horaria | `servicios/academico/claseEnVivo.integracion.test.ts` (8) | Coherencia de zona horaria — **encontró el bug de 5h** |

**La junta #1 cierra el ítem 14 de este documento** (contrato escritor↔lector sin verificar).
`test-utils/fakeFirestore.ts` gana un adaptador con forma de **Admin SDK** sobre el mismo
store, así el callable real (`firebase-admin`, CommonJS) escribe y el repositorio real del
front (`firebase/firestore`, TypeScript) lee el mismo documento. Se respeta a propósito la
diferencia que más fácil se pasa por alto entre ambos SDK: en Admin `snap.exists` es una
**propiedad**, en cliente `snap.exists()` es un **método**.

Verificadas por mutación, no por estar en verde:
- Renombrar `horaEntrada` → `entradaEn` en el callable → **mueren 3** (los del contrato).
- Desactivar `assertInstructorAsignado` → **muere 1** (el de permisos).
- Desactivar la guarda `estado === 'en_curso'` en `ClaseEnVivoView` → **mueren 2**.

### 4-bis-C. 🟡 BRECHA ABIERTA — la ventana horaria es una ayuda de UI, no un límite real

Encontrado al cubrir la junta #2. **Decisión pendiente, no defecto confirmado.**

La ventana `[horaInicio-15, horaFin+15]` gatea el **botón de entrada** ("Iniciar Clase en
Vivo" en `Horarios.tsx` / `App.tsx`). Pero:

- `ClaseEnVivoView` habilita el escáner mirando **solo** `estado === 'en_curso'`.
- El callable `registrarAsistenciaJornada` **tampoco** valida ventana: solo exige
  `estado === 'en_curso'`.

Y nada mueve automáticamente una jornada fuera de `en_curso`: el scheduler solo hace
`confirmada → en_curso`, y la salida es el **cierre manual** desde `MisClasesView`. Entonces
una jornada que el maestro nunca cerró queda **escaneable por URL directa** (bookmark, botón
atrás, link compartido) días después.

El comportamiento actual está fijado por un test marcado `BRECHA CONOCIDA` en
`ClaseEnVivoView.integracion.test.tsx`. Si se decide cerrarla —validando ventana en la vista
y/o en el callable— ese test va a fallar y hay que invertir la expectativa: es exactamente
para lo que está.

Antes de decidir conviene medir cuántas jornadas quedan en `en_curso` sin cerrar en
producción. Si son muchas, el problema real puede ser el cierre manual, no la ventana.

---

<details>
<summary>Estado original de esta sección (histórico, cuando faltaban #1 y #2)</summary>

### 4-bis. Clase en Vivo — pruebas de integración: junta #3 cubierta, faltan #1 y #2

La sesión del 2026-07-21 cubrió dos cadenas de Centro de Estudios (identidad del consultor,
y cierre de jornada). **Clase en Vivo es una tercera cadena y quedó intacta.**

Cada pieza tiene su unitario, ninguna junta está probada:

| Pieza | Unitario | Rol en la cadena |
|---|---|---|
| `functions/academico/jornadasScheduler.js` | ✅ `.test.js` | cron: confirmada → `en_curso` por horario |
| `servicios/academico/ventanaClaseEnVivoService.ts` | ✅ `.test.ts` | ventana ±15 min (`LIVE_CLASS_OPEN_BEFORE/CLOSE_AFTER_MINUTES`) |
| `vistas/ClaseEnVivoView.tsx` | ✅ `.test.tsx` | pantalla del maestro |
| `components/academico/EscanerAsistenciaClase.tsx` | ✅ `.test.tsx` | escáner QR |
| `servicios/academico/asistenciaClaseService.ts` | ✅ `.test.ts` | wrapper del callable |
| `functions/academico/asistencia.js` | ✅ `.test.js` | callable: toggle entrada/salida server-side |

Cadena completa sin cubrir:

```
jornadasScheduler (cron) → jornada en_curso
  → ventanaClaseEnVivoService (±15 min) → indicador "Clase en vivo"
  → ClaseEnVivoView → EscanerAsistenciaClase (QR)
  → asistenciaClaseService.registrarAsistenciaClase()
  → callable registrarAsistenciaJornada (toggle: 1er escaneo entrada, 2do salida, 3ro rechaza)
  → tenants/{t}/jornadas/{j}/asistencias/{estudianteId}
  ────────────────── ACÁ EMPIEZA lo que SÍ se probó ──────────────────
  → asistenciaRepository → contarCheckIns → cierre de jornada
```

Juntas de mayor riesgo, en orden:
1. **Escáner → callable**: el toggle (1er escaneo = entrada, 2do = salida, 3ro rechazado) y
   los rechazos por precondición (`jornada.estado !== 'en_curso'`, estudiante no matriculado
   en la ejecución, instructor no asignado) nunca se ejercieron de punta a punta.
2. **Ventana horaria → habilitación real del escáner**: que la ventana de ±15 min
   efectivamente abra y cierre el escaneo.
3. **Scheduler → ventana**: que la jornada que el cron pasa a `en_curso` sea la misma que la
   ventana considera abierta (mismo huso horario — el scheduler usa `fechaHoraBogota`).

> Las tres se cubrieron. La #3 encontro el desfase de 5 horas.

</details>

### 13-bis. ✅ RESUELTO — script `typecheck` + causa raíz de los 3076 errores

**Hecho el 2026-07-21:**
- `tsconfig.json` — se agregó `cypress.config.ts` al `exclude`. Ese archivo está en la raíz,
  lo capturaba `include: ["**/*.ts"]`, e importaba `cypress`, que arrastra los tipos globales
  de **Chai** y pisaban el `expect` de Jest en TODO el repo (`Property 'toBe' does not exist
  on type 'Assertion'`). El `exclude: ["cypress"]` excluía la carpeta pero no ese archivo.
  **Efecto: 3076 → 86 errores con una línea.**
- `package.json` — nuevo script `"typecheck": "tsc --noEmit"`.

**Deliberadamente NO conectado a `test:all` todavía**: quedan 86 errores reales. Un script
que falla desde el día uno no es una red de seguridad, es ruido que el equipo aprende a
ignorar. Conectarlo recién cuando el contador llegue a 0 (o con un gate de baseline).

### 13-quater. ✅ RESUELTO — typecheck en CERO (3076 → 0) y conectado a `test:all`

**Cerrado el 2026-07-21.** Los 86 se bajaron a 0 y `npm run typecheck` ya está en la cadena
de `test:all` (se conectó recién al llegar a cero, no antes: un gate que nace en rojo enseña
al equipo a ignorar el rojo).

**Regresión verificada:** suite completa de Jest en 1452 pass / 22 fail / 3 skip, exactamente
la misma línea base que antes de tocar nada. Las 5 suites rojas (`FilaEstudiante`,
`ModalImportacionMasiva`, `ModalRegistrarPago`, `pagosApi.complementaria`,
`CentroEstudios.test`) son PREEXISTENTES — comprobado con `git stash` de los archivos
modificados y comparación de conteos con y sin los cambios.

**Segunda causa raíz encontrada (la grande fue `cypress.config.ts`):** el `unknown` en los
parámetros de las interfaces `*RepositoryDeps`. Bajo `strictFunctionTypes` los parámetros son
**contravariantes**, así que una dep declarada `(ref: unknown) => ...` **rechaza** tanto las
funciones reales del SDK de Firestore como los fakes de los tests — exactamente lo contrario
de su propósito. Se pasaron a `any` en `progresoRepository`, `visualizacionRepository`,
`espacioRepository`, `inscripcionRepository`, `jornadaRepository`, `programaRepository` y
`centroEstudiosRepository`.

**Trampa que costó 16 suites en rojo (documentada para que nadie la repita):** los 4 imports
que terminan en `.ts` (`utils/academico/centroEstudios.ts`) **NO son un descuido**. Existe un
puente ESM `utils/academico/centroEstudios.js` y tanto Vite como Jest resuelven `.js` ANTES
que `.ts`, así que un import sin extensión cae en el puente sin transformar. Ver
`CIERRE CENTRO DE ESTUDIOS.md:107-118`. La solución correcta fue
`allowImportingTsExtensions: true` en `tsconfig.json` (legal porque `noEmit: true`), que no
toca una sola línea de runtime.

**Defectos reales que el typecheck destapó, además de los 4 ya listados abajo:**

| Dónde | Qué |
|---|---|
| `FilaEstudiante.test.tsx`, `Finanzas.test.tsx` | Usaban `RolUsuario.Instructor`, que **no existe** en el enum → `undefined`. El test "oculta acciones a no administradores" verificaba contra un valor basura, no contra un rol real. Corregido a `RolUsuario.Maestro` |
| `FilaUsuario.test.tsx` | `rol: 'Administrador'` — rol inexistente (el real es `'Admin'`). Como `obtenerEtiquetaRol` devuelve `String(rol)`, el test verificaba el renderizado de un rol imposible en producción |
| `FormularioImplemento.test.tsx` | `CategoriaImplemento.Protecciones` no existe → la assertion era `toHaveValue(undefined)`, o sea que **no verificaba la categoría en absoluto** |
| `configuracionApi.test.ts` | El fixture inventaba `whatsapp.solicitudInscripcion`, estructura ausente de `ConfiguracionNotificaciones` (el `whatsapp` de `tipos.ts:395` es de `Usuario`), y omitía los 5 campos numéricos obligatorios |
| `FilaEstudiante.test.tsx` | El tutor usaba `nombreCompleto` y `parentesco`, campos que no existen en `Estudiante['tutor']` |
| `FiltrosEstudiantes.test.tsx` | Faltaban `onLimpiar` y `filtrosActivos`, props **obligatorias**: los 6 tests renderizaban con ambas en `undefined`, así que la función de limpiar filtros nunca se ejerció |

### 13-ter. Los 86 errores de tipo que quedan (26 en producción, 60 en tests)

> **✅ Cerrado — ver 13-quater arriba.** Se deja el detalle como registro de lo que había.

Defectos reales confirmados leyendo el código, no ruido de tipos:

| # | Dónde | Qué | Severidad |
|---|---|---|---|
| a | `vistas/admin/MisClasesView.tsx:348` | Pasa `accion: 'restaurar'` a un union que NO lo incluye (`jornadaRepository.ts:68`: `'crear' \| 'confirmar' \| 'iniciar' \| 'cerrar' \| 'cancelar' \| 'actualizar' \| 'eliminar'`). Toda auditoría de "restaurar" escribe un valor fuera del contrato. **Está en el WIP sin commitear.** | Alta |
| b | `servicios/asistenciaApi.ts:113` | `{ id: asistSnap.docs[0].id, ...asistData }` — `asistData` es `Asistencia`, que ya tiene `id`, así que el spread **pisa** el doc-id real de Firestore con el campo almacenado. TS2783. | Alta |
| c | `Login.tsx` (raíz) | Huérfano con import roto (`../components/Iconos` resuelve FUERA del repo). `App.tsx:17` usa `./vistas/Login`. Cero importadores. Mismo patrón que `PerfilTutor.tsx`/`TutorDashboardView.tsx`, ya eliminados. | Media (código muerto) |
| d | `components/academico/MaterialPreviewModal.tsx:339` | Lee `asignacion.driveFileUrl`, propiedad que NO existe en `AsignacionCentroEstudios` → `undefined` en runtime. Está en la cadena de Centro de Estudios. | Media |
| e | `servicios/plantillas.ts:103` | `number \| undefined` pasado a un parámetro `number`. | Media |
| f | 3 archivos | `import ... from '...centroEstudios.ts'` con extensión `.ts` explícita (TS5097) — `asignacionService.ts:25`, `centroEstudiosRepository.ts:6`, `CentroEstudios.tsx:11`. | Baja |
| g | `hooks/useProgresoRepository.ts`, `useVisualizacionRepository.ts`, `CentroEstudios.tsx:171-172`, varios repos | Las `firestoreDeps` se tipan con `unknown` y no aceptan las firmas reales del SDK de Firestore. Ruido estructural repetido, no defecto de runtime. | Baja |

**Falso positivo verificado (NO tocar):** `vistas/RestablecerClave.tsx:159` reporta que
`estado === 'loading'` y `estado === 'success'` no tienen overlap. Es correcto pero
**inofensivo**: `puedeEnviar` (línea 51) ya exige `estado === 'listo'`, y TypeScript aplica
narrowing por alias sobre `!puedeEnviar ||`. El botón SÍ queda deshabilitado durante
loading/success por la primera condición. Es código redundante, no un bug de doble submit.

### 13. `npm test` NO chequea tipos en ningún test del repo

`tsconfig.json` tiene `isolatedModules: true`, así que **ts-jest transpila sin correr el
type checker**. Comprobado en esta sesión: se introdujo a propósito un campo inventado en un
fixture tipado con `satisfies RegistroAsistencia` y los 9 tests pasaron igual; el mismo
código, pasado por `tsc --noEmit` aparte, lo reporta como `TS2353`.

**Consecuencia:** cualquier garantía de tipos en un archivo de test es decorativa hoy. Un
fixture puede mentir sobre la forma de un documento de Firestore y nada falla — que es
exactamente el error que se cometió y se corrigió en
`vistas/admin/MisClasesView.integracion.test.tsx` (sembraba `entradaEn`/`estado` en vez de
`horaEntrada`).

**Opciones:** (a) agregar un script `typecheck` (`tsc --noEmit`) y meterlo en `test:all` y en
CI; (b) configurar `diagnostics` en ts-jest. La (a) es más barata y cubre todo el repo, no
solo los tests.

### 14. El contrato entre el callable que ESCRIBE y el repositorio que LEE no está verificado

`functions/academico/asistencia.js` escribe `{ estudianteId, horaEntrada }` y, en el
check-out, `{ horaSalida, minutosAsistidos }`. `models/academico/asistencia.ts` declara ese
mismo shape para el lado del front, y `asistenciaRepository` lo lee.

**Nada verifica que sigan coincidiendo.** El callable vive en `functions/` (CommonJS, corrido
por `node:test`) y no comparte tipos con el front (TypeScript, corrido por Jest). Si alguien
renombra un campo de un lado, el otro se entera en producción.

Aplica igual a las otras subcolecciones escritas server-side y leídas por el cliente.

---

## 🔵 P3 — Verificación y limpieza

### 8. Drive OAuth: desplegado, sin confirmación end-to-end del usuario

Los commits `168ad98`, `d910975` y `2a53182` son la cadena del fix y quedaron desplegados a
producción. Lo que nunca se confirmó es que un usuario real haya **conectado Drive de punta
a punta** desde tudojang.com. Verificación pendiente, no código pendiente.

### 9. `obtenerAsignaciones` — stub de TDD abandonado en código de producción

`servicios/academico/centroEstudiosRepository.ts:14-21` exporta una función que **lanza un
error a propósito** cuando recibe `tenantId`:

```ts
export const obtenerAsignaciones = async (request: any) => {
  // RED stub: force error when tenantId is provided
  if (request.tenantId) {
    throw new Error('Filtro de tenantId requerido');
  }
  return centroEstudiosRepository.obtenerAsignaciones(request);
};
```

Es andamiaje de un ciclo RED que nunca se limpió. Hoy no lo usa el camino real
(`CentroEstudios.tsx` llama al objeto `centroEstudiosRepository` directamente), pero está
exportado y disponible: cualquiera que lo importe por nombre se come un throw. Verificar
consumidores y borrarlo.

### 10. FIX-0013 — dos plantillas de email huérfanas

`pago_exitoso.html` y `soporte_tecnico.html` existen en `--/` y **ningún código las
referencia** (confirmado por grep en `functions/` y `servicios/`). Candidato natural para
`pago_exitoso.html`: el flujo de confirmación de Wompi.

### 11. `HANDOVER.md` desactualizado

Fechado 17/07, dice que las subtareas 12.10–12.12 del módulo Agenda están pendientes. El
commit `a51205d` ("cierra modulo 12 completo") las cerró. Regenerar o marcar como histórico.

### 12. Copy "Pago único" en add-ons — sin confirmar

Estaba anotado como bug de copy (los add-ons se cobran **mensual recurrente**, no una vez).
Grep en esta sesión encontró un único hit vivo, `vistas/LicenciaSuspendida.tsx:109`, que
habla del plan anual y no de los add-ons. Puede que ya se haya corregido o que el texto
problemático sea otro. **Requiere verificación en la UI real antes de tocar nada.**

---

## Recomendación de orden

1. Fix del `.gitignore` (#1) — 1 línea, desbloquea el deploy.
2. Cerrar y verificar `limiteEstudiantes` (#2), correr regresión, commitear el bloque (#3).
3. Decidir sobre `CentroEstudios.test.tsx` (#4) y `App.routing.test.ts` (#6) — dejar suites
   en rojo permanente entrena al equipo a ignorar el rojo.
4. Con el árbol limpio y verde, conectar CI (#7).
5. Cypress (#5) en la sesión dedicada que ya se acordó.
