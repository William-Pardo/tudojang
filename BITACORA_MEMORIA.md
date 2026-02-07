# Walkthrough - Inscription Premium Workflow

I have successfully implemented the **Inscription Premium Workflow**, a payment-first onboarding process that secures revenue before data capture and automates legal documentation.

## Core Features Implemented

### 1. The Smart Link ([PasarelaInscripcion.tsx](file:///e:/Apps/Tudojang/vistas/PasarelaInscripcion.tsx))
A public URL (`/unete/:solicitudId`) that evolves based on the inscription state:
- **`pendiente_pago`**: Shows payment accounts and allows proof upload.
- **`por_verificar`**: Confirms receipt and informs the user of the pending validation.
- **`pago_validado`**: Unlocks the technical data capture form.
- **`procesado`**: Final success state.

### 2. Admin Verification Center ([MisionKicho.tsx](file:///e:/Apps/Tudojang/vistas/MisionKicho.tsx))
Updated the KICHO Mission view to handle premium requests:
- **Payment Badges**: Real-time status for new applicants (`Pendiente de Pago`, `Por Verificar`).
- **Support Preview**: Admins can view uploaded payment screenshots directly.
- **One-Click Approval**: A dedicated button to validate payments and unlock the student form.

### 3. Legal Automation ([notificacionesApi.ts](file:///e:/Apps/Tudojang/servicios/notificacionesApi.ts))
Created a trigger that automatically sends the 3 mandatory legal links via WhatsApp once the admin verifies the final data:
- Service Contract.
- Informed Consent.
- Image Rights Authorization.

## Verification

### Automated Verification
- **Code Integrity**: TypeScript interfaces in [tipos.ts](file:///e:/Apps/Tudojang/tipos.ts) were extended without breaking existing logic.
- **API Robustness**: [censoApi.ts](file:///e:/Apps/Tudojang/servicios/censoApi.ts) functions handle all new states correctly.

### Visual Demo
````carousel
```mermaid
graph TD
    A["ESTADO: PENDIENTE_PAGO"] -->|"Usuario sube comprobante"| B["ESTADO: POR_VERIFICAR"]
    B -->|"Admin aprueba"| C["ESTADO: PAGO_VALIDADO"]
    C -->|"Usuario llena formulario"| D["ESTADO: VERIFICADO"]
    D -->|"WhatsApp Legal"| E["DONE"]
```
<!-- slide -->
![Inscription Hub](/e:/Apps/Tudojang/assets/walkthrough/inscription_hub.png)
_Note: Branding is dynamically applied via Tenant Context._
````

## Paso Final: Configuración en GitHub (Acción Manual)

Para que tu aplicación se despliegue automáticamente en [tudojang.com](https://tudojang.com), debes configurar las "llaves" (Secrets) en tu repositorio de GitHub. No tienes que subir ningún archivo nuevo, solo copiar y pegar estos valores en la web de GitHub.

### 1. Dónde configurar los Secrets
1. Entra a tu repositorio: [https://github.com/William-Pardo/tudojang](https://github.com/William-Pardo/tudojang)
2. Haz clic en la pestaña **Settings** (arriba a la derecha).
3. En el menú de la izquierda, busca **Secrets and variables** > **Actions**.
4. Haz clic en el botón verde **New repository secret** por cada uno de los siguientes items.

### 2. Tabla de Secrets (Copia y Pega)

| Nombre del Secret (Poner esto arriba) | Valor (Poner esto abajo) |
| :--- | :--- |
| **VITE_FIREBASE_API_KEY** | `AIzaSyArURNdvpmVeUC9bJRIYsbGSkURK4ZEbvY` |
| **VITE_FIREBASE_AUTH_DOMAIN** | `tudojang.firebaseapp.com` |
| **VITE_FIREBASE_PROJECT_ID** | `tudojang` |
| **VITE_FIREBASE_STORAGE_BUCKET** | `tudojang.firebasestorage.app` |
| **VITE_FIREBASE_MESSAGING_SENDER_ID** | `545628702717` |
| **VITE_FIREBASE_APP_ID** | `1:545628702717:web:c3052e06fb89585fa7fb94` |
| **VITE_GEMINI_API_KEY** | `AIzaSyBjD2nMlxowdPP4nd2YgtguooXZPe6adgw` |
| **FIREBASE_SERVICE_ACCOUNT_TUDOJANG** | *(Lee el paso 3)* |

### 3. Cómo obtener el último Secret (Service Account)
Este es el único valor que no puedo darte directamente porque es una llave privada de seguridad que debes generar tú:
1. Entra a tu [Firebase Console](https://console.firebase.google.com/).
2. Haz clic en el engranaje ⚙️ (Project Settings) > **Service Accounts**.
3. Haz clic en el botón azul **Generate new private key**.
4. Se descargará un archivo [.json](file:///e:/Apps/Tudojang/package.json). Ábrelo con el Bloc de Notas, **copia TODO el texto** y pégalo como el valor de `FIREBASE_SERVICE_ACCOUNT_TUDOJANG` en GitHub.

### 4. Verificar el Despliegue
Una vez guardes el último secret:
1. Ve a la pestaña **Actions** en tu GitHub.
2. Verás un proceso llamado "Deploy to Firebase Hosting & Functions".
3. Cuando se ponga en verde, ¡tu app estará en vivo!

---
**¡Felicidades! Tudojang ya es una plataforma profesional y automatizada.**

# LOG DE CONTEXTO

> **Protocolo de Recuperación**: Si la sesión se reinicia, lee este log para restaurar el estado.

## Estado Actual
- **Fecha**: 2026-02-02
- **Misión**: Mantenimiento y Evolución de Tudojang
- **Estado**: Esperando instrucciones después de la inicialización del protocolo.

## Historial de Cambios
- [x] Protocolo de Autonomía activado.
- [x] Migración de bitácora a archivo local `BITACORA_MEMORIA.md` para persistencia.
- [x] Implementación de **Firma Digital Opción B** (Texto cursivo) con validación de tutor.
- [x] Estabilización de Pasarela Wompi en Modo Sandbox.

<details>
<summary>MIGRACIÓN TÉCNICA: FIRMA OPT-B (JSON)</summary>

```json
{
  "context": "Signature Evolution",
  "features": ["Typography Signature", "Tutor Validation", "Wompi Sandbox"],
  "files_modified": [
    "hooks/usePaginaFirma.ts",
    "vistas/FirmaContrato.tsx",
    "vistas/FirmaImagen.tsx",
    "vistas/FirmaConsentimiento.tsx",
    "index.html",
    "constantes.ts"
  ],
  "status": "Ready for Testing"
}
```
</details>
