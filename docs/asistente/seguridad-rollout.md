# Seguridad y rollout del asistente

## Estado verificado

| Control | Estado | Evidencia |
|---|---|---|
| Clave de IA en navegador | Aprobado | Vite no inyecta `GEMINI_API_KEY`; la prueba de bundle lo valida. |
| Resend en Secret Manager | Aprobado | `tudojang-production-v3` coincide con `RESEND_API_KEY` versión 6; versiones 1–5 fueron destruidas. |
| Gemini en Secret Manager | Aprobado | `GEMINI_API_KEY` versión 1 habilitada en Firebase Secret Manager. |
| Wompi eventos en Secret Manager | Aprobado | `WOMPI_EVENTS_SECRET` versión 1 habilitada y vinculada a `webhookWompi`. |
| Wompi integridad en Secret Manager | Aprobado | `WOMPI_INTEGRITY_SECRET` versión 1 habilitada y usada por `firmarCheckoutWompi`. |
| App Check cliente | Aprobado sin enforcement | Usa reCAPTCHA Enterprise cuando existe `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`; app registrada en Firebase App Check y Hosting desplegado con site key pública. |
| App Check callables | Aprobado y desplegado | `consultarAsistenteIa`, `crearTicketSoporteSeguro` y `actualizarTicketSoporteSeguro` están desplegadas como callable y usan `enforceAppCheck: true`. |
| Gemini Runtime Config heredado | Aprobado | `gemini.api_key` fue eliminado de Runtime Config; `analizarComprobanteEstudiante` usa `GEMINI_API_KEY` desde Secret Manager. |
| Fallback local sin IA | Aprobado y desplegado | El cliente mantiene catálogo local y escalamiento activos, pero IA apagada por defecto; solo llama IA con flag explícita. |
| Cuotas IA | Aprobado | Límites productivos fijados por prueba: usuario 50.000 micros/mes, tenant 200.000 micros/mes, global 8.000.000 micros/mes; reserva estimada 960 micros por consulta. |
| Telemetría IA | Aprobado y desplegado | `consultarAsistenteIa` registra fuente, tokens, costo, resultado de cuota, cuota restante y razón de escalamiento sin prompt, transcript, uid ni tenant en claro. |
| Auditoría secretos/bundle | Aprobado | Repositorio, scripts operativos, `dist` local y bundle publicado no contienen claves backend ni patrones Wompi privados/eventos/integridad, Resend o Gemini. |
| Alta y activación | Aprobado y desplegado | `provisionarUsuarioOnboarding` exige tenant existente/coincidente; `activarSuscripcionManual` exige evidencia `ultimoPagoWompi` escrita por webhook y transacción coincidente. |
| Identidad/tenant | Aprobado | Backend deriva ambos desde Auth; el navegador no los transmite. |
| Rollback | Aprobado | Catálogo, IA y escalamiento se pueden apagar independientemente. |

## Acciones obligatorias antes del despliegue

1. Registrar la aplicación web en Firebase App Check con reCAPTCHA Enterprise.
2. Configurar `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` con la site key pública.
3. Desplegar primero el cliente con App Check sin forzar productos adicionales.
4. Revisar métricas de solicitudes válidas/no verificadas.
5. Desplegar callables y verificar Auth + App Check antes de habilitar IA.

## Desactivación de emergencia

Aplicar estas variables y reconstruir el cliente:

```text
VITE_ASSISTANT_CATALOG_V1=true
VITE_ASSISTANT_AI_ENABLED=false
VITE_ASSISTANT_ESCALATION_ENABLED=false
```

En Functions, mantener `ASSISTANT_AI_ENABLED` distinto de `true`. Aunque se active por error, el runtime exige que `GEMINI_API_KEY` exista antes de habilitar IA. El catálogo local seguirá funcionando sin consumo de IA. Si el incidente afecta WhatsApp, dejar tickets internos habilitados solo después de verificar App Check y reglas.

## Rotación segura

