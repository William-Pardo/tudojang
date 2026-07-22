# Cierre Drive Picker, carpeta activa y demo vs real

Fecha: 2026-06-30

## Objetivo

Cerrar el hueco de UX posterior a OAuth: Drive ya conectaba correctamente, pero la Biblioteca seguia mostrando archivos demo y no dejaba claro que faltaba seleccionar la carpeta institucional.

## Estado antes del cambio

- OAuth `drive.file` ya funcionaba.
- La UI mostraba `Estado: conectado` y un `connectionId`.
- La Biblioteca seguia mostrando `Fundamentos tecnicos.pdf` y `Patada frontal.mp4`, que eran mocks internos.
- No existia una diferencia suficientemente clara entre:
  - modo demo sin Drive real;
  - Drive conectado sin carpeta activa;
  - Drive conectado con carpeta real listada.

## Cambios implementados

- `vistas/admin/BibliotecaView.tsx` ya no inicializa `archivosDrive` con mocks cuando existe conexion real.
- Si Drive no esta conectado, la vista conserva el modo demo y lo etiqueta como `Demo sin Drive real`.
- Si Drive esta conectado pero no hay carpeta activa, la vista muestra un estado vacio accionable: falta seleccionar carpeta institucional.
- Si Drive esta conectado y hay carpeta activa, se listan archivos reales desde `listDriveFolder`.
- La carpeta activa se persiste por tenant en `localStorage["tudojang:driveFolder:<tenantId>"]`.
- Al recargar la app, si existen `driveConnection` y `driveFolder`, la vista lista automaticamente la carpeta persistida.
- Se agrego soporte opcional para Google Picker con scope `https://www.googleapis.com/auth/drive.file`.
- Se agrego desconexion real con confirmacion: la UI llama `disconnectDrive`, limpia estado local y el backend marca conexiones activas como `disconnected`.

## Ajuste UX posterior

Se simplifico el flujo operativo de Drive para evitar acciones duplicadas o ambiguas:

- El boton principal ahora funciona como switch:
  - sin conexion: `Conectar Google Drive`;
  - con conexion activa: `Desconectar Google Drive`.
- La desconexion solo aparece cuando existe conexion activa y mantiene confirmacion previa para evitar desconexiones accidentales.
- La seleccion de carpeta por Google Picker queda como accion principal cuando Drive esta conectado.
- La validacion por link o ID de carpeta queda como metodo avanzado, oculto por defecto bajo `Usar link o ID de carpeta`.
- Cuando Drive no esta conectado, no se muestra el formulario de URL/ID; la UI indica que primero debe conectarse Google Drive.
- El boton `Validar carpeta Drive` ya no queda visible en un estado inutil antes de conectar Drive.

## Persistencia Firestore de carpeta activa

Se implemento persistencia compartida de la carpeta institucional activa para escenarios multi-admin:

- La carpeta activa ya no depende solo de `localStorage`.
- Al seleccionar carpeta por Picker o validar por URL/ID, el frontend llama `setDriveFolder`.
- `setDriveFolder` guarda `activeFolderId` y `folderId` en la conexion Drive activa del tenant:
  - `tenants/{tenantId}/driveConnections/{connectionId}.activeFolderId`
  - `tenants/{tenantId}/driveConnections/{connectionId}.folderId`
- Al montar Biblioteca, el frontend llama `getDriveConnection`.
- Si Firestore tiene `activeFolderId`, se sincroniza a la UI y se cachea localmente.
- `localStorage` queda como cache rapido para evitar parpadeos, no como fuente unica de verdad.
- Al desconectar Drive, backend elimina `folderId` y `activeFolderId` de la conexion desconectada.

Funciones nuevas:

| Funcion | Tipo | Proposito |
|---------|------|-----------|
| `getDriveConnection` | callable | Devuelve si el tenant tiene conexion activa y su `activeFolderId`. |
| `setDriveFolder` | callable | Persiste la carpeta institucional activa en Firestore. |

Permisos:

- `getDriveConnection`: `Admin`, `SuperAdmin`, `Maestro`, `Editor` del mismo tenant.
- `setDriveFolder`: `Admin` o `SuperAdmin`.
- No se amplio el scope OAuth. Se mantiene `https://www.googleapis.com/auth/drive.file`.

## Google Picker

