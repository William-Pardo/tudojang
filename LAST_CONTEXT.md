# Resumen de Estado - Tudojang SaaS
**Fecha**: 2026-02-17
**Estado Actual**: Producción Estable - Bug de Eliminación Corregido

## 🥋 Proyecto: Tudojang
Tudojang es una plataforma SaaS diseñada para la gestión integral de escuelas de artes marciales. Incluye control de asistencia, gestión de pagos, tienda de artículos y un sistema de onboarding automatizado para nuevos clubes.

---

## 🎯 Objetivo Actual
Mantener la estabilidad de producción y continuar con las pruebas de límites de suscripción.

---

## 🛠️ Hitos Recientes (Febrero 2026)

### 1. **Corrección de Bug: Eliminación de Sedes y Perfiles** (17/02)
- **Problema**: Al eliminar sedes o perfiles de equipo, los cambios no persistían. Al navegar a otra página y regresar, los elementos eliminados "revivían".
- **Causa Raíz**: En `vistas/Configuracion.tsx`, la función `eliminarSede(s.id)` se llamaba sin `await`, provocando que la notificación de éxito apareciera antes de confirmar la eliminación en Firebase.
- **Solución Implementada**:
  - Se agregó `async/await` en el manejador onClick del botón de eliminar sede.
  - Se añadió manejo de errores con try/catch.
  - Se mejoró el logging en `sedesApi.ts` y `usuariosApi.ts`.
- **Archivos Modificados**:
  - `vistas/Configuracion.tsx` (línea 655)
  - `servicios/sedesApi.ts` (línea 34)
  - `servicios/usuariosApi.ts` (línea 269)

### 2. **Resolución de Error 404 en Producción** (16/02 - 17/02)
- **Problema**: La aplicación mostraba error 404 al acceder a tudojang.com.
- **Causa**: La carpeta `dist/` no existía o no tenía los archivos compilados.
- **Solución**: Ejecutar `npm run build` y `firebase deploy --only hosting`.
- **Verificación**: `curl https://tudojang.com/` retorna HTTP 200 OK.

### 3. **Estabilización de Infraestructura y Despliegue** (16/02)
- **Problema de Conexión (404)**: Se identificó y trabajó en la resolución de errores "Not Found" al acceder a rutas específicas de la aplicación.
- **Migración Tailwind**: Se eliminó la dependencia del CDN de Tailwind y se configuró correctamente como un plugin de **PostCSS** y via CLI para asegurar estilos consistentes en producción.

### 4. **Actualización de Planes y Límites** (13/02 - 16/02)
- Se actualizaron los precios y límites en `constantes.ts`:
  - **Starter**: 50 alumnos, 2 instructores, 1 sede ($160,000 COP).
  - **Growth**: 150 alumnos, 5 instructores, 2 sedes ($340,000 COP).
  - **Pro**: 350 alumnos, 10 instructores, 5 sedes ($580,000 COP).
- Ajuste de lógica de validación para respetar estos nuevos límites en toda la aplicación.

### 5. **Gestión de Perfiles y Datos** (12/02 - 13/02)
- **Lugar de Ejecución**: Se corrigieron errores en el formulario de perfil de usuario para asegurar que el campo "Lugar de Ejecución" sea persistente y funcional.
- **Sincronización Auth-Firestore**: Se mejoró el sistema de reintentos (Retry logic) en el login para evitar el error de "Perfil no encontrado" cuando el documento de Firestore tarda en crearse después del registro en Firebase Auth.

### 6. **Pasarela de Pagos (Wompi)** (11/02)
- Corrección de la **Firma de Integridad** para transacciones seguras.
- Mejora en la redirección post-pago y el manejo de webhooks para activar suscripciones automáticamente.

### 7. **Onboarding SaaS Seguro** (08/02 - 10/02)
- Implementación de **Resend** para el envío de credenciales temporales.
- Flujo de creación automática de usuario admin en Firebase Auth desde Cloud Functions tras el pago exitoso.
- Sistema de "doble envío" de emails (Frontend + Backend) para garantizar la recepción de credenciales.

---

## 🏗️ Stack Tecnológico
- **Frontend**: React (Vite) + TypeScript + Tailwind CSS.
- **Backend**: Firebase Auth + Firestore + Cloud Functions (Node 20).
- **Pagos**: Wompi (Sandbox & Production).
- **Emails**: Resend.
- **Testing**: Jest (Unitarios) + Cypress (E2E).

---

## 📝 Próximos Pasos e Instrucciones
1. **Pruebas de Eliminación**: Verificar que la eliminación de sedes y perfiles persista correctamente después de navegar por la aplicación.
2. **Pruebas de Límites**: Validar que un usuario en plan *Starter* no pueda crear más de 50 alumnos ni 2 instructores.
3. **Validación de Webhooks**: Comprobar en el dashboard de Wompi que los eventos `transaction.updated` están llegando correctamente a la URL de la Cloud Function.

---

## 🔗 URLs de Producción
- **Hosting Principal**: https://tudojang.com
- **Hosting Alternativo**: https://tudojang.web.app
- **Console Firebase**: https://console.firebase.google.com/project/tudojang/overview

---
**Nota**: Este archivo es una referencia rápida para mantener el contexto entre sesiones. Actualizar siempre que se complete un hito mayor.
