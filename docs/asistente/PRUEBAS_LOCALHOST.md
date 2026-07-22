# Pruebas locales del asistente

## 1. Probar solo catalogo local

Usa este modo para verificar que el chat abre y responde sin Gemini.

`.env.local`:

```env
VITE_ASSISTANT_CATALOG_V1=true
VITE_ASSISTANT_AI_ENABLED=false
VITE_ASSISTANT_ESCALATION_ENABLED=true
```

Reinicia Vite:

```powershell
npm run dev
```

Pregunta:

```text
Como agrego un estudiante
```

Resultado esperado: respuesta del asistente sin etiqueta tecnica de fuente y ninguna llamada a `consultarAsistenteIa`.

## 2. Probar IA real desde localhost

### Opcion recomendada: Functions emulator

Este modo prueba Gemini real sin desplegar cambios a produccion.

`.env.local` debe tener:

```env
VITE_ASSISTANT_CATALOG_V1=true
VITE_ASSISTANT_AI_ENABLED=true
VITE_ASSISTANT_ESCALATION_ENABLED=true
VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1
VITE_FUNCTIONS_EMULATOR_PORT=5001
```

En otra terminal, levanta el emulador de Functions con la bandera y el secreto en el entorno. No imprimas el valor del secreto:

```powershell
$env:ASSISTANT_AI_ENABLED='true'
$env:GEMINI_API_KEY='<gemini-api-key-local-o-secret-access>'
firebase emulators:start --only functions --project tudojang
```

Reinicia Vite:

```powershell
npm run dev
```

Para forzar IA, pregunta algo fuera del catalogo:

```text
Como sincronizo el cinturon cuantico
```

### Opcion contra Functions desplegadas

Usa esta opcion solo si quieres probar exactamente la callable desplegada. `.env.local` debe tener tambien:

```env
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<site-key-publica-de-app-check>
```

Reinicia Vite. Luego abre DevTools en `localhost` y ejecuta:

```js
localStorage.setItem('tudojang:appcheck-debug-token', 'true');
location.reload();
```

Firebase imprimira un App Check debug token en la consola. Copia ese token y registralo en:

```text
Firebase Console > App Check > tu app web > Manage debug tokens
```

Despues reemplaza `true` por el token registrado para que sea estable:

```js
localStorage.setItem('tudojang:appcheck-debug-token', '<debug-token-registrado>');
location.reload();
```

Para desactivar el modo debug local:

```js
localStorage.removeItem('tudojang:appcheck-debug-token');
location.reload();
```

## 3. Requisitos backend

Para emulador:

```text
ASSISTANT_AI_ENABLED=true
GEMINI_API_KEY en el entorno del proceso del emulador
```

Para la Function desplegada:

```text
ASSISTANT_AI_ENABLED=true
GEMINI_API_KEY configurado en Secret Manager
```

Ademas, el usuario autenticado debe tener custom claims en Firebase Auth:

```json
{
  "tenantId": "tenant-del-usuario",
  "rol": "Admin"
}
```

Si cambias claims, cierra sesion y vuelve a entrar para refrescar el token.

## 4. Pregunta para forzar IA

Si preguntas algo que el catalogo conoce, no se llama IA. Usa una pregunta fuera del catalogo:

```text
Como sincronizo el cinturon cuantico
```

## 5. Diagnostico rapido

- No aparece request a `consultarAsistenteIa`: `VITE_ASSISTANT_AI_ENABLED` esta apagado o respondio el catalogo local.
- Error de App Check: falta `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` o el debug token no esta registrado.
- `permission-denied`: faltan custom claims `tenantId`/`rol`.
- Respuesta `IA desactivada`: falta `ASSISTANT_AI_ENABLED=true` en Functions o falta `GEMINI_API_KEY`.
- `resource-exhausted`: cuota mensual agotada.