Picker queda como capacidad del frontend. Para activarlo en el build se requieren variables publicas:

```env
VITE_GOOGLE_PICKER_API_KEY=<api-key-publica-con-restricciones-http>
VITE_GOOGLE_PICKER_CLIENT_ID=<oauth-client-id-web>
VITE_GOOGLE_PICKER_APP_ID=<google-cloud-project-number-opcional>
```

Si estas variables no existen, el boton `Seleccionar carpeta en Drive` queda deshabilitado y la app conserva el flujo alterno por link/ID de carpeta.

En el despliegue del 2026-06-30 se construyo Hosting con:

- `VITE_GOOGLE_PICKER_CLIENT_ID` tomado del secret `GOOGLE_CLIENT_ID`.
- `VITE_GOOGLE_PICKER_API_KEY` tomado de la API key publica Firebase del proyecto.
- `VITE_GOOGLE_PICKER_APP_ID` derivado del project number.

## Razon tecnica

El proyecto mantiene los refresh tokens de Drive exclusivamente en Cloud Functions. Google Picker requiere un token temporal de navegador para abrir el selector visual, pero ese token no se persiste ni se usa para descargas. El backend sigue operando con `drive.file` y con los tokens guardados de forma segura en Firebase.

## Validacion local

```powershell
npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx
npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx services/storage/driveService.test.ts
npx jest --runInBand --testMatch "**/functions/academico/drive.test.js" --testPathIgnorePatterns "node_modules"
npm run build
```

Resultado:

```text
PASS vistas/admin/BibliotecaView.test.tsx
PASS services/storage/driveService.test.ts
Test Suites: 2 passed
Tests: 29 passed

PASS functions/academico/drive.test.js
Test Suites: 1 passed
Tests: 56 passed

vite build: OK
```

## Deploy

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='30000'
firebase deploy --project tudojang --only functions:disconnectDrive,hosting
```

Resultado:

```text
functions[disconnectDrive(us-central1)] Successful create operation.
hosting[tudojang] release complete.
```

## Handoff para Opus / otra IA

Este bloque existe para evitar reprocesos. Antes de continuar cualquier mejora relacionada con Google Drive, leer completo este archivo y luego revisar solo los archivos listados abajo.

### Resultado ya implementado

| Area | Estado | Archivo principal |
|------|--------|-------------------|
| OAuth Drive `drive.file` | Implementado y funcional. El usuario ya pudo autorizar Drive y volver a la app. | `functions/academico/drive.js`, `services/storage/driveService.ts` |
| Callback OAuth | Implementado en backend. La SPA ya no reutiliza el `code` directamente. | `functions/academico/drive.js`, `vistas/admin/BibliotecaView.tsx` |
| Persistencia conexion | Implementada por tenant. Frontend usa `localStorage["tudojang:driveConnection:<tenantId>"]`. | `vistas/admin/BibliotecaView.tsx` |
| Desconexion Drive | Implementada con confirmacion. Backend marca conexiones activas como `disconnected`. | `functions/academico/drive.js`, `vistas/admin/BibliotecaView.tsx` |
| Demo vs real | Implementado. Si no hay Drive real, la UI muestra demo claramente. Si hay Drive conectado sin carpeta, muestra estado vacio accionable. | `vistas/admin/BibliotecaView.tsx` |
| Carpeta activa | Implementada en frontend por tenant usando `localStorage["tudojang:driveFolder:<tenantId>"]`. | `vistas/admin/BibliotecaView.tsx` |
| Google Picker | Implementado como seleccion primaria de carpeta cuando Drive esta conectado. | `vistas/admin/BibliotecaView.tsx` |
| URL/ID de carpeta | Conservado como metodo avanzado oculto por defecto. | `vistas/admin/BibliotecaView.tsx` |
| UX boton Drive | Implementado como switch unico: conectar si no hay conexion, desconectar si existe conexion. | `vistas/admin/BibliotecaView.tsx` |

### Flujo UX actual esperado

1. Usuario entra a `https://tudojang.com/#/centro-estudios`.
2. Si Drive no esta conectado:
   - ve `Conectar Google Drive`;
   - ve modo demo;
   - no ve el campo de URL/ID;
   - no ve `Validar carpeta Drive`.
