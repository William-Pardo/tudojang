# Plan Pareto de Refactorización

## Objetivo

Aplicar el 20% de cambios que resuelve el 80% del riesgo, fuga de costo y deuda operativa del proyecto.

## Orden de ejecución

1. Blindar el asistente con seguridad y control de costo.
2. Cerrar las superficies más sensibles del flujo de alta y activación.
3. Consolidar el catálogo local como primera capa de respuesta.
4. Dejar telemetría y límites como barrera dura contra fuga de costo.
5. Cerrar la superficie pública de secretos y bundles.

## Tareas

### 1. Seguridad y costo del asistente

- Estado: en ejecución.
- Primer control implementado: la IA no puede habilitarse solo con `ASSISTANT_AI_ENABLED=true`; ahora también exige `GEMINI_API_KEY` presente en runtime.
- Evidencia: `node --test asistente\runtime.test.js asistente\wiring.test.js` pasa 6/6.
- Evidencia global: `npm test` en `functions` pasa 65/65.
- Evidencia App Check cliente: `npm test -- firebase/appCheck.test.ts --runInBand` pasa 2/2.
- `GEMINI_API_KEY` creado en Firebase Secret Manager: versión 1 habilitada.
- App Check web registrado en Firebase Console con reCAPTCHA Enterprise. Estado: completado sin enforcement.
- Hosting desplegado con site key pública de App Check. Estado: completado.
- Evidencia adicional: `npm run build` aprobado y `npm run test:bundle-security` pasa 3/3.
- Callables del asistente desplegados con App Check: `consultarAsistenteIa`, `crearTicketSoporteSeguro`, `actualizarTicketSoporteSeguro`. Estado: completado.
- `analizarComprobanteEstudiante` migrado de Runtime Config heredado a `GEMINI_API_KEY` en Secret Manager. Estado: completado.
- Evidencia Functions actualizada: `npm test` en `functions` pasa 66/66.
- Cliente del asistente publicado con IA apagada por defecto; catálogo local y escalamiento quedan activos. Estado: completado.
- Evidencia fallback local: pruebas `servicios/soporte/*` pasan 33/33 y confirman que fallback sin IA no invoca callable.
- Cuotas productivas fijadas por contrato: usuario 50.000 micros/mes, tenant 200.000 micros/mes, global 8.000.000 micros/mes; reserva por consulta 960 micros. Estado: completado.
- Evidencia cuotas: `npm test` en `functions` pasa 67/67; cubre reserva atómica, bloqueo duro, no mutación en rechazo y reconciliación.
- Telemetría IA operacional desplegada: registra fuente, tokens, costo, cuota restante, resultado de cuota y razón de escalamiento sin prompt ni transcript. Estado: completado.
- Evidencia telemetría: `npm test` en `functions` pasa 71/71.
- Auditoría final de secretos y bundle completada: repo, scripts, `dist` y bundle publicado sin patrones sensibles backend. Estado: completado.
- Evidencia auditoría: `npm run test:bundle-security` pasa 4/4; Runtime Config ya no contiene `gemini.api_key`.

- Crear `GEMINI_API_KEY` en Secret Manager. Estado: completado.
- Activar y verificar App Check en consola. Estado: completado sin enforcement.
- Confirmar que los callables del asistente requieren App Check. Estado: completado y desplegado.
- Validar que el asistente degrade a catálogo local cuando IA esté desactivada. Estado: completado y desplegado.
- Mantener cuotas por usuario, tenant y global. Estado: completado.
- Confirmar que el fallback no consume IA. Estado: completado.
- Pendiente antes de enforcement: revisar métricas de solicitudes verificadas/no verificadas en Firebase Console.
- Pendiente técnico fuera del asistente: migrar Cloud Functions de Node.js 20 antes del 30 de octubre de 2026 y migrar Runtime Config antes de marzo de 2027.
- Pendiente de infraestructura local: reparar ejecución de `firebase emulators:exec`/`npm run test:emulator`; el comando actual falla antes de correr pruebas por deprecación del `firebase-tools` global.

### 2. Endurecer alta y activación

- Revisar `provisionarUsuarioOnboarding`. Estado: completado.
- Revisar `activarSuscripcionManual`. Estado: completado.
- Eliminar confianza en datos del navegador cuando sea posible. Estado: completado.
- Cambiar el flujo para que dependa de comprobantes o estado verificable. Estado: completado.
- Asegurar idempotencia para evitar altas o activaciones duplicadas. Estado: completado parcialmente: se evita activación sin evidencia; queda como mejora futura registrar intentos/reintentos con idempotency key explícita.

Evidencia:

- `provisionarUsuarioOnboarding` exige tenant existente y email coincidente.
- `webhookWompi` guarda evidencia `ultimoPagoWompi` tras firma Wompi válida.
- `activarSuscripcionManual` exige `ultimoPagoWompi.status === "APPROVED"` y `transactionId` coincidente.
- Frontend envía `transactionId` Wompi en la activación manual.
- Functions **76/76**, build aprobado, bundle security **4/4**.
- Producción desplegada y prueba negativa OK: activación manual rechaza tenant sin evidencia.

### 3. Catálogo local primero

- Verificar que el archivo indexado del asistente siga completo y navegable.
- Asegurar que las respuestas salgan primero del catálogo.
- Reservar la IA solo para desambiguar o completar huecos.
- Documentar cómo se amplía el catálogo sin tocar el flujo principal.

### 4. Telemetría y límites

- Registrar costo por consulta. Estado: completado.
- Registrar razón de escalamiento a humano. Estado: completado.
- Registrar cuota restante por usuario y tenant. Estado: completado.
- Validar bloqueo cuando se alcance el tope. Estado: completado.
- Verificar que el escalamiento a persona ocurra como última instancia. Estado: completado para IA/cuota y tickets seguros.

### 5. Auditoría final de secretos

- Verificar que no queden secretos en frontend ni en bundle. Estado: completado.
- Mantener pruebas que fallen si reaparecen patrones de claves. Estado: completado.
- Revisar que no haya referencias viejas a integridad o eventos en UI. Estado: completado.
- Confirmar que Resend y Wompi siguen limpios. Estado: completado.

## Criterio de cierre

El plan queda cerrado cuando:

- la IA está controlada por secreto y App Check,
- el catálogo local responde primero,
- el costo está limitado por cuotas,
- alta y activación no dependen ciegamente del navegador,
- y no quedan secretos expuestos en frontend o bundle.
