# Especificaciones de Plataforma Desplegada - Tudojang SaaS

## 1. Contexto y Descripción General
**Tudojang** (disponible en producción en [tudojang.com](https://tudojang.com/)) es una plataforma de software como servicio (SaaS) diseñada específicamente para la gestión integral de escuelas de artes marciales. La aplicación facilita la administración de estudiantes, asistencia, finanzas (incluyendo pasarelas de pago y gestión de efectivo), control de eventos (competencias, exámenes), venta de equipo a través de una tienda integrada, y un sistema automatizado de onboarding de nuevos clubes.

## 2. Stack Tecnológico de Producción
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Framer Motion (animaciones).
- **Gráficos y Datos**: Recharts para el dashboard, HTML2Canvas y jsPDF para exportes y carnetización.
- **Backend / Bases de Datos**: Firebase (Firestore Database, Firebase Auth).
- **Infraestructura Cloud**: Firebase Hosting y Cloud Functions (Node 20).
- **Pasarela de Pagos**: Integración con Wompi (tarjetas) y un módulo propio para conciliación de efectivo.
- **Servicios Integrados**: API de Resend para correos transaccionales, API de Gemini (`@google/genai`) para el asistente virtual y análisis.

## 3. Arquitectura y Estructura de Proyecto

La arquitectura del proyecto sigue una estructura modular orientada a dominio (Domain-Driven Design), dividiendo la lógica en componentes visuales, lógica de rutas (`vistas`), y manejadores de API (`servicios`):

### 3.1. Servicios Core Centrales (`/servicios`)
Capa de abstracción que intercomunica el frontend con Firestore.
- `usuariosApi.ts` / `sedesApi.ts`: Gestión de roles de usuario, escuelas/sedes ("tenants").
- `asistenciaApi.ts` / `estudiantesApi.ts`: Control de asistencia y datos demográficos de los estudiantes.
- `tiendaApi.ts` / `eventosApi.ts`: Lógica de e-commerce interno y organización de exámenes o competencias.
- `finanzasApi.ts` / `pagosApi.ts`: Manejo atómico de cobros, registro financiero de tienda/eventos/mensualidades.
- `api.ts`, `geminiService.ts`, `emailService.ts`: Servicios para integraciones externas.

### 3.2. Vistas Principales (Páginas / Rutas) (`/vistas`)
- **Administración y Dashboards**: `Dashboard.tsx`, `MasterDashboard.tsx`.
- **Gestión Operativa**: `Estudiantes.tsx`, `Finanzas.tsx`, `Horarios.tsx`, `Configuracion.tsx`, `Notificaciones.tsx`.
- **Especializadas**: 
  - `Carnetizacion.tsx` (generación de credenciales optimizadas para impresión).
  - `EscanerAsistencia.tsx` (ingreso mediante QR).
  - `MisionKicho.tsx` / `GestionClase.tsx` (simuladores y control en vivo).
- **Públicas y Pasarelas**: `PublicLanding.tsx`, `VistaTiendaPublica.tsx`, `PasarelaPagos.tsx`, `PasarelaInscripcion.tsx`.

### 3.3. Componentes Reutilizables y UI (`/components`)
- **Elementos Dinámicos y Formularios**: `FormularioEstudiante.tsx`, `FormularioUsuario.tsx`, `ModalRegistrarPago.tsx` (Caja POS en efectivo), `ModalImportacionMasiva.tsx` (importación masiva Excel `.xlsx` con auditoría de filas; tests en `ModalImportacionMasiva.test.tsx`, task-976).
- **Elementos de Marca**: `Iconos.tsx` (con escalabilidad SVG), `LogoDinamico.tsx`, `BrandingProvider.tsx` (gestiona la paleta de colores del inquilino dinámicamente).
- **Elementos de Lista**: `FilaEstudiante.tsx`, `TarjetaEventoAdmin.tsx`.

### 3.4. Cloud Functions / Backend Operativo (`/functions/index.js`)
Endpoints desplegados que operan del lado del servidor seguro para validación de transacciones (Webhooks de Wompi), envío automatizado de correos vía Resend, y on-boarding seguro tras pago de licencias.

## 4. Funcionalidades y Especificaciones Core

1. **Autenticación y Multitenencia (Multi-Tenant)**: 
   Soporte para múltiples academias. Cada usuario (dependiendo de su rol: Master, Instructor, Estudiante) visualiza únicamente la información de su sede con marcas y paletas de colores personalizables.
2. **Carnetización Industrial**:
   Motor generador de PDFs a 300 DPI, con márgenes de pinza (10mm) y contrastes dinámicos basados en luminancia para prevenir textos ilegibles según la paleta del club. Soporte físico para layouts Carta, Oficio y tipo tarjeta de crédito (CR80).
3. **Módulo Financiero Dual (Online/Físico)**:
   Los padres de familia o estudiantes pueden realizar pagos online vía pasarela Wompi o reportar/realizar pagos en efectivo directamente en la academia a través del punto de venta o módulo `ModalRegistrarPago.tsx`.
4. **Control In-Class**:
   Control en vivo de asistencia (`GestionClase.tsx` y `EscanerAsistencia.tsx`) y simuladores automatizados para pruebas de carga.
5. **Tienda y Artículos**:
   Control de inventario, aprobación de compras e insumos de artes marciales en la ruta local de la cuenta.

## 5. Resumen de Despliegue (Deploy)
- El entorno está automatizado bajo comandos estándar de NPM.
- La compilación usa Vite (`npm run build`).
- El despliegue de las reglas, funciones y hosting se ejecuta hacia Firebase usando `firebase deploy`.
- **URLs Relevantes**:
  - Plataforma: https://tudojang.com
  - Consola Google Firebase: Project ID `tudojang`
  - GitHub/Repositorio Raíz: `e:\Apps\Tudojang`