3. Usuario conecta Drive y acepta permisos.
4. Al volver a Centro Estudios:
   - ve `Estado: conectado`;
   - ve `Desconectar Google Drive`;
   - ve `Seleccionar carpeta en Drive`;
   - todavia no debe listar archivos reales hasta elegir carpeta.
5. Usuario selecciona carpeta con Picker:
   - se guarda `tudojang:driveFolder:<tenantId>`;
   - se lista la carpeta real con `listDriveFolder`.
6. Si el usuario prefiere URL/ID:
   - pulsa `Usar link o ID de carpeta`;
   - pega el link o ID;
   - pulsa `Validar carpeta Drive`.
7. Si desconecta:
   - aparece confirmacion;
   - se limpia conexion y carpeta local;
   - vuelve modo demo.

### Archivos que debe revisar Opus primero

1. `docs/CIERRE_DRIVE_PICKER_DEMO_REAL.md`
2. `docs/DEBUG_DRIVE_OAUTH_CENTRO_ESTUDIOS.md`
3. `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`
4. `vistas/admin/BibliotecaView.tsx`
5. `vistas/admin/BibliotecaView.test.tsx`
6. `services/storage/driveService.ts`
7. `services/storage/driveService.test.ts`
8. `functions/academico/drive.js`
9. `functions/academico/drive.test.js`

No empezar por buscar en todo el repo. Primero leer esos archivos.

### Validacion que ya paso

```powershell
npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx services/storage/driveService.test.ts
```

Resultado:

```text
PASS vistas/admin/BibliotecaView.test.tsx
PASS services/storage/driveService.test.ts
Tests: 26 passed
```

```powershell
npm run build
```

Resultado: OK.

Deploy aplicado:

```powershell
firebase deploy --project tudojang --only hosting
```

Resultado: OK.

Deploy de persistencia Firestore aplicado:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='30000'
firebase deploy --project tudojang --only functions:getDriveConnection,functions:setDriveFolder,functions:disconnectDrive,hosting
```

Resultado:

```text
functions[getDriveConnection(us-central1)] Successful create operation.
functions[setDriveFolder(us-central1)] Successful create operation.
functions[disconnectDrive(us-central1)] Successful update operation.
hosting[tudojang] release complete.
```

### Decision importante: `drive.file`

No cambiar a scopes mas amplios sin aprobacion. La decision vigente es mantener `https://www.googleapis.com/auth/drive.file` porque reduce friccion de verificacion Google y limita permisos.

Consecuencia tecnica:

- Google Drive solo debe exponer archivos/carpetas que el usuario haya seleccionado o autorizado para la app.
- Un link compartido puede fallar si esa carpeta no fue autorizada antes para la app.
- Por eso Picker es la ruta primaria.
- URL/ID queda como alternativa avanzada, no como camino principal.

### Pendientes posibles para Opus

Estos son los puntos donde Opus puede continuar sin repetir trabajo:

1. Verificar en navegador real que `Seleccionar carpeta en Drive` abre Google Picker en produccion.
2. Si Picker no abre:
   - verificar que el build desplegado incluyo:
     - `VITE_GOOGLE_PICKER_CLIENT_ID`;
     - `VITE_GOOGLE_PICKER_API_KEY`;
     - `VITE_GOOGLE_PICKER_APP_ID`;
   - verificar restricciones de API key en Google Cloud;
   - verificar errores de consola relacionados con `gapi`, `picker`, `origin` o `developerKey`.
3. Mejorar copy visual:
   - cambiar texto de `Conectar Google Drive` a `Conectar Drive institucional` si se busca lenguaje mas institucional;
   - mantener significado operativo.
4. Evaluar persistencia de carpeta activa en Firestore, no solo `localStorage`, si se requiere que la carpeta quede compartida entre admins del mismo tenant.
5. Agregar estado explicito `Carpeta no seleccionada` y ayuda breve:
   - "Drive esta conectado. Ahora selecciona la carpeta institucional que contiene tus materiales."
6. Si se implementa persistencia Firestore:
   - hacerlo por tenant;
   - agregar reglas Firestore;
   - agregar test de seguridad;
   - migrar lectura inicial desde Firestore y dejar `localStorage` solo como cache.

### No repetir

No volver a implementar:

- OAuth base.
- `driveOAuthCallback`.
- `disconnectDrive`.
- distincion demo vs real.
- boton switch conectar/desconectar.
- ocultamiento de URL/ID como metodo avanzado.
- pruebas base de `BibliotecaView`.

