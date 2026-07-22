# Acciones pendientes — Tudojang

Registro de todo lo abierto que NO se atendió en la sesión del 2026-07-21, ordenado por
severidad. La sesión se dedicó exclusivamente a **pruebas de integración de Centro de
Estudios** (ver `TEST_REPORT.md`); todo lo de abajo quedó anotado por decisión explícita
del usuario.

---

## ✅ CI — primer run real (#105): el gate funciona

**2026-07-22.** Primer `push` de `claude/dev-modulos` a `origin` → el workflow corrió por
primera vez en GitHub Actions.

**Lo que quedó VALIDADO (no se podía saber sin este run):**

| Comprobación | Resultado |
|---|---|
| El job `pruebas` dispara en una rama que no es `main` | ✅ |
| `build_and_deploy` queda **omitido** (la guarda `if:` funciona) | ✅ — **no hubo deploy** |
| `actions/setup-java@v4` + emulador de Firestore en el runner | ✅ (era el paso más frágil) |
| Typecheck | ✅ 12s |
| Pruebas de la app | ✅ 1m19s |
| Pruebas de Cloud Functions | ✅ |

**Lo que falló, y era un defecto genuino:** `npm run test:node` → el test
`production bundle contains no backend AI secrets` abortaba con *"run npm run build before
this test"*.

Causa: ese test necesita `dist/`, pero el job `pruebas` **no compila** — el build vive en el
otro job, con su propio sistema de archivos. **En local pasaba solo porque quedaba un `dist/`
de un build anterior.** Dependencia oculta en un artefacto, del tipo que únicamente se
manifiesta en un entorno limpio.

**Fix aplicado — el test se movió a donde significa algo:**
- De los 5 tests de `verificar-bundle-seguro.test.js`, **4 escanean el código fuente** (entre
  ellos el de tokens de GitHub) y siguen corriendo en cada rama y PR. Mover el archivo entero
  al job de deploy los habría sacado de ahí: peor el remedio.
- El único que necesita `dist/` ahora **se saltea** si no hay bundle, y el job de deploy lo
  ejecuta explícitamente con `npm run test:bundle-security` **después del build y antes de
  publicar**.

Ese es su único lugar útil: ahí el bundle está compilado **con los secretos reales**.
Compilarlo sin secretos en el job de pruebas lo haría pasar trivialmente — un test que se
aprueba a sí mismo.

Verificado en ambas condiciones antes de pushear:
- sin `dist/` → 7 pass, 1 skip, **0 fail** (lo que necesita CI)
- con `dist/` → 5 pass, **0 skip** (el chequeo se ejecuta de verdad; el skip no es permanente)
- orden de pasos confirmado parseando el YAML: build → verificación → deploy

> **Lección de método:** correr los comandos localmente no alcanza si el entorno local tiene
> artefactos que el runner no tiene. Para replicar CI hay que **quitar** esos artefactos
> (acá: mover `dist/` fuera) y recién ahí correr.

---

## ✅ CI — GATE OPERATIVO (run #107 en verde)

**2026-07-22.** Tras tres iteraciones, el pipeline pasa completo sobre
`claude/dev-modulos`. Por primera vez en la vida del proyecto, **el codigo se valida antes
de poder llegar a produccion.**

Camino recorrido, cada fallo un defecto real:

| Run | Falló en | Defecto que destapó |
|---|---|---|
| #104 | — | El workflow todavía no tenía gate |
| #105 | `test:node` | Test del bundle con dependencia oculta en `dist/` |
| #106 | `test:firestore-rules` | `firebase-tools` invocado como binario global inexistente |
| **#107** | **—** | **✅ verde** |

Lo que ahora corre en cada push y cada pull request, sin tocar producción:

```
typecheck              0 errores
test:app               1506 tests
test:functions:full    263 + 96 tests
test:node              7 tests (+1 skip del bundle, por diseño)
test:firestore-rules   78 tests contra el emulador real
```

### ⚠️ Lo que TODAVÍA no se validó: el camino de deploy

**`build_and_deploy` nunca se ejecutó con la configuración nueva.** En los runs #105–#107 la
rama no era `main`, así que el job quedó correctamente omitido — que es justo lo que
queríamos probar, pero implica que su contenido sigue sin ejercitarse.

Concretamente, el paso **`Verificar que el bundle no filtre secretos`** (agregado en
`97bd782`) **nunca corrió en CI**. Solo se probó en local.

Riesgos del primer merge a `main`:
- Ese paso corre entre el build y el deploy. Si falla, **el deploy no ocurre** — que es el
  comportamiento deseado, pero conviene saberlo de antemano y no descubrirlo con una release
  urgente encima.
- El bundle en CI se compila **con los secretos reales** (a diferencia del local). Es la
  primera vez que ese test se ejecuta sobre un bundle así: si detecta algo, será un hallazgo
  legítimo, no un falso positivo.

**Recomendación:** hacer el primer merge a `main` en un momento tranquilo, no con una
urgencia de por medio.

---

### CI run #106 — `firebase: not found`: los scripts del emulador asumían un CLI global

**2026-07-22.** El fix del bundle funcionó y el job avanzó al paso siguiente, donde falló:

```
sh: 1: firebase: not found
Error: Process completed with exit code 127
```

**Causa:** `firebase-tools` **no es dependencia del proyecto**. Dos scripts de `package.json`
invocaban el binario pelado (`firebase emulators:exec …`), que solo resuelve si el CLI está
instalado globalmente — como en la máquina del desarrollador, no en el runner.

El detalle revelador estaba a la vista: el job de deploy **ya usaba `npx firebase-tools`**,
no `firebase`. La inconsistencia entre ambos era el bug.

**Fix:** `test:firestore-rules` y `test:functions:emulator` pasan a `npx --yes firebase-tools`.
Se corrigieron **los dos**, aunque CI solo ejecuta el primero: el segundo tenía el mismo
defecto latente esperando a que alguien lo corriera en un entorno limpio.

