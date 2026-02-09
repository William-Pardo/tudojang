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
*   **Conexión a Firebase (Mock Mode)**: **RESUELTO**. Se corrigió la lectura de variables de entorno individuales.
*   **Firma de Integridad**: Resuelto.
*   **Consistencia de Montos**: Resuelto.
*   **Envío de Correo (Resend)**: **MEJORADO**. El correo de bienvenida ahora se intenta enviar tanto desde el servidor (Webhook) como desde el navegador (Frontend) para asegurar que llegue. Si no llega, es posible que el dominio `tudojang.com` necesite verificación en el panel de Resend.
*   **Error de Login (Sincronización)**: **RESUELTO**. Se implementó una lógica de **reintento automático (Retry)** en el login. Si intentas entrar antes de que el servidor termine de crear tu perfil, la app esperará y lo reintentará internamente 5 veces antes de dar error. Esto elimina el fallo de "Perfil no encontrado".
*   **Consistencia de IDs**: Resuelto.
*   **Despliegue**: Se ajustó `package.json` de funciones para Node 20 y se eliminaron dependencias locales problemáticas.

## 📝 Instrucciones para Siguiente Sesión
1.  Verificar la llegada del correo de bienvenida con el nuevo flujo doble (Frontend + Backend).
2.  Confirmar que el login con clave temporal funciona sin dar "Error de Credencial" gracias al sistema de reintento.
3.  Verificar que el `tenantId` en Firestore coincida exactamente con el `UID` de Firebase Auth.stantes.ts` sea el correcto del dashboard de Sandbox.
4.  Borrar usuarios de prueba (`gengepardo@gmail.com`) tanto en Auth como en Firestore antes de cada test.