### Criterio de cierre de la siguiente mejora

Una mejora posterior solo debe considerarse cerrada si:

- Picker abre en produccion.
- Se puede seleccionar carpeta real.
- La carpeta queda visible como activa.
- Se listan archivos reales o se muestra error claro si Drive no devuelve archivos.
- Desconectar limpia estado y vuelve a demo.
- Tests enfocados pasan.
- Build pasa.
- Si hay deploy, se documenta comando y resultado.

## Diagnostico produccion: `The API developer key is invalid`

Fecha: 2026-06-30.

Resultado observado en produccion:

- El boton `Seleccionar carpeta en Drive` ya esta habilitado.
- Google Picker intenta abrir.
- La ventana de Picker muestra: `There was an error! The API developer key is invalid.`

Interpretacion:

- OAuth Drive no es el problema en este punto.
- El frontend ya esta llegando a Google Picker.
- La `developerKey` publica usada por Picker no es aceptada por Google.
- La causa esperada esta en Google Cloud:
  - Google Picker API no habilitada para la API key usada; o
  - restricciones de API de la key no incluyen Google Picker API; o
  - restricciones HTTP referrer no aceptan los origenes reales de produccion.

Ajuste de codigo aplicado:

- `PickerBuilder` ahora usa `.setOrigin(window.location.origin)` para declarar explicitamente el origen web.
- Tests frontend siguen pasando.
- Hosting fue desplegado con este ajuste.

Validacion aplicada:

```powershell
npm run test:app -- --silent vistas/admin/BibliotecaView.test.tsx services/storage/driveService.test.ts
npm run build
firebase deploy --project tudojang --only hosting
```

Resultado:

```text
Tests: 29 passed
vite build: OK
hosting[tudojang] release complete.
```

Accion pendiente en Google Cloud:

1. Ir a Google Cloud Console > APIs y servicios > Biblioteca.
2. Confirmar que `Google Picker API` esta habilitada en el proyecto `tudojang`.
3. Ir a APIs y servicios > Credenciales.
4. Editar la API key usada como `VITE_GOOGLE_PICKER_API_KEY` o crear una API key nueva exclusiva para Picker.
5. En restricciones de aplicacion, permitir como HTTP referrers:
   - `https://tudojang.com/*`
   - `https://www.tudojang.com/*`
   - `https://tudojang.web.app/*`
   - `https://docs.google.com/*`
6. En restricciones de API, permitir `Google Picker API`. Si la consola exige APIs adicionales para este flujo, permitir tambien `Google Drive API`.
7. Si se crea una key nueva, actualizar `VITE_GOOGLE_PICKER_API_KEY` en `.env.local`, reconstruir y desplegar Hosting.

## Rotacion de API key Picker

Fecha: 2026-06-30.

Se creo una API key nueva exclusiva para Google Picker desde Google Cloud Console y se actualizo:

```env
VITE_GOOGLE_PICKER_API_KEY=<picker-web-key-nueva>
```

Validacion y deploy:

```powershell
npm run build
firebase deploy --project tudojang --only hosting
```

Resultado:

```text
vite build: OK
hosting[tudojang] release complete.
```

Prueba manual pendiente:

- Abrir `https://tudojang.com/#/centro-estudios`.
- Pulsar `Seleccionar carpeta en Drive`.
- Confirmar que ya no aparece `The API developer key is invalid`.
- Seleccionar carpeta real y verificar que se guarde como carpeta activa.

## Cambio de scope para listar carpetas completas

Fecha: 2026-06-30.

Hallazgo en produccion:

- Picker ya abre correctamente.
- El usuario puede seleccionar una carpeta.
- Al intentar listar contenido, `listDriveFolder` responde 403.
- Causa: `drive.file` no autoriza de forma confiable listar todos los hijos de una carpeta seleccionada. Autoriza elementos creados/abiertos por la app, pero no equivale a lectura completa de la carpeta institucional.

Decision:

- Cambiar el consentimiento OAuth y Picker a:

```text
https://www.googleapis.com/auth/drive.readonly
```

Razon:

- Centro Estudios necesita listar recursos dentro de una carpeta institucional.
- Tambien necesita generar URLs temporales de lectura para materiales.
- `drive.file` es insuficiente para este flujo de biblioteca por carpeta.