- No consultar ni imprimir valores de secretos para verificarlos.
- Confirmar únicamente existencia, versión activa y funciones vinculadas.
- Revocar primero la credencial expuesta en el proveedor; después agregar la nueva versión en Secret Manager.
- Desplegar solo las funciones afectadas y realizar una prueba sintética.
- Registrar fecha, responsable, proveedor, versión y resultado; nunca el valor.

## Evidencia pendiente

- Métricas previas a enforcement de App Check.
- Activación de enforcement solo después de confirmar solicitudes verificadas en Firebase Console.

## Evidencia Pareto — seguridad y costo del asistente

- La IA ya no puede habilitarse únicamente con `ASSISTANT_AI_ENABLED=true`; `functions/asistente/runtime.js` exige también `GEMINI_API_KEY` no vacío.
- `GEMINI_API_KEY` existe en Firebase Secret Manager como versión 1 habilitada.
- App Check cliente conserva inicialización condicional: sin `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` no inicializa; con site key usa reCAPTCHA Enterprise y refresco automático.
- La app web fue registrada manualmente en Firebase App Check con reCAPTCHA Enterprise; enforcement queda pendiente hasta revisar métricas.
- Hosting fue desplegado con la site key pública de App Check: `firebase deploy --only hosting --project tudojang --non-interactive`.
- Callables del asistente desplegados: `consultarAsistenteIa`, `crearTicketSoporteSeguro` y `actualizarTicketSoporteSeguro`.
- `analizarComprobanteEstudiante` fue migrada de Runtime Config heredado a Secret Manager y desplegada con `GEMINI_API_KEY`.
- Fallback local validado: con IA apagada por defecto, el cliente no invoca `consultarAsistenteIa`; solo lo hace si `aiEnabled`/`VITE_ASSISTANT_AI_ENABLED` se habilita explícitamente.
- Hosting fue desplegado de nuevo para publicar la IA apagada por defecto en cliente.
- Cuotas validadas: reserva atómica por usuario/tenant/global, rechazo sin mutar contadores cuando se agota un límite, reconciliación contra costo real y contrato de límites productivos en `functions/asistente/wiring.test.js`.
- Telemetría validada: consultas IA exitosas registran tokens, costo real, cuota restante y `quotaOutcome: "allowed"`; cuota agotada registra `quotaOutcome: "exhausted"` y `escalationReason: "quota_<scope>"`; los eventos no guardan prompt ni transcript.
- `consultarAsistenteIa` fue desplegada con telemetría operacional.
- Auditoría final: `scripts/restaurar_usuario.cjs` ya no hardcodea `apiKey`; exige `FIREBASE_WEB_CONFIG_JSON`. `scripts/verificar-bundle-seguro.test.js` valida que scripts operativos no hardcodeen claves Firebase web.
- Runtime Config verificado sin imprimir valores: solo queda `admin.email`; `gemini.api_key` ya no existe.
- Bundle publicado en `https://tudojang.web.app` verificado sin patrones sensibles backend.
- Pruebas: `node --test asistente\runtime.test.js asistente\wiring.test.js` **8/8**, `npm test` en Functions **71/71**, `firebase/appCheck.test.ts` **2/2**, seguridad de bundle **4/4** y `npm run build` aprobado.
- Pendiente de infraestructura local: `npm run test:emulator` falla antes de ejecutar pruebas por deprecación/salida crítica del `firebase-tools` global; las pruebas de integración requieren emulador Firestore activo.

## Pendiente técnico de plataforma

- Migrar Cloud Functions de Node.js 20 antes del 30 de octubre de 2026; Firebase CLI reporta que ese runtime fue deprecado el 30 de abril de 2026 y será descontinuado el 30 de octubre de 2026.
- Migrar cualquier uso restante de `functions.config()` antes de marzo de 2027; Firebase CLI reporta deprecación de Runtime Config.

## Evidencia Resend — 25 de junio de 2026

