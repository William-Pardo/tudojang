# Resumen de Estado - Tudojang SaaS
**Fecha**: 2026-02-09
**Conversación**: c8009923 (Implementing Secure SaaS Onboarding)

## 🎯 Objetivo Actual
Completar el flujo de registro, pago y primer acceso para nuevas escuelas (SaaS Onboarding).

## 🛠️ Avances Logrados
1.  **Backend (Cloud Functions)**:
    *   `webhookWompi` implementado en `functions/index.js`.
    *   La función ahora:
        *   Confirma el pago (`APPROVED`).
        *   Activa el tenant en Firestore (`estadoSuscripcion: 'activo'`).
        *   Crea el usuario administrador en **Firebase Auth** automáticamente.
        *   Envía el email de bienvenida con credenciales usando **Resend**.
2.  **Frontend**:
    *   Formulario de registro vinculado a Wompi.
    *   Eliminado el envío de email desde el cliente para evitar duplicados.
    *   Corregida la codificación de la `redirect-url` para Wompi.

## ⚠️ Bloqueos / Problemas Pendientes
*   **Firma de Integridad**: Resuelto. El parámetro debe ser `signature:integrity`.
*   **Consistencia de Montos**: Resuelto. Se corrigió la lectura del parámetro `precio` desde el `HashRouter` y se asegura que el `plan` (starter/pro) se guarde correctamente en el tenant al registrarse.
*   **Error de Login (Perfil de Usuario)**: Resuelto. El webhook ahora crea no solo el usuario en Auth, sino también su perfil en la colección `usuarios` de Firestore. Sin este perfil, el `AuthContext` del frontend rechazaba el inicio de sesión.
*   **Consistencia de IDs**: Resuelto. El `tenantId` se genera ahora en el frontend para asegurar que coincida con el `uid` del usuario creado por el webhook.
*   **Despliegue**: Se actualizó `deploy.yml` para excluir reglas de Storage inexistentes.

## 📝 Instrucciones para Siguiente Sesión
1.  Verificar que el parámetro `signature` sea aceptado por Wompi con la nueva codificación.
2.  Si persiste el error de firma, probar cambiando el nombre del parámetro a `integrity-signature`.
3.  Asegurar que el `integrityKey` en `constantes.ts` sea el correcto del dashboard de Sandbox.
4.  Borrar usuarios de prueba (`gengepardo@gmail.com`) tanto en Auth como en Firestore antes de cada test.
