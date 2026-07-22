# Debug Drive OAuth – Centro de Estudios

Fecha de corte: 2026-06-30  
Proyecto Firebase: `tudojang`  
Dominio producción: `https://tudojang.com`  
Hosting alterno: `https://tudojang.web.app`  
Tenant probado: `escuela-gajog-001`  
Usuario probado: `gengepardo@gmail.com` / Admin `Alonzo Jimenez`

## Objetivo funcional

Conectar Google Drive desde `Centro de Estudios > Biblioteca Académica` para que el Admin autorice acceso `drive.file`, la app guarde la conexión institucional del tenant y el bloque `Drive institucional` pase de `Estado: desconectado/error` a `Estado: conectado`.

La UX esperada es:

1. Usuario entra a `https://tudojang.com/#/centro-estudios`.
2. Clic en `Conectar Google Drive`.
3. Google solicita permisos.
4. Google redirige de vuelta a Tudojang.
5. La app procesa el `code` OAuth.
6. La app queda en `#/centro-estudios`.
7. Biblioteca muestra `Estado: conectado` y `Conexion: <connectionId>`.

## Estado actual del problema

El flujo ya llega de vuelta a Centro de Estudios con URL similar a:

```text
https://tudojang.com/#/centro-estudios?state=escuela-gajog-001&iss=https%3A%2F%2Faccounts.google.com&code=...&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file
```

Pero la conexión queda en error:

```text
Estado: error
No fue posible procesar la consulta
```

En consola aparece:

```text
us-central1-tudojang.cloudfunctions.net/driveOAuthCallback:1
Failed to load resource: the server responded with a status of 500 ()
```

Cloud Functions confirmó en logs:

```text
driveOAuthCallback: Callable request verification passed
verifications: { app: "MISSING", auth: "VALID" }
Function execution ... finished with status code: 500
```

Interpretación:

- Firebase Auth sí llega válido.
- App Check no está enforced en las funciones Drive, por tanto `app: MISSING` no debería bloquear.
- El error ocurre dentro de `driveOAuthCallback`, después de entrar a la función.

## Cambios ya realizados

### 1. Google OAuth / consola

Se configuró Google OAuth para producción:

- Tipo de app: Web.
- Orígenes JS autorizados configurados:
  - `https://tudojang.com`
  - `https://tudojang.web.app`
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- Redirect URIs autorizadas configuradas:
  - `https://tudojang.com/`
  - `https://tudojang.web.app/`
  - `http://localhost:5173/`
  - `http://127.0.0.1:5173/`

La app OAuth pasó de modo prueba a producción. Luego Google indicó revisión de marca pendiente, pero el flujo con el usuario de prueba/admin ya permite aceptar permisos y volver a Tudojang.

### 2. Secrets Firebase

Se crearon/actualizaron secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Las funciones `connectDrive` y `driveOAuthCallback` se desplegaron con esos secrets.

En logs de deploy se vio que `driveOAuthCallback` quedó con:

```text
secretEnvironmentVariables:
GOOGLE_CLIENT_ID version 3
GOOGLE_CLIENT_SECRET version 2
GOOGLE_REDIRECT_URI version 2
```

### 3. Scope de Drive

Se decidió usar scope mínimo:

```text
https://www.googleapis.com/auth/drive.file
```

Motivo:

- Menor fricción para verificación de Google.
- No requiere acceso completo a todo Drive.
- Más adecuado para producción y multi-tenant.

### 4. Redirección a Centro de Estudios

Problema anterior:

- Google volvía a `#/configuracion` o la app terminaba en Configuración.

Cambio realizado en `App.tsx`:

- `construirUrlCallbackDrive(...)` convierte callbacks con `code` en:

```text
<pathname>#/centro-estudios?<params>
```

- `obtenerCodigoCallbackDrive(search, hash)` extrae `code` tanto desde query real como desde hash query.
- `AppRoutes` procesa globalmente el callback OAuth y luego navega a `/centro-estudios`.
- Se agregó una excepción temporal al onboarding guard: si existe callback Drive pendiente o `driveOAuthReturnPath`, no fuerza redirección a `/configuracion`.

### 5. Error de login React #310

Problema introducido:

```text
Minified React error #310
```

Causa:

- El `useEffect` de Drive OAuth estaba después de `return`s condicionales en `AppRoutes`, rompiendo el orden de hooks.

Corrección:

- Se movió el `useEffect` global de Drive antes de cualquier `return` condicional.

Validación:

```text
npm run test:app -- --silent App.routing.test.ts vistas/admin/BibliotecaView.test.tsx
15/15 OK
npm run build OK
firebase deploy --project tudojang --only hosting OK
```

### 6. Doble procesamiento del code OAuth

Problema detectado:

- `AppRoutes` procesaba el `code`.
- `BibliotecaView` también procesaba el mismo `code`.
- Los códigos OAuth de Google son de un solo uso.
- La segunda llamada podía fallar con `invalid_grant` y dejar la UI en error.

Cambio realizado en `vistas/admin/BibliotecaView.tsx`:

- Se eliminó el `useEffect` local que llamaba `driveService.procesarCallbackOAuth(...)`.
- Biblioteca ahora solo lee:

```text
localStorage["tudojang:driveConnection:<tenantId>"]
localStorage["tudojang:driveConnectionError:<tenantId>"]
```

Cambio de test:

- `BibliotecaView.test.tsx` ahora valida que Biblioteca no procese localmente el callback OAuth.
- Se conserva el test donde Biblioteca muestra conectado si el manejador global guardó `connectionId`.

Validación:

```text
npm run test:app -- --silent App.routing.test.ts vistas/admin/BibliotecaView.test.tsx
15/15 OK
npm run build OK
firebase deploy --project tudojang --only hosting,functions:connectDrive,functions:driveOAuthCallback OK
```

### 7. Logging interno de callable

Problema:

- `crearHandlerCallable` convertía errores internos a:

```text
No fue posible procesar la consulta
```

- Esto ocultaba el mensaje técnico real en Cloud Functions.

Cambio realizado en `functions/asistente/callable.js`:

```js
if (code === "internal") {
  console.error("[callable:internal]", {
    message: error?.message,
    stack: error?.stack,
  });
}
```

Esto permite que el próximo fallo de `driveOAuthCallback` deje en logs el mensaje real sin exponer tokens/códigos en el frontend.

## Archivos tocados específicamente por el debug Drive

Frontend:

- `App.tsx`
- `App.routing.test.ts`
- `vistas/admin/BibliotecaView.tsx`
- `vistas/admin/BibliotecaView.test.tsx`
- `services/storage/driveService.ts`
- `services/storage/driveService.test.ts`

Backend:

- `functions/index.js`
- `functions/academico/drive.js`
- `functions/academico/drive.test.js`
- `functions/asistente/callable.js`

Documentación relacionada:

- `docs/GUIA_DRIVE_CENTRO_ESTUDIOS.md`
- `docs/DEBUG_DRIVE_OAUTH_CENTRO_ESTUDIOS.md`

## Hipótesis ya probadas / descartadas parcialmente

### Ruta de callback incorrecta

Estado: parcialmente corregido.

Antes volvía a Configuración. Ahora vuelve a:

```text
https://tudojang.com/#/centro-estudios?...code=...
```

Por tanto, el problema actual no es principalmente de navegación.

### Usuario no autenticado

Estado: descartado para el último intento.

Cloud Functions log:

```text
auth: VALID
```

### App Check faltante

Estado: no parece ser la causa.

Log:

```text
app: MISSING
auth: VALID
```

Pero `driveFunctions` en `functions/index.js` está definido solo con secrets:

```js
const driveFunctions = functionsV1.runWith({
  secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
});
```

No tiene `enforceAppCheck: true`.

### Doble uso del code

Estado: corregido en frontend.

Se eliminó el procesamiento local en Biblioteca. Queda un solo responsable: `AppRoutes`.

## Hipótesis abiertas para Sonnet

Estas son las causas más probables del 500 restante:

### A. `GOOGLE_REDIRECT_URI` no coincide exactamente

La función usa:

```js
const resolvedRedirectUri = redirectUri || googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
```

El frontend envía:

```ts
const redirectUri = `${window.location.origin}${window.location.pathname}`;
```

En producción eso debería ser:

```text
https://tudojang.com/
```

Pero debe verificarse que:

- `connectDrive` generó el auth URL con el mismo `redirectUri`.
- `driveOAuthCallback` usa exactamente el mismo `redirectUri`.
- El secret `GOOGLE_REDIRECT_URI` no contiene espacios, saltos de línea, comillas o una URL diferente.

Riesgo:

- Si `connectDrive` usa un valor y `driveOAuthCallback` usa otro, `oauth2Client.getToken(code)` falla.

### B. Secret `GOOGLE_CLIENT_SECRET` incorrecto o viejo

El flujo antes tuvo varios intentos de creación de secrets. Verificar que la versión desplegada realmente corresponde al OAuth Client actual.

### C. Error de rol/custom claims

`driveOAuthCallback` valida:

```js
context.auth.token.rol === 'Admin' || 'SuperAdmin'
tenantId === context.auth.token.tenantId
```

El usuario funciona como Admin en UI, pero debe verificarse que sus custom claims en Firebase Auth sean:

```json
{
  "rol": "Admin",
  "tenantId": "escuela-gajog-001"
}
```

Si esto falla actualmente se lanzaría `Error` genérico y el wrapper lo convierte en internal/500.

### D. No se recibe `refresh_token`

`connectDrive` usa:

```js
access_type: 'offline',
prompt: 'consent'
```

Debería recibir `refresh_token`, pero si no llega y no hay conexión previa, `driveOAuthCallback` lanza:

```text
No se recibió refresh_token y no existe una conexión previa...
```

Con el nuevo logging, esto debería aparecer en logs.

### E. Firestore write path / reglas no aplican

La función usa Admin SDK:

```js
firestore.collection('tenants').doc(tenantId).collection('driveConnections')
```

Las reglas Firestore no deberían bloquear Admin SDK. Pero verificar si hay error por datos inválidos, índices no aplican aquí.

## Próximo paso recomendado para Sonnet

No repetir cambios de frontend primero. El flujo de frontend ya llega a Centro de Estudios y llama a `driveOAuthCallback`.

Paso 1: Reproducir una sola vez el flujo en producción.

Paso 2: Leer logs inmediatamente después:

```powershell
firebase functions:log --project tudojang --only driveOAuthCallback -n 50
```

Buscar entrada nueva:

```text
[callable:internal]
message: ...
stack: ...
```

Paso 3: Según el mensaje:

- Si aparece `redirect_uri_mismatch`: corregir `GOOGLE_REDIRECT_URI` o dejar de enviar redirectUri dinámico y usar siempre el secret.
- Si aparece `invalid_client`: corregir `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Si aparece `invalid_grant`: revisar reutilización del code, redirectUri exacta o clock/consent.
- Si aparece `Solo el Admin...` o `No autorizado...`: corregir custom claims o convertir esos errores a `permission-denied`.
- Si aparece `No se recibió refresh_token...`: revisar `prompt: 'consent'`, revocar acceso de la app en Google Account y reintentar.

## Recomendación de mejora técnica pendiente

Convertir los errores esperables de `functions/academico/drive.js` a errores con `code` compatible con `crearHandlerCallable`, por ejemplo:

```js
const crearError = (code, message) => Object.assign(new Error(message), { code });
```

Usar:

- `unauthenticated`
- `permission-denied`
- `invalid-argument`
- `failed-precondition`

Así el frontend no recibirá genéricamente `No fue posible procesar la consulta` para errores funcionales.

## Comandos ya ejecutados en el último intento

```powershell
npm run test:app -- --silent App.routing.test.ts vistas/admin/BibliotecaView.test.tsx
```

Resultado:

```text
PASS vistas/admin/BibliotecaView.test.tsx
PASS App.routing.test.ts
15 tests passed
```

```powershell
npm run build
```

Resultado: OK.

```powershell
firebase deploy --project tudojang --only hosting,functions:connectDrive,functions:driveOAuthCallback
```

Resultado:

```text
functions[driveOAuthCallback(us-central1)] Successful update operation.
functions[connectDrive(us-central1)] Successful update operation.
hosting[tudojang] release complete.
```

## Nota de seguridad

No guardar ni copiar en documentación:

- OAuth `code` completo.
- `GOOGLE_CLIENT_SECRET`.
- refresh tokens.
- access tokens.

Los logs agregados registran `message` y `stack`; si Google incluye información sensible en mensajes, revisar antes de compartir externamente.

## Actualización 2026-06-30 – causa real aislada

Después de un nuevo intento en producción, los logs de Cloud Functions ya muestran el error interno real:

```text
[callable:internal]
message: 'Error al intercambiar el código por tokens: invalid_client'
stack: Error: Error al intercambiar el código por tokens: invalid_client
  at /workspace/academico/drive.js:129:13