Impacto operativo:

- Las conexiones Drive ya existentes quedan con el refresh token anterior (`drive.file`).
- Despues del deploy, el admin debe:
  1. `Desconectar Google Drive`.
  2. `Conectar Google Drive`.
  3. Aceptar el nuevo permiso de lectura.
  4. Seleccionar carpeta.

Sin reconexion, Google seguira devolviendo 403 porque el token viejo no tiene `drive.readonly`.

## Incidente activo 2026-07-01: Picker selecciona carpeta pero `listDriveFolder` sigue en 403

### Estado de Google Auth Platform

Captura del usuario en Google Cloud Console > Google Auth Platform > Centro de verificacion:

- `Branding status`: la informacion de marca esta en proceso de revision.
- `Requisitos de la pagina principal`: aprobado.
- `Requisitos de la politica de privacidad`: aprobado.
- `Lineamientos de desarrollo de la marca`: aprobado.
- Mensaje de Google: el equipo de Confianza y Seguridad recibio el formulario; la revision puede tardar de 4 a 6 semanas y el primer correo puede llegar en 3 a 5 dias.
- Nota operativa: esta revision de marca no explica por si sola el 403 de `listDriveFolder`. El 403 ocurre despues de que OAuth/Picker ya dejaron seleccionar carpeta y corresponde al acceso efectivo del token backend contra la API de Drive.

### Error vigente reportado por el usuario

En la app:

```text
Permisos insuficientes en Drive para listar esta carpeta. Si acabas de cambiar permisos, desconecta y vuelve a conectar Google Drive para autorizar el nuevo alcance de lectura.
```

En consola:

```text
VM5 userinfo.email openid&authuser=0&prompt=consent:13 SW registrado ServiceWorkerRegistration
...
picker?...&origin=https%3A%2F%2Ftudojang.com&oauth_token=<redactado>&developerKey=<redactado>&hostId=tudojang.com&appId=545628702717...
[Violation] Permissions policy violation: unload is not allowed in this document.
us-central1-tudojang.cloudfunctions.net/listDriveFolder:1 Failed to load resource: the server responded with a status of 403 ()
```

Importante:

- No conservar ni pegar URLs completas de Picker en documentacion o chat porque contienen `oauth_token`.
- El aviso `Permissions policy violation: unload is not allowed in this document` proviene del iframe/Picker y no se ha identificado como causa directa del fallo.
- El fallo operativo real sigue siendo `listDriveFolder` con HTTP 403.

### Hipotesis evaluadas

| Hipotesis | Motivo | Accion aplicada | Resultado |
|---|---|---|---|
| API key de Picker invalida | Picker mostraba `The API developer key is invalid`. | Se creo/actualizo API key para Picker, se habilito Google Picker API y se desplego Hosting. | Resuelto: Picker abre y permite seleccionar carpeta. |
| Scope `drive.file` insuficiente | `drive.file` no permite listar de forma confiable todos los hijos de una carpeta institucional. | Se cambio OAuth backend y Picker a `https://www.googleapis.com/auth/drive.readonly`. | Parcial: el flujo pide permisos nuevos, pero `listDriveFolder` sigue en 403. |
| Token viejo con scope anterior | Las conexiones previas conservan refresh token anterior. | Se indico desconectar y reconectar Drive. | Parcial/no concluyente: tras reconexion el usuario sigue viendo 403. |
| Carpetas en unidades compartidas o escenarios Drive no soportados por query | Drive API requiere flags para unidades compartidas. | `listDriveFolder` ahora envia `supportsAllDrives=true`, `includeItemsFromAllDrives=true`, `pageSize=100`. | Parcial: deploy correcto, pero el error persiste. |
| Error 403 sin detalle visible | La app mostraba mensaje generico. | `listDriveFolder` intenta extraer detalle seguro del cuerpo de error Google en 401/403. | Parcial: el frontend aun muestra copy generico; falta exponer/loguear mejor el detalle si Google lo envia. |
| Picker usa cuenta distinta al refresh token backend | Chrome/Picker puede seleccionar carpeta con una cuenta Google distinta a la conectada por OAuth backend. | `connectDrive` solicita `userinfo.email`; `driveOAuthCallback` guarda `googleAccountEmail`; `getDriveConnection` lo expone; `BibliotecaView` muestra `Cuenta Drive` y usa `login_hint` en Picker. | Parcial/no concluyente: deploy correcto, pero el usuario reporta nuevo 403. Se debe confirmar si la UI muestra `Cuenta Drive` y si coincide con la cuenta del Picker/carpeta. |
| Carpeta seleccionada no tiene permisos para la cuenta conectada | Aunque el Picker muestre carpetas, el backend lista con el refresh token conectado. | Pendiente validar con carpeta propia de la cuenta conectada o carpeta compartida explicitamente con esa cuenta. | Pendiente. |
| API Google Drive no habilitada o restriccion adicional | Picker puede funcionar, pero Drive API backend podria recibir restricciones o permisos no disponibles. | Pendiente revisar logs detallados y Google Cloud APIs habilitadas. | Pendiente. |