Verificado local: 78/78, exit 0. Y hay evidencia fuerte de que funciona en el runner —
los runs verdes de `main` (#99, #100, #102, #103) ya usaban `npx firebase-tools deploy` ahí.

> **El patrón detrás de estos dos fallos consecutivos (#105 y #106):** ambos fueron
> **suposiciones sobre el entorno** que en local eran ciertas y en un runner limpio no.
> Primero un artefacto (`dist/`), después un binario global (`firebase`). Correr los
> comandos localmente no valida nada de esto — el entorno de desarrollo tiene años de
> sedimento encima. **La única prueba real es un runner limpio.**

---

## 🚨 P0 — PRIMER DEPLOY A PRODUCCIÓN (2026-07-22): dos hallazgos

Tras mergear el PR #2 (48 commits), el deploy corrió por primera vez con la configuración
nueva. **Salió parcial**, y destapó dos problemas distintos.

### ✅ Lo que SÍ quedó en producción
- **Frontend completo**, incluido el fix del desfase horario de Clase en Vivo.
- **~30 Cloud Functions**, entre ellas `crearEstudiante` (creada) y `registrarAsistenciaJornada`.

### ❌ Hallazgo 1 — Permiso IAM faltante (5 funciones programadas)

```
HTTP Error: 403, The principal lacks IAM permission "cloudscheduler.jobs.update"
```

Fallaron: `cobroAutomaticoMensual`, `iniciarJornadasPorHorario`,
`recordatoriosEstudioDiarios`, `recordatoriosPagoDiarios`, `vencerAsignacionesAcademicas`.

**No es un defecto del código.** La cuenta de servicio de CI no puede actualizar trabajos de
Cloud Scheduler. **Impacto: ninguno** — esas 5 siguen ejecutando su versión anterior y el log
confirma `Skipping deletes`.

**Fix (manual, en Google Cloud):** otorgar a la service account de `FIREBASE_SERVICE_ACCOUNT`
el rol **Cloud Scheduler Admin** (`roles/cloudscheduler.admin`) en
`https://console.cloud.google.com/iam-admin/iam?project=tudojang`.

> ### ⚠️ SIGUE PENDIENTE — el verde del run #116 es engañoso
>
> El run #116 (merge del PR #3) salió **completamente verde, incluido el paso de functions**,
> pero **el permiso NO se otorgó**. Confirmado con el usuario.
>
> Explicación más probable (inferencia, no verificada contra las tripas de Firebase): en el
> run #113 el CÓDIGO de esas 5 funciones sí se actualizó; lo que falló fue el paso siguiente,
> sincronizar sus horarios en Cloud Scheduler (`upsert schedule`). En el #116 el código de
> esas funciones era **idéntico** al ya desplegado — entre ambos merges solo cambió el archivo
> del workflow — así que Firebase no detectó cambios y **ni siquiera intentó tocar los
> horarios**. Sin llamada a la API, sin 403.
>
> **Conclusión: el problema está dormido, no resuelto.** El 403 vuelve en cuanto se modifique
> cualquiera de esas 5 funciones, se cambie un cron, o se toque `functions/index.js` de forma
> que las alcance. Y volverá en el peor momento: desplegando un cambio real con apuro.
>
> Una de las cinco es **`cobroAutomaticoMensual`** — el cobro de mensualidades. No es una
> función que convenga no poder actualizar.
>
> **Otorgar el permiso igual, aunque hoy el pipeline esté verde.**
>
> ### ✅ PERMISO OTORGADO (2026-07-22) — pendiente de verificación real
>
> Se agregó el rol **Administrador de Cloud Scheduler** a
> `firebase-adminsdk-fbsvc@tudojang.iam.gserviceaccount.com`, que es la cuenta que usa CI
> para desplegar (se identificó por sus roles: Firebase Admin, Cloud Functions Admin,
> Storage Admin, Secret Manager Admin — y por NO tener ningún rol de Cloud Scheduler, que
> es exactamente lo que explicaba el 403).
>
> **Estado honesto: otorgado, NO verificado.** Como el código de esas 5 funciones no cambió,
> Firebase va a seguir sin tocar sus horarios y un *Re-run* daría verde por la misma razón
> que el #116 — no porque el permiso funcione. La confirmación real llega sola la próxima
> vez que se modifique alguna de las 5 y el deploy pase sin el 403.
>
> Es una medida **preventiva**: se hizo ahora para que no explote después, no para verla
> funcionar hoy.
>
> ### 🔵 Higiene de seguridad detectada de paso (NO urgente, no tocar sin analizar)
>
> La consola marca en rojo dos cuentas con rol **Editor**, un permiso enorme y heredado:
>
> | Cuenta | Aviso de Google |
> |---|---|
> | `545628702717-compute@developer.gserviceaccount.com` | 11742/11747 permisos excedidos |
> | `tudojang@appspot.gserviceaccount.com` | 11746/11746 permisos excedidos |
>
> Bajarles el rol puede romper cosas si algún servicio depende de ellas. Analizar antes de
> tocar; queda anotado como deuda, no como acción inmediata.

### 🔴 Hallazgo 2 — Las reglas NUNCA se desplegaban (el paso mentía)

El paso se llamaba **"Deploy Functions and Rules"**, pero su comando era
`firebase deploy --only functions`. **Las reglas nunca se publicaron desde CI.**

Gravedad: se descubrió justo después de publicar `crearEstudiante`, la función que valida el
límite de alumnos. La función quedó viva en producción, pero la regla que cierra la puerta
trasera —`allow create: if false` sobre `estudiantes/{docId}`— **no**. Es decir: un write
directo del cliente seguía creando estudiantes sin límite.

**Es exactamente el agujero que verificamos contra el emulador con 78 tests en verde.**
Verificamos la regla correcta; nunca llegaba al servidor. Un test puede estar impecable y aun
así no proteger nada si el artefacto no se despliega.

`firebase.json` declara además **índices de Firestore** y **reglas de Storage**, que tampoco
se desplegaban nunca.

**Fix aplicado:** paso nuevo `Deploy Firestore rules, indexes y Storage rules` con
`--only firestore:rules,firestore:indexes,storage`, y el de functions renombrado a lo que
realmente hace.

> **Va ANTES que las functions a propósito:** hoy el paso de functions falla por el permiso de
> Cloud Scheduler, y un paso posterior a uno fallido no se ejecuta. Poniéndolo antes, las
> reglas se publican igual. No hay ventana de rotura por el orden: `crearEstudiante` ya está
> en producción.

---

## 🚨 P0 — INTEGRIDAD DEL REPOSITORIO

### 0-Y. Dos objetos de git corruptos en `.git/objects` — reparados, causa NO identificada

**Encontrado el 2026-07-22** al intentar el primer push. No era un problema de
autenticación: la autenticación funcionó y el push murió al enviar los objetos.

```
error: inflate: data stream error (incorrect header check)
fatal: loose object b27632001a88dc7d2920ab918bae63fa470b893a is corrupt
error: unable to unpack header of .git/objects/0d/df00f...
```

Ambos objetos correspondían a archivos **intactos en el working tree**, así que la
reparación fue sin pérdida:

| Objeto corrupto | Archivo | Recuperado |
|---|---|---|
| `0ddf00f…` | `openspec/changes/clase-en-vivo-checkin-trigger-agenda/tasks.md` | ✅ |
| `b27632…` | `vistas/admin/MisClasesView.tsx` | ✅ |

**Método de reparación** (sirve para cualquier objeto suelto corrupto cuyo contenido siga
existiendo en disco):

1. Identificar qué archivo produce ese hash: `git hash-object <archivo>` y comparar.
2. **Mover** el objeto corrupto a un respaldo (no borrarlo).
3. `git hash-object -w <archivo>` — regenera el objeto con el mismo hash.
4. `git fsck --full` para confirmar.

Resultado: `git fsck` limpio, 41 commits intactos, push exitoso. Los archivos corruptos
originales quedaron respaldados en el scratchpad de la sesión.

> ### ✅ URGENTE RESUELTO — todo el trabajo salió del disco que falla (2026-07-22)
>
> Antes de cualquier otra cosa se midió qué se perdería si el disco muriera hoy: **14 commits
> existían únicamente en `E:`**, sin copia en ningún otro lado.
>
> | Rama | Commits únicos | Respaldo |
> |---|---|---|
> | `backup-wompi-hoy` | 8 | ✅ pusheada a `origin` |
> | `stable-wompi-patched` | 1 | ✅ pusheada a `origin` |
> | `codex/asistente-hibrido-catalogo` | 5 | ✅ bundle en **C:** (otro disco físico) |
>
> Las otras cuatro ramas locales (`claude/dev`, `fix-wompi-stable`, `worktree-clase-en-vivo`,
> `main`) tenían **0 commits únicos** — ya estaban enteras en el remoto. Sin stashes.
>
> **Por qué `codex/asistente-hibrido-catalogo` no pudo ir a GitHub:** contiene `Tudojang.rar`
> de **230,73 MB** commiteado, y el límite de GitHub por archivo es 100 MB. Se respaldó como
> bundle verificado (`git bundle verify` → *"records a complete history"*) en:
>
> ```
> C:\Users\William Pardo\Respaldo-Tudojang\codex-asistente-hibrido-catalogo.bundle
> ```
>
> Restaurar con: `git fetch <bundle> codex/asistente-hibrido-catalogo:<rama-local>`.
>
> > **Deuda anotada:** ese `.rar` en el historial vuelve esa rama impusheable para siempre
> > salvo reescritura de historia (`git filter-repo`) o Git LFS. Decidir junto con el destino
> > de esos 5 commits.
>
> ---
>
> ## 🔴 CAUSA IDENTIFICADA (2026-07-22): EL DISCO ESTÁ FALLANDO
>
> **La hipótesis inicial —sesiones de IA en paralelo— era INCORRECTA.** Se descartó con
> evidencia directa.
>
> **Prueba irrefutable:** el objeto `0ddf00f` no contenía un stream zlib truncado (que es lo
> que dejaría un git interrumpido). Sus primeros bytes eran **texto plano ASCII**:
>
> ```
> 20 20 20 20 7d 20 3d 20    →    "    } = "
> ```
>
> El contenido resultó ser código de **`node_modules/pdfjs-dist/.../pdf_viewer.mjs`**
> (`this.pageView.viewport`, `MOVEMENT_THRESHOLD`, `paddingLeftSize`).
>
> **Un fragmento de un archivo se escribió dentro de otro archivo.** Git no puede hacer eso.
> Dos procesos git en paralelo tampoco: dejarían objetos válidos o archivos de lock. Meter el
> contenido del archivo A dentro del archivo B es **corrupción a nivel de sistema de
> archivos**.
>
> **Confirmado en el registro de eventos de Windows (últimos 14 días):**
>
> | Fecha | Evento | Significado |
> |---|---|---|
> | 13/07 15:13 | `Ntfs` 55 en **E:** | Daño en la estructura del sistema de archivos |
> | 13/07 15:13 | `Ntfs` 55 en **G:** | Ídem |
> | 13/07 15:20 | `Ntfs` 130 en **E:** | Windows lo "reparó" |
> | **14/07 06:47** | `disk` 7 ×2 en `\Device\Harddisk2` | **Bloques defectuosos** |
> | 21/07 10:32 | `Ntfs` 55 en **D:** | Daño otra vez |
>
> **Y las tres unidades son el MISMO disco físico:**
>
> ```
> D:, E:, G:  ->  DiskNumber 2  ->  Hitachi HDS721050CLA362 (HDD mecánico)
> \Device\Harddisk2 (el de los bloques defectuosos)  ->  ese mismo disco
> ```
>
> El repositorio vive en **E:**. La corrupción de los objetos de git es un **síntoma de un
> disco que se está degradando**, no un problema de git ni de flujo de trabajo.
>
> Windows reporta `HealthStatus: Healthy` porque SMART no cruzó un umbral, pero bloques
> defectuosos + corrupción NTFS repetida en las tres particiones dicen otra cosa.
>
> ### Qué hacer, por orden de urgencia
>
> 1. **Respaldar todo lo que viva en D:, E: y G:.** El repo ya está en GitHub (`origin`), pero
>    cualquier otra cosa en ese disco no tiene respaldo.
> 2. **Mover el proyecto a un SSD.** Hay dos disponibles: `KINGSTON SA400S37240G` (C:) y
>    `CT240BX500SSD1`. Trabajar sobre un disco con bloques defectuosos es garantía de que esto
>    vuelva a pasar.
> 3. `chkdsk E: /f /r` con permisos de administrador (requiere acceso exclusivo; con `/r` en
>    un HDD puede tardar horas).
> 4. Revisar SMART con permisos de administrador:
>    `Get-PhysicalDisk -DeviceNumber 2 | Get-StorageReliabilityCounter` — mirar sectores
>    reasignados y errores no corregidos.
> 5. **Planificar el reemplazo del Hitachi.** Es un disco mecánico que ya perdió bloques.
>
> ### Consecuencia para el repositorio
>
> Los dos objetos dañados se recuperaron porque su contenido seguía en el working tree. **Eso
> fue suerte, no diseño.** Si la corrupción hubiera tocado un objeto de un commit viejo sin
> copia en disco, se habría perdido. Correr `git fsck --full` periódicamente mientras el
> proyecto siga en ese disco.

---

## 🚨 P0 — SEGURIDAD, acción inmediata

### 0-Z. Token de GitHub en texto plano en la URL del remoto

**Encontrado el 2026-07-22** al preparar el push. `.git/config` tiene el remoto `origin`
configurado como:

```
https://William-Pardo:<TOKEN_ghp_...>@github.com/William-Pardo/tudojang.git
```

Un **Personal Access Token de GitHub con permisos de escritura**, embebido en texto plano.
Cualquiera con acceso al disco, a un backup, o a la salida de un `git remote -v` lo tiene.

**Agravante:** el token quedó impreso en la transcripción de la sesión al ejecutar
`git remote -v`. Debe considerarse **comprometido**, no solo mal guardado.

**Qué SÍ se verificó (buenas noticias):**
- ❌ No aparece en ningún archivo trackeado (`git grep ghp_`).
- ❌ No aparece en el historial de commits (`git log --all -S ghp_`).
- Es decir: la exposición es local + transcripción, **no está en el repositorio**.

**Remediación, en este orden:**

1. **Revocar el token** en `github.com/settings/tokens`. Primero esto; todo lo demás espera.
2. Sacar la credencial del remoto:
   ```
   git remote set-url origin https://github.com/William-Pardo/tudojang.git
   ```
3. Autenticar sin credenciales embebidas: `gh auth login`, Git Credential Manager, o SSH
   (`git@github.com:William-Pardo/tudojang.git`).
4. Recién entonces pushear.

**Push realizado el 2026-07-22**, ya con el token rotado y el remoto limpio. La rama
`claude/dev-modulos` existe en `origin` con los 41 commits. Detalle de la remediacion
efectiva: se ejecuto `git config --global credential.helper manager` y
`git remote set-url origin https://github.com/William-Pardo/tudojang.git`. El primer
intento fallo con *"Invalid username or token"* porque el Credential Manager tenia
cacheada la credencial VIEJA (el token ya revocado) y la uso sin preguntar; se limpio con
`printf "protocol=https
host=github.com

" | git credential reject`.

**Decision original (superada):** no se hizo push. Los 39 commits de esta sesión quedan **solo en la
máquina local** hasta que el token esté rotado. Es un riesgo asumido a conciencia: pushear
con un token comprometido para "salvar el trabajo" habría sido cambiar un problema por otro.

**Mitigación parcial agregada:** `scripts/verificar-bundle-seguro.test.js` gana un test que
detecta patrones de token de GitHub (`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`/`github_pat_`) en las
fuentes del repositorio. Verificado por mutación (con un token falso: falla; sin él: pasa).

> **Alcance honesto de ese test, para no crear falsa sensación de seguridad:** cubre los
> ARCHIVOS DEL REPOSITORIO, no `.git/config` — ese archivo no está versionado y varía por
> clone, así que ningún test de contenido puede vigilarlo. **NO habría detectado este
> hallazgo.** Lo que sí evita es el modo de falla adyacente y más grave: que un token quede
> commiteado, donde vive para siempre en el historial aunque después se borre el archivo.

---

## 🔴 P0 — Sin verificar contra entorno real

### 0-A. ✅ VERIFICADO — `limiteEstudiantes` contra el emulador real (2 de 3 puntos OK)

**Cerrado el 2026-07-22.** `npm run test:firestore-rules` corrido contra el emulador de
Firestore real: **78 tests, 78 pass, 0 fail** (Firebase CLI 15.22.1, Java 21).

> Como la salida quedó truncada por un `tail` en la invocación, la cobertura se probó
> contando: `firestore-rules.security.test.js` declara 4 tests y
> `firestore-rules.behavior.test.js` declara 74 → 78 declarados = 78 corridos = 78 pasando,
> con 0 fallos. No queda margen para que alguno se haya salteado.

| # | Qué había que confirmar | Resultado |
|---|---|---|
| 1 | `firestore.rules` bloquea el `create` directo de cliente sobre `estudiantes/{id}` | ✅ Verificado contra el emulador: `assertFails(setDoc(...))` con rol Admin. `update`/`delete` siguen permitidos por `isInstructor()`, también verificado |
| 2 | La importación masiva pasa por la callable y no por el write directo | ✅ Cadena verificada eslabón por eslabón: `ModalImportacionMasiva` → `useEstudiantes()` → `context/DataContext.tsx:290` → `estudiantesApi.agregarEstudiante` → callable `crearEstudiante` |
| 3 | El error del límite llega a la UI de forma legible | ❌ **NO llega ningún mensaje** — ver ítem 0-C |

**Nota sobre la calidad de la cobertura:** de los dos tests que tocan este fix, uno es un
`assert.match` de **regex sobre el texto de `firestore.rules`** (verifica que el archivo diga
`allow create: if false`, no que se cumpla) y el otro es un test de comportamiento real
contra el emulador. El que da garantía es el segundo. El primero sirve como candado contra
ediciones accidentales del archivo, no como verificación de enforcement — conviene no
confundirlos al leer el reporte.

**Residuo operativo (REPRODUCIBLE, no fue casualidad):** cada corrida de
`npm run test:firestore-rules` deja un `java.exe` escuchando en 8080/9150. El log dice
`Firestore Emulator has exited upon receiving signal: SIGINT` y sin embargo la JVM
sobrevive. Se confirmó en **dos corridas seguidas** (PIDs 16072 y 20684).

Consecuencia: la corrida siguiente falla con `Could not start Firestore Emulator, port taken`
y parece un fallo de tests cuando es basura de la anterior.

Cómo distinguir un emulador de pruebas de uno de desarrollo antes de matarlo (Windows):

```powershell
(Get-CimInstance Win32_Process -Filter 'ProcessId=<PID>').CommandLine
```

Si trae `--project_id demo-tudojang` es de las pruebas y se puede matar sin riesgo; un
emulador de desarrollo usaría el proyecto real. En CI da igual (el runner es efímero), pero
en local conviene chequear el puerto antes de correr la suite completa.

### 0-E. ⚠️ El gate de CI está escrito pero NUNCA se ejecutó en GitHub Actions

**Agregado el 2026-07-22.** `.github/workflows/deploy.yml` gana un job `pruebas` del que
`build_and_deploy` depende (`needs: pruebas`). Antes el pipeline hacía `npm run build` y
deployaba directo: **ni un solo test corría antes de publicar a producción.**

Los cinco comandos del job se verificaron **uno por uno localmente** antes de wirearlos:

| Comando | Resultado local |
|---|---|
| `npm run typecheck` | 0 errores |
| `npm run test:app` | 1506 pass |
| `npm run test:functions:full` | 263 + 96 pass |
| `npm run test:node` | 7 pass |
| `npm run test:firestore-rules` | 78 pass (emulador real) |

> **Lo que NO se pudo verificar:** GitHub Actions no se puede ejecutar desde acá. El YAML
> es válido y el grafo de dependencias es correcto (comprobado parseándolo), pero **la
> primera corrida real es la prueba de fuego**. Riesgos concretos a vigilar en ese primer
> run:
> - `actions/setup-java@v4` + descarga del emulador de Firestore en el runner (paso más
>   frágil; nunca corrió en CI).
> - Tiempo total: localmente la cadena tarda ~7 min. Si el runner es más lento, evaluar
>   partir el job o cachear el emulador.
> - `npm install` (no `npm ci`) se mantuvo por consistencia con el job de deploy existente.
>
> Si el primer run falla en el paso del emulador y hay urgencia de deployar, la salida
> mínima es quitar ese último paso del job — los otros cuatro ya dan un gate real.

**No se hizo push, y ahora hay un motivo mas fuerte:** ver el ítem 0-Z (token de GitHub
comprometido). La rama `claude/dev-modulos` sigue local, con 39 commits sin respaldar en
ningún remoto.

> **✅ Disparadores ampliados (2026-07-22).** El workflow ahora corre en cualquier rama y
> en pull requests, no solo en `main`. Como el trigger es a nivel de workflow y alcanza a
> AMBOS jobs, `build_and_deploy` lleva un `if:` explícito que lo restringe a push sobre
> `main` y a ejecuciones manuales. **Sin ese `if`, abrir un PR deployaría a producción.**
>
> Matriz verificada simulando la condición contra cada tipo de evento:
>
> | Evento | `pruebas` | `build_and_deploy` |
> |---|---|---|
> | push a `main` | ✅ | ✅ |
> | push a otra rama | ✅ | no |
> | pull request | ✅ | no |
> | ejecución manual | ✅ | ✅ |
>
> Se agregó además un bloque `concurrency` que cancela corridas obsoletas en ramas de
> trabajo pero **nunca en `main`**: interrumpir un deploy a mitad de camino es peor que
> gastar unos minutos de Actions.
>
> Con esto, pushear `claude/dev-modulos` (una vez rotado el token, ítem 0-Z) ya alcanza
> para ver correr el gate completo sin tocar producción.

### 0-D. Restos del flujo de "publicación en lote", ya retirado del producto

Encontrado el 2026-07-22 al reparar `vistas/CentroEstudios.test.tsx`. El flujo de publicación
en lote (grupo "Recursos aprobados" en Biblioteca → "Agregar seleccionados al lote" →
región "Publicación en lote" → botón "Publicar todo") **no existe en ninguna parte del repo**
— verificado por búsqueda en toda la app. Se eliminó en el rediseño de Centro de Estudios.

Quedó código muerto: `agregarRecursoParaLote` sigue definido en `vistas/CentroEstudios.tsx`
pero **no se pasa a ningún hijo**, así que `recursosParaLote` nunca se puebla y el prop
`recursoIdsParaLote` que recibe `AsignacionesView` siempre llega vacío. Decidir si se retira
el resto del cableado o si el flujo vuelve.

### 0-C. ✅ RESUELTO — la importación masiva ya reporta las filas rechazadas

**Cerrado el 2026-07-22**, con ciclo RED → GREEN real (comportamiento nuevo, no
caracterización): 3 tests escritos primero, 2 en rojo, luego el fix.

Comportamiento nuevo en `components/ModalImportacionMasiva.tsx`:

| Caso | Mensaje | Severidad |
|---|---|---|
| Ninguna fila rechazada | `Importación Exitosa: N alumnos registrados.` | `success` |
| Rechazos genéricos | `Se registraron X de N alumnos. K filas no se pudieron importar.` | `error` |
| Rechazo por límite de plan | `Se registraron X de N alumnos.` + el mensaje textual del límite | `error` |

El límite del plan se distingue por `code` conteniendo `resource-exhausted` (lo lanza el
callable `crearEstudiante`; `httpsCallable` lo entrega como `functions/resource-exhausted`).
Es el único motivo **accionable** para el operador —subir de plan o comprar un addon—, así
que su mensaje textual reemplaza al conteo genérico. Además se registra el número de fila del
Excel en cada fallo (la 1 es el encabezado, la primera de datos es la 2) para que sean
ubicables en el archivo.

> **Hallazgo del camino:** el test `continúa la importación aunque una fila falle` afirmaba
> `'Importación Exitosa: 1 alumnos registrados.'` con severidad `success` **mientras una de
> las dos filas fallaba**. No estaba roto: estaba **codificando el defecto**. Se corrigió la
> expectativa junto con el código.

### 0-C-bis. Detalle original del hallazgo (histórico)

**Encontrado el 2026-07-22** verificando el punto 3 del ítem 0-A. Es una consecuencia
directa del fix del límite que acabamos de shipear, y hace falta atenderlo con él.

`components/ModalImportacionMasiva.tsx` (~línea 229):

```js
for (const row of datosRaw) {
    try {
        await agregarEstudiante(payload as any);
        exitos++;
    } catch (e) { console.error("Error en fila:", e); }   // <- se traga el error
}
mostrarNotificacion(`Importación Exitosa: ${exitos} alumnos registrados.`, "success");
```

**Escenario:** un club importa 200 alumnos con un plan que permite 50. Resultado en pantalla:
un cartel **verde** que dice *"Importación Exitosa: 50 alumnos registrados"*. Las 150 filas
rechazadas desaparecen sin rastro visible — solo un `console.error` que nadie mira. El
operador queda creyendo que los 200 están en el sistema.

**Lo incómodo:** antes del enforcement server-side, los 200 entraban. Era un bug, pero
ruidoso. Ahora el comportamiento correcto (rechazar por límite de plan) llega envuelto en un
mensaje que dice "Exitosa". **El fix cambió un bug visible por uno silencioso.**

La cadena de creación sí quedó bien — verificada eslabón por eslabón:
`ModalImportacionMasiva` → `useEstudiantes()` → `context/DataContext.tsx:290` →
`estudiantesApi.agregarEstudiante` → callable `crearEstudiante`. El límite **se aplica**. Lo
que falla es exclusivamente el reporte al usuario.

**Fix sugerido:** contar los fallos, distinguir el error de límite de plan del resto, y
elegir el tipo de notificación según el resultado (`success` solo si no hubo fallos;
`warning`/`error` si los hubo, con el detalle de cuántas filas y por qué).

> **Cuidado al tocarlo:** `components/ModalImportacionMasiva.test.tsx` es **una de las 5
> suites que ya están en rojo** en la línea base. Cualquier cambio en ese componente implica
> entrar a esa suite; conviene arreglarla primero o al menos entender por qué falla, para no
> confundir fallos nuevos con los preexistentes.

> **Resuelto tal cual se sugirió.** La advertencia se cumplió al pie: primero se repararon
> las 5 suites de la línea base, y recién con el árbol en verde se tocó el componente.

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

### 4-quater. ✅ CUBIERTA — cadena de Biblioteca (importar → clasificar → aprobar → publicar)

**Hecho el 2026-07-22.** `servicios/academico/biblioteca.integracion.test.ts`, 13 pruebas.
Es el paso 1 del Centro de Estudios y alimenta a todos los demás, así que cierra la junta
con la publicación que ya estaba cubierta (`publicarMaterial.integracion.test.ts`).

```
importFromDrive() → updateFicha() → approveRecurso() → listarRecursosAprobados()
                                                          ↓
                            publishAsignacion() exige estado === 'aprobado'
```

Verificado por mutación: desactivar la guarda de ficha (1 test rojo) y desactivar la
deduplicación de importación (2 tests rojos).

**Dos hallazgos de contrato que la UI no transparenta:**

| # | Hallazgo | Por qué importa |
|---|---|---|
| a | `archiveRecurso` **solo acepta recursos ya aprobados** — cualquier otro estado lanza "Transición inválida". El flujo real es importar → clasificar → aprobar → archivar. | No se puede archivar un recurso mal clasificado sin aprobarlo antes. Si eso no es lo deseado, es un bug de diseño del flujo, no del código. **Sin decidir.** |
| b | `youtubeVideoId` **no va dentro de la ficha académica**: es el 5º parámetro de `updateFicha`, junto a `tituloVisible`. | Pasarlo dentro de la ficha no lanza error y no persiste nada. Falla silenciosa: el video queda sin id y el recurso se publica igual, con `youtubeVideoId: null`. Vale revisar si algún llamador de producción lo hace mal. **Sin auditar.** |

**Arreglo de infraestructura:** `test-utils/fakeFirestore.ts` no soportaba `doc(collectionRef)`
sin segmentos (id autogenerado, que es lo que hace `importFromDrive`). El path quedaba
apuntando a la colección y el documento se escribía donde ninguna consulta lo encontraba.

### 4-quinquies. 🟡 ABIERTO — cadenas de Centro de Estudios que siguen SIN integración

Con Biblioteca cerrada, el inventario de cadenas queda así:

| Cadena | Estado | Suite |
|---|---|---|
| Identidad del consultor | ✅ | `vistas/CentroEstudios.integracion.test.tsx` |
| Cierre de jornada | ✅ | `vistas/admin/MisClasesView.integracion.test.tsx` |
| Clase en Vivo (3 juntas) | ✅ | `claseEnVivo` + `checkInQr` + `ClaseEnVivoView` |
| Publicación de material | ✅ | `servicios/academico/publicarMaterial.integracion.test.ts` |
| Generación de jornadas | ✅ | `servicios/academico/generacionJornadas.integracion.test.ts` |
| **Biblioteca** | ✅ | `servicios/academico/biblioteca.integracion.test.ts` |
| **Quizzes** (crear → responder → métrica) | ✅ | `servicios/academico/quiz.integracion.test.ts` |
| **Progreso / métricas** (visualización → analítica) | ❌ | — |
| **Agenda** (`AgendaView`, `ModalEdicionJornada`) | ❌ | — |
| **Identidad del acudiente** (vínculos) | ✅ | `servicios/academico/vinculoIdentidad.integracion.test.ts` |

Total actual de integración: **10 suites, 115 pruebas.**

Faltan dos: **Agenda** y **Progreso / métricas**.

### 4-septies. 🔴 BUG CRÍTICO ENCONTRADO Y CORREGIDO — el correo del acudiente no se normalizaba en la importación masiva

**Encontrado el 2026-07-22** escribiendo `vinculoIdentidad.integracion.test.ts` (12 pruebas).
Es la causa raíz, o al menos una causa raíz viva, del síntoma histórico *"el padre entra y no
ve nada"* (memoria **Tutor role broken end-to-end**).

#### La cadena

```
alta del estudiante  → estudiantes/{id}.tutor.correo   ← se guardaba TAL CUAL
createInvitation()   → normaliza el email a MINÚSCULAS y crea la cuenta Auth
login del acudiente  → usuario.email  (minúsculas, viene de Auth)
resolveLinkedStudent → where('tutor.correo', '==', emailNormalizado)
```

La consulta de igualdad de Firestore es **exacta y sensible a mayúsculas**. Un documento
guardado con `"Papa@Gajog.com"` **nunca** matchea `"papa@gajog.com"`. El padre recibe la
invitación, activa la cuenta, entra… y ve una pantalla vacía. **Sin error, sin log, para
siempre.** El sistema de invitaciones, al normalizar, *garantiza* el desencuentro.

#### Ningún eslabón de escritura normalizaba

| Eslabón | ¿Normalizaba `tutor.correo`? |
|---|---|
| `components/ModalImportacionMasiva.tsx:232` | ❌ — pero el correo del **alumno** sí, línea 219, **en el mismo objeto literal** |
| `context/DataContext.tsx:288` → `api.agregarEstudiante` | ❌ |
| `servicios/estudiantesApi.ts:124` → callable | ❌ |
| `functions/academico/estudiantes.js` | ❌ — hacía spread textual del payload |
| `hooks/useGestionEstudiantes.ts:112-120` (formulario de admin) | ✅ — **el único** |

O sea: el alta por formulario quedaba bien y **la importación masiva quedaba rota** — que es
justo como un club da de alta 100 alumnos de una.

#### Un test verde certificaba lo contrario

`servicios/academico/tutorStudentResolver.test.ts:78` se llama **"es case-insensitive en el
email"**, siembra `'Papa@Test.com'`, y pasa en verde. Corre en **modo mock**
(`isFirebaseConfigured = false`, línea 63), y el mock hace `.toLowerCase()` **de los dos
lados**. La rama de Firestore no puede hacer eso. **El mock es más indulgente que producción,
y el test certificaba una insensibilidad a mayúsculas que producción nunca tuvo.** Tercera
aparición del patrón "test verde certificando el defecto".

#### Arreglo aplicado

- `functions/academico/estudiantes.js` — `normalizarCorreos()` sobre `correo` y `tutor.correo`.
  Va acá porque el callable `crearEstudiante` es el **único punto** por el que pasan todas las
  altas; normalizar sólo en el cliente deja el agujero abierto a cualquier otro llamador.
  4 pruebas nuevas en `functions/academico/estudiantes.test.js`; mutación verificada.
- `components/ModalImportacionMasiva.tsx:232` — `.toLowerCase().trim()`, por simetría con la
  línea 219 y como defensa en profundidad.

#### 🟠 MIGRACIÓN DE DATOS — script listo, FALTA CORRERLO

**El arreglo del alta NO toca los documentos existentes.** Todo estudiante ya creado con un
`tutor.correo` en mayúsculas (o con espacios) **sigue invisible para su acudiente**. No hay
forma de resolverlo desde la lectura: una consulta de igualdad de Firestore no puede ser
case-insensitive sin un campo ya normalizado.

**Script:** [`scripts/normalizar-correos.js`](scripts/normalizar-correos.js) — 15 pruebas en
`scripts/normalizar-correos.test.js`, que corren solas en CI vía `npm run test:node`.

```bash
# 1) DIAGNÓSTICO — no escribe nada. Es el modo por defecto, a propósito.
GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
  node scripts/normalizar-correos.js --proyecto tudojang

# 2) APLICAR — recién después de leer el diagnóstico.
GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
  node scripts/normalizar-correos.js --proyecto tudojang --aplicar
```

Garantías, todas cubiertas por pruebas:

| Garantía | Prueba |
|---|---|
| Dry-run por defecto: sin `--aplicar` **cero** escrituras | `migrar: en DRY-RUN no escribe absolutamente nada` |
| Idempotente: la segunda corrida no cambia nada | `migrar: es IDEMPOTENTE` |
| `update` con field path anidado — no pisa `tutor.nombres`/`telefono` | `migrar: con --aplicar … deja el resto del tutor intacto` |
| Sólo toca los documentos que hace falta | `migrar: no toca los documentos que ya estaban bien` |
| `--tenant` acota a un solo club | `migrar: acotado por --tenant …` |
| Reporta colisiones de correo de alumno sin resolverlas solo | `migrar: reporta las colisiones …` |

**Paso que falta y que es el bloqueante real:** correr el **diagnóstico** contra producción
para saber cuántos documentos están afectados. Hasta que ese número no se conozca, no se sabe
si la demo a padres funciona o no.

**A verificar antes de aplicar:** si al normalizar dos alumnos distintos quedan con el mismo
`correo`, el script lo reporta y **no** lo resuelve — hay que decidir a mano cuál registro
vale. (Colisiones en `tutor.correo` son normales: un padre con dos hijos.)

Fijado por caracterización en `vinculoIdentidad.integracion.test.ts` (bloque *"Caracterizacion:
un correo GUARDADO con mayusculas deja al padre sin ver a su hijo"*): esas 3 pruebas dejan por
escrito el silencio, para que nadie lo redescubra desde cero.

#### La suposición de "todo en minúsculas" también está en las REGLAS

No es sólo la consulta del cliente. `firestore.rules` compara los mismos correos como strings,
y ahí también la igualdad es sensible a mayúsculas:

| Línea | Comparación |
|---|---|
| `firestore.rules:182` | `isTutor() && resource.data.tutor.correo == request.auth.token.email` |
| `firestore.rules:183` | `isEstudiante() && resource.data.correo == request.auth.token.email` |
| `firestore.rules:489,496` | lo mismo, vía `get()` sobre el doc del estudiante, para notificaciones |
| `firestore.rules:71-72` | `vinculos/$(request.auth.token.email + "_" + uid)` — el id del vínculo se arma concatenando el email crudo del token, mientras `vinculoService.linkTutorEstudiante` lo construye con el email **ya en minúsculas** |

O sea que con un correo guardado en mayúsculas fallan **las dos capas por la misma razón**: la
consulta no encuentra el documento y la regla tampoco lo autorizaría. Toda la cadena de
identidad asume minúsculas, y hasta este fix un solo camino de alta lo garantizaba.

**A verificar antes de la migración:** qué exactamente pone Firebase Auth en
`request.auth.token.email` (¿respeta la capitalización del registro o normaliza?). La
migración tiene que dejar los datos calzando con ese valor, no con una suposición.

### 4-sexies. ✅ CUBIERTA — cadena de Quiz (configurar → responder → métrica del acudiente)

**Hecho el 2026-07-22.** `servicios/academico/quiz.integracion.test.ts`, 14 pruebas.

```
QuizEditorModal → quizService.guardarQuiz(tenantId, recursoId, …)
                     → tenants/{t}/quizzes/{recursoId}
MaterialPreviewModal → quizService.obtenerQuiz(tenantId, asignacion.recursoId)
                     → QuizView.enviar() → evaluarQuiz()
                            ├→ progresoRepository.guardarQuiz()   (reanudar intento)
                            └→ actividadService.registrarActividad()
                                 → actividadLogs + metricasEstudiante → panel del acudiente
```

Verificado por mutación: escritura real de `quizService` ignorando el tenant (2 tests rojos)
y recálculo de métricas sin filtro por estudiante (1 test rojo).

#### 🐞 BUG ENCONTRADO Y CORREGIDO — `scoreUltimaEvaluacion` devolvía el PRIMER intento

`calcularScoreUltimoQuiz` (`servicios/academico/actividadService.ts`) hacía:

```ts
.sort((a, b) => b.registradoEn.localeCompare(a.registradoEn))[0]
```

`registradoEn` es un ISO con precisión de **milisegundos** y `Array.sort` es **estable**: ante
dos logs con el mismo timestamp el comparador devuelve 0, se conserva el orden de entrada, y
quedaba elegido el **primer** intento. Una función llamada "último quiz" devolviendo el primero.

**Cómo se encontró:** la prueba pasó 13/13 al primer intento, lo cual dio desconfianza. Cinco
corridas seguidas → 1 en rojo. El empate de milisegundos era el culpable.

**Por qué importa en producción y no es sólo un test flaky:** `registradoEn` se sella con el
reloj del **dispositivo**. Un atraso de hora entre dos intentos (sincronización NTP, cambio
manual, cambio de zona) basta para invertir el orden y dejar al acudiente viendo congelado un
score viejo. Además `analisisProgresoService.ts:91` promedia `scoreUltimaEvaluacion` para las
métricas por programa, así que el error se propagaba hacia arriba.

**Arreglo:** recorrido con `>=` que deja ganar al último de la lista ante empate (orden de
llegada, tanto en el store en memoria como en la query ordenada por `registradoEn`). Prueba de
regresión con reloj congelado: `con timestamps EMPATADOS, la ultima evaluacion sigue siendo la
ultima registrada`. 5 corridas consecutivas en verde.

#### 🟡 SIN DECIDIR — "asignación completada" no distingue aprobar de reprobar

`calcularPorcentajeConsumo` devuelve **100** apenas existe un log de tipo quiz ("intentarlo
cuenta como consumir el material"), y `asignacionesCompletadas` cuenta todo lo que tenga
consumo `>= 80`. Resultado: **un estudiante que saca 0% aparece con la asignación COMPLETADA.**

El dato del score sí queda registrado (`promedioScoreEvaluaciones`), así que la información no
se pierde — pero el rótulo "completadas" mezcla "abrió el material" con "lo aprobó", y es justo
el número que el acudiente lee primero. Fijado como prueba de **caracterización** (documenta el
comportamiento actual, no lo bendice). **Requiere decisión de producto, no de código.**

#### 🟡 SIN RESOLVER — fallo de Firestore indistinguible de "quiz sin configurar"

`MaterialPreviewModal.tsx:166-169`: el `catch` de `obtenerQuiz` hace `console.warn` y setea
`preguntasQuiz = null`, que es **el mismo valor** que "nunca se configuraron preguntas". La UI
entonces muestra *"Este quiz todavía no tiene preguntas configuradas — un Admin o Maestro puede
cargarlas desde la Biblioteca"* aunque el admin sí las haya cargado y lo que falló sea la red.

Menos grave de lo que parecía a primera vista: **no** cae a la pregunta demo hardcodeada, así
que no se registra un score contra un quiz falso. Pero es la **sexta** aparición del patrón del
proyecto: fallo real disfrazado de estado benigno.

#### Nota de método

Una mutación que hice primero (`claveMock` ignorando el tenant) tocó la rama **mock** del
servicio, que la suite de integración no ejecuta (corre con `isFirebaseConfigured: true`). Dio
1 test rojo — pero de `quizService.test.ts`, no de la suite nueva. **Una mutación que rompe
otra suite no valida la tuya.** Hay que mutar la rama que el test realmente recorre.

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