```

Interpretación técnica:

- El frontend ya no es la causa principal.
- El callback ya vuelve correctamente a `#/centro-estudios`.
- Firebase Auth llega válido: `auth: VALID`.
- La falla ocurre en `oauth2Client.getToken(code)`.
- Google está rechazando las credenciales OAuth usadas por la función.

Diagnóstico seguro ejecutado sin imprimir secretos:

```text
GOOGLE_CLIENT_ID format: OK
GOOGLE_CLIENT_ID length(trim): 72
GOOGLE_CLIENT_SECRET length(trim): 27
GOOGLE_CLIENT_SECRET starts expected prefix: False
GOOGLE_REDIRECT_URI equals prod: True
```

Conclusión:

La causa más probable y accionable es que `GOOGLE_CLIENT_SECRET` en Firebase Secret Manager no corresponde al `GOOGLE_CLIENT_ID` actual o fue copiado incorrectamente. También puede ser un secreto viejo de otro cliente OAuth. `GOOGLE_REDIRECT_URI` está correcto para producción: `https://tudojang.com/`.

Solución recomendada:

1. En Google Cloud Console abrir el mismo OAuth Client Web cuyo Client ID está configurado en `GOOGLE_CLIENT_ID`.
2. Copiar el **Client secret** real, no el Client ID.
3. En PowerShell, con el valor exacto en el portapapeles:

```powershell
Get-Clipboard -Raw | firebase functions:secrets:set GOOGLE_CLIENT_SECRET --project tudojang --data-file -
```

4. Reforzar el redirect URI limpio:

```powershell
'https://tudojang.com/' | firebase functions:secrets:set GOOGLE_REDIRECT_URI --project tudojang --data-file -
```

5. Redesplegar funciones Drive:

```powershell
firebase deploy --project tudojang --only functions:connectDrive,functions:driveOAuthCallback,functions:listDriveFolder,functions:getTemporaryFileUrl
```

6. Probar de nuevo desde una URL limpia:

```text
https://tudojang.com/#/centro-estudios
```

No reutilizar URLs viejas con `code=...`, porque los códigos OAuth son de un solo uso.

### Actualización de ejecución

Se creó una nueva versión correcta del secret:

```text
GOOGLE_CLIENT_SECRET version 4
```

Validación segura posterior:

```text
GOOGLE_CLIENT_SECRET length(trim): 35
GOOGLE_CLIENT_SECRET starts expected prefix: True
```

Se desplegaron las funciones Drive con el secret actualizado:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='30000'
firebase deploy --project tudojang --only functions:connectDrive,functions:driveOAuthCallback,functions:listDriveFolder,functions:getTemporaryFileUrl,functions:syncDriveMetadata
```

Resultado:

```text
functions[connectDrive(us-central1)] Successful update operation.
functions[driveOAuthCallback(us-central1)] Successful update operation.
functions[listDriveFolder(us-central1)] Successful update operation.
functions[getTemporaryFileUrl(us-central1)] Successful update operation.
functions[syncDriveMetadata(us-central1)] Successful update operation.
Deploy complete.
```

Nota: el primer intento de deploy falló por timeout de discovery local de Firebase Functions. Se resolvió aumentando `FUNCTIONS_DISCOVERY_TIMEOUT` a `30000`.

## Actualización 2026-06-30 – limpieza de secrets OAuth y nuevo deploy

Después de desplegar `GOOGLE_CLIENT_SECRET version 4`, el callback siguió fallando con:

```text
Error al intercambiar el código por tokens: invalid_client
```

Se revisó la combinación configurada:

```text
GOOGLE_CLIENT_ID prefix: 545628702717-5sjc3h3gcj3
GOOGLE_CLIENT_ID suffix: h.apps.googleusercontent.com
GOOGLE_CLIENT_ID has expected suffix: True
```

El ID coincide visualmente con el cliente OAuth abierto en Google Cloud. Se decidió regrabar los tres secrets usando los valores actuales recortados y archivo temporal escrito con `WriteAllText` para evitar copiar caracteres extra desde PowerShell/portapapeles:

```text
GOOGLE_CLIENT_ID version 4
GOOGLE_CLIENT_SECRET version 5
GOOGLE_REDIRECT_URI version 4
```

Luego se desplegaron nuevamente:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='30000'
firebase deploy --project tudojang --only functions:connectDrive,functions:driveOAuthCallback,functions:listDriveFolder,functions:getTemporaryFileUrl,functions:syncDriveMetadata
```

