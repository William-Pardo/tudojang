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
*   **Firma de Integridad**: Wompi reportaba "Firma de integridad requerida no enviada" a pesar de incluir el parámetro `signature`. Se aplicó una corrección en la codificación de la URL.
*   **Credenciales**: Se requiere confirmar que las llaves en `constantes.ts` (Sandbox) correspondan a las del dashboard "Modo Pruebas" de la cuenta "Aliant".
*   **Despliegue**: Se actualizó `deploy.yml` para excluir reglas de Storage inexistentes, facilitando el despliegue por GitHub Actions.

## 📝 Instrucciones para Siguiente Sesión
1.  Verificar que el parámetro `signature` sea aceptado por Wompi con la nueva codificación.
2.  Si persiste el error de firma, probar cambiando el nombre del parámetro a `integrity-signature`.
3.  Asegurar que el `integrityKey` en `constantes.ts` sea el correcto del dashboard de Sandbox.
4.  Borrar usuarios de prueba (`gengepardo@gmail.com`) tanto en Auth como en Firestore antes de cada test.