### Intentos de solucion realizados y evidencia

#### 1. API key exclusiva para Picker

Cambios:

- Se configuro `VITE_GOOGLE_PICKER_API_KEY`.
- Se confirmo que Picker abre en produccion.
- Se desplego Hosting.

Resultado:

- El error `The API developer key is invalid` dejo de bloquear el flujo.
- Picker permite seleccionar carpeta.

#### 2. Cambio de scope a `drive.readonly`

Cambios:

- `functions/academico/drive.js`: `connectDrive` solicita `https://www.googleapis.com/auth/drive.readonly`.
- `vistas/admin/BibliotecaView.tsx`: Picker solicita `drive.readonly`.
- Se desplegaron funciones Drive y Hosting.

Resultado:

- El flujo de consentimiento muestra scope de lectura.
- La consola del usuario ya muestra `drive.readonly` y `userinfo.email openid`.
- El 403 persiste al llamar `listDriveFolder`.

#### 3. Soporte de unidades compartidas en `listDriveFolder`

Cambios:

- Query de Drive API ahora incluye:

```text
supportsAllDrives=true
includeItemsFromAllDrives=true
pageSize=100
```

Validacion:

```powershell
npm run test:functions:drive -- --runTestsByPath functions/academico/drive.test.js
```

Resultado:

```text
57 passed
firebase deploy --project tudojang --only functions:listDriveFolder
Deploy complete.
```

Resultado en produccion:

- 403 persiste.

#### 4. Alineacion de cuenta OAuth backend con cuenta Picker

Cambios:

- `connectDrive` ahora solicita:

```text
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/userinfo.email
```

- `driveOAuthCallback` consulta `https://oauth2.googleapis.com/tokeninfo` con el `access_token` y guarda:

```text
googleAccountEmail
```

- `getDriveConnection` devuelve `googleAccountEmail`.
- `BibliotecaView` muestra `Cuenta Drive: ...`.
- `BibliotecaView` usa `login_hint` al abrir Picker.

Validacion:

```powershell
npm run test:functions:drive -- --runTestsByPath functions/academico/drive.test.js
npm run test:app -- --runTestsByPath vistas/admin/BibliotecaView.test.tsx services/storage/driveService.test.ts
npm run build
firebase deploy --project tudojang --only functions:connectDrive,functions:driveOAuthCallback,functions:getDriveConnection,functions:listDriveFolder,hosting
```

Resultado:

```text
Drive Functions: 57/57 passed
Biblioteca/Drive frontend: 29/29 passed
vite build: OK
Deploy complete.
```

Resultado en produccion:

- El usuario reporta que Picker sigue abriendo y seleccionando carpeta.
- `listDriveFolder` sigue respondiendo 403.
- Aun falta confirmar visualmente si la app muestra `Cuenta Drive: <correo>` y si ese correo coincide con la cuenta propietaria/lectora de la carpeta.

### Diagnostico actual

El error ya no corresponde a:

- Picker completamente deshabilitado.
- API key Picker invalida.
- Falta de despliegue del frontend.
- Falta de deploy de `listDriveFolder`.

El error sigue concentrado en:

```text
Cloud Function listDriveFolder -> Google Drive API -> HTTP 403
```

Las causas mas probables restantes son:

1. La carpeta seleccionada no es legible por la cuenta cuyo refresh token quedo guardado en backend.
2. La cuenta mostrada por `Cuenta Drive` no coincide con la cuenta que tiene permiso real sobre la carpeta.
3. El refresh token guardado en Firestore no se esta renovando con el scope esperado, aunque el flujo visual muestre `drive.readonly`.
4. Google Drive API devuelve un cuerpo de error que aun no esta llegando a UI/logs con suficiente detalle.