Resultado:

```text
functions[driveOAuthCallback(us-central1)] Successful update operation.
functions[connectDrive(us-central1)] Successful update operation.
functions[getTemporaryFileUrl(us-central1)] Successful update operation.
functions[listDriveFolder(us-central1)] Successful update operation.
functions[syncDriveMetadata(us-central1)] Successful update operation.
Deploy complete.
```

Próxima prueba debe hacerse con flujo OAuth nuevo desde:

```text
https://tudojang.com/#/centro-estudios
```

Si aún falla, revisar logs nuevos de `driveOAuthCallback` y buscar si permanece `invalid_client` o cambia a otro error como `invalid_grant`, `refresh_token` ausente o permisos/claims.
## Actualizacion 2026-07-01 - 403 al listar carpeta despues de Picker

### Sintoma observado

Despues de conectar Google Drive y seleccionar una carpeta con Google Picker, la UI muestra:

```text
Permisos insuficientes en Drive para listar esta carpeta. Si acabas de cambiar permisos, desconecta y vuelve a conectar Google Drive para autorizar el nuevo alcance de lectura.
```

En consola del navegador aparece:

```text
us-central1-tudojang.cloudfunctions.net/listDriveFolder
Failed to load resource: the server responded with a status of 403
```

### Evidencia en Cloud Functions

Los logs seguros de `listDriveFolder` mostraron dos causas:

1. Intento con scope correcto:

```text
scope: 'openid https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email'
googleError: 'PERMISSION_DENIED: Google Drive API has not been used in project 545628702717 before or it is disabled...'
```

Diagnostico: la conexion tenia el alcance correcto, pero la API `drive.googleapis.com` no estaba habilitada o aun no habia propagado en el proyecto Google Cloud `tudojang` / `545628702717`.

2. Intento posterior con scope incompleto:

```text
scope: 'https://www.googleapis.com/auth/userinfo.email openid'
googleError: 'PERMISSION_DENIED: Request had insufficient authentication scopes.'
```

Diagnostico: quedo una conexion activa con token/metadata sin `https://www.googleapis.com/auth/drive.readonly`. Esa conexion no puede listar carpetas aunque Picker abra correctamente.

### Hipotesis descartadas

- No es un problema primario de autenticacion Firebase: los logs muestran `auth: VALID`.
- No es un problema primario de seleccion visual de carpeta: Picker abre y devuelve carpeta.
- No debe tratarse como carpeta sin permiso mientras Google devuelva `Google Drive API has not been used...` o `insufficient authentication scopes`.

### Correccion aplicada

Archivo:

```text
functions/academico/drive.js
```

Se agrego validacion defensiva en `driveOAuthCallback`:

- Si Google devuelve un `scope` explicito sin `https://www.googleapis.com/auth/drive.readonly`, el callback falla.
- El backend ya no guarda esa conexion como `active`.
- Esto evita el estado falso: Drive conectado pero incapaz de listar carpetas.

Prueba agregada:

```text
functions/academico/drive.test.js
```

Caso:

```text
rechaza el callback si Google devuelve un scope sin drive.readonly
```

Validacion:

```text
npm run test:functions:drive -- --runTestsByPath functions/academico/drive.test.js
62/62 OK
```

Deploy realizado:

```text
firebase deploy --project tudojang --only functions:driveOAuthCallback
```

Resultado:

```text
functions[driveOAuthCallback(us-central1)] Successful update operation.
```

### Accion externa obligatoria si persiste el 403

Habilitar Google Drive API en el proyecto:

```text
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=545628702717
```

Alternativa:

```text
https://console.cloud.google.com/apis/api/drive.googleapis.com/overview?project=tudojang
```

Despues de habilitarla, esperar unos minutos de propagacion.

### Procedimiento correcto de retest

1. Ir a `https://tudojang.com/#/centro-estudios`.
2. Clic en `Desconectar Google Drive`.
3. Volver a conectar Google Drive.
4. Aceptar el permiso de lectura de Drive.
5. Seleccionar carpeta con Picker.
6. Verificar que la carpeta se liste.
7. Si vuelve a fallar, revisar:

```powershell
firebase functions:log --project tudojang --only listDriveFolder -n 30
```

Buscar:

```text
[drive:listDriveFolder:permission-denied]
```

El campo `googleError` define la causa real.