- Clave activa: `tudojang-production-v3`; el valor permanece exclusivamente en Resend y Firebase Secret Manager.
- Firebase: `RESEND_API_KEY` versión 6 habilitada y vinculada a todas las funciones de correo desplegadas.
- Rotación: `tudojang-production-v2` revocada; versiones 1–5 de Secret Manager destruidas.
- Código: eliminada la credencial versionada de `functions/prueba_email_directa.js`; el script exige variables de entorno.
- Prevención: `functions/index.security.test.js` escanea todo el código productivo de Functions y rechaza patrones de claves Resend.
- Abuso: eliminado `testEmailResend` del código y de Cloud Functions; su URL devuelve HTTP 404.
- Superficie HTTP: eliminados `enviarConfirmacionPago`, `enviarRecuperacionPassword` y `notificarCambioPassword`; no tenían consumidores activos y sus URLs devuelven HTTP 404.
- Confirmaciones de pago: permanecen en el flujo confiable de `webhookWompi`, evitando envíos iniciados directamente desde el navegador.
- Prueba sintética: envío aceptado por Resend a `gengepardo@gmail.com`, con registro `37625663-60ee-438c-af87-1d16ef03a209`.
- Pruebas: Functions **60/60**, pagos **17/17** e invitaciones académicas **12/12**.

## Riesgo pendiente relacionado

`provisionarUsuarioOnboarding` y `activarSuscripcionManual` siguen siendo endpoints de preautenticación, pero ya no confían únicamente en datos enviados por el navegador. La provisión exige que el tenant exista y coincida con el email registrado; la activación manual exige evidencia de pago aprobada (`ultimoPagoWompi`) escrita por `webhookWompi` tras validar firma de evento Wompi, además de transacción coincidente.

## Alta y activación — endurecimiento Pareto

- `webhookWompi` guarda evidencia backend `ultimoPagoWompi` con `transactionId`, `status`, `reference`, `amountInCents` y `verifiedAt`.
- `activarSuscripcionManual` rechaza activaciones sin evidencia Wompi aprobada o con `transactionId` distinto.
- `provisionarUsuarioOnboarding` rechaza solicitudes cuyo `tenantId`/`email` no coincidan con el tenant previamente creado.
- Frontend de registro envía `transactionId` recibido en el retorno Wompi para que la activación manual no dependa solo de `tenantId`/`email`.
- Pruebas: Functions **76/76**, build aprobado, seguridad de bundle **4/4**.
- Producción: `provisionarUsuarioOnboarding`, `activarSuscripcionManual`, `webhookWompi` y Hosting desplegados; prueba negativa confirmó que activación manual rechaza tenant sin evidencia.

## Wompi — rotación y despliegue verificados, 26 de junio de 2026

- Se regeneraron las llaves del comercio en Wompi. La llave privada, el secreto de eventos y la llave de integridad anteriores deben considerarse revocados/obsoletos.
- `WOMPI_EVENTS_SECRET` versión 1 quedó creada en Firebase Secret Manager y vinculada a `webhookWompi`.
- `WOMPI_INTEGRITY_SECRET` versión 1 quedó creada en Firebase Secret Manager y vinculada a `firmarCheckoutWompi`.
- `webhookWompi` fue desplegado y ahora valida la firma oficial de eventos Wompi: propiedades dinámicas, timestamp, secreto de eventos y SHA-256.
- `firmarCheckoutWompi` fue desplegado como callable backend para generar `signature:integrity` sin exponer la llave de integridad en el navegador.
- El frontend publicado fue desplegado después de retirar `CONFIGURACION_WOMPI.integrityKey`.
- Verificación de producción: `firebase functions:list` muestra `firmarCheckoutWompi` y `webhookWompi`; el bundle publicado en `https://tudojang.web.app` no contiene patrones de llave privada, eventos ni integridad Wompi.
- Pruebas: Functions **65/65**, seguridad repo/bundle **3/3**, `npm run build` aprobado.
- Prevención: `scripts/verificar-bundle-seguro.test.js` impide versionar o publicar patrones `prv_*`, `*_events_*` o `*_integrity_*`.