### Siguiente paso recomendado

No seguir cambiando scopes a ciegas. Ejecutar debug dirigido:

1. Confirmar en UI si aparece `Cuenta Drive: <correo>`.
2. Confirmar que la carpeta elegida:
   - pertenece a ese mismo correo; o
   - esta compartida explicitamente con ese correo como lector/editor.
3. Agregar logging temporal seguro en `listDriveFolder` para:
   - `tenantId`;
   - `folderId` truncado;
   - `connData.scope`;
   - presencia de `googleAccountEmail`;
   - status y cuerpo seguro de Google Drive API en 403.
4. Reprobar en produccion y revisar:

```powershell
firebase functions:log --project tudojang --only listDriveFolder
```

5. Si el cuerpo de Google dice `insufficientFilePermissions` o similar, el problema es de permisos/cuenta/carpeta.
6. Si dice `insufficientAuthenticationScopes`, el problema es de refresh token/scope y se debe forzar invalidacion de la conexion activa en Firestore antes de reconectar.

### Nota de seguridad

Los logs pegados por el usuario incluyeron una URL de Picker con `oauth_token`. Ese valor debe tratarse como secreto temporal. No debe copiarse a documentacion, issues, commits ni memoria persistente. En esta documentacion se reemplazo por `<redactado>`.

## Correccion aplicada 2026-07-01: conexion activa deterministica

El diagnostico principal fue que varias Cloud Functions tomaban una conexion activa con `limit(1)`. Si Firestore tenia mas de un documento `driveConnections` con `status: active`, el backend podia listar la carpeta con un refresh token distinto al que acababa de autorizar el usuario.

### Que se cambio

| Area | Cambio | Motivo |
|---|---|---|
| `driveOAuthCallback` | Reutiliza la conexion activa mas reciente y, cuando Google entrega un nuevo `refresh_token`, marca activas duplicadas como `disconnected`. | Evitar conexiones activas simultaneas y estado viejo. |
| `driveOAuthCallback` | Si Google no devuelve `refresh_token`, solo reutiliza un token previo cuando la conexion previa esta activa y tiene `drive.readonly`. | Evitar reciclar tokens antiguos con `drive.file`, que no sirven para listar carpetas reales. |
| `listDriveFolder` | Usa la conexion activa mas reciente, no `limit(1)`. | Alinear la carpeta elegida con el refresh token correcto. |
| `getDriveConnection`, `setDriveFolder`, `getTemporaryFileUrl`, `syncDriveMetadata` | Usan el mismo selector de conexion activa mas reciente. | Mantener consistencia en todo el flujo Drive. |
| `listDriveFolder` | Agrega logging seguro en 401/403 con `tenantId`, `folderId` truncado, `connectionId`, cantidad de conexiones activas, scope y correo Drive. | Permitir diagnostico sin exponer tokens ni IDs completos. |
| `BibliotecaView` | Muestra mensajes mas especificos para `insufficientAuthenticationScopes` y permisos insuficientes de archivo/carpeta. | Evitar un mensaje generico cuando Google entrega detalle util. |

### Validacion local

```powershell
npm run test:functions:drive -- --runTestsByPath functions/academico/drive.test.js
npm run test:app -- --runTestsByPath vistas/admin/BibliotecaView.test.tsx services/storage/driveService.test.ts
```

Resultado:

```text
functions/academico/drive.test.js: 61 passed
vistas/admin/BibliotecaView.test.tsx + services/storage/driveService.test.ts: 29 passed
```

### Si el 403 persiste despues del deploy

Revisar logs de `listDriveFolder` y buscar:

```text
[drive:listDriveFolder:permission-denied]
```

Interpretacion:

| `googleError` | Accion |
|---|---|
| `insufficientAuthenticationScopes` | Desconectar y reconectar Drive para renovar consentimiento. Si persiste, revisar scopes OAuth en Google Auth Platform. |
| `The user does not have sufficient permissions for this file` | La carpeta no esta compartida con la cuenta conectada. Usar una carpeta propia de esa cuenta o compartirla explicitamente. |
| Otro 403 | Revisar cuenta Drive, estado de verificacion OAuth y API Google Drive habilitada. |
