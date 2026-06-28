# Fase 4 — Vistas SIN Tests (Integración/UI)

> **Instrucciones**: Cada sección (§) es un prompt independiente. Copia UNA sección completa al chat de Kilo Code.
> **Antes de empezar**: Lee `.agent/tdd-tracker/kilo-code-rules.md` como contexto.
> **Objetivo**: Probar los componentes "View" (rutas a nivel superior) interceptando el data-fetching de los hooks o mockeando APIs.

---

## Patrones Globales para Vistas

Las Vistas (Views/Pages) en React conectan varios componentes y servicios. En lugar de mockear cada subcomponente, solemos **mockear el hook de datos** o los **Servicios API**.

Ejemplo de mock:
```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// import Vista...

// Mock servicios
jest.mock('../servicios/api', () => ({
  obtenerDatos: jest.fn().mockResolvedValue([{ id: 1, nombre: 'Test' }])
}));

// Y usa MemoryRouter siempre al renderizar:
render(
  <MemoryRouter>
    <MiVista />
  </MemoryRouter>
);
```

Lee `vistas/Dashboard.test.tsx` como la referencia absoluta de cómo mockear.

---

## §1 — Vistas de Eventos

**Archivos a testear**: `vistas/Eventos.tsx`, `vistas/EventoPublico.tsx`
**Tests a crear**: `vistas/Eventos.test.tsx`, `vistas/EventoPublico.test.tsx`

### Instrucciones

1. **Lee** ambos archivos para ver qué hooks o servicios utilizan (ej. `useEventos`, `eventosApi`).
2. **Mockea** esos dependencias para devolver arrays simulados (1 evento, 0 eventos).
3. Prueba la vista de carga (loaders), el renderizado de la lista, y estados vacíos.
4. Para `EventoPublico`, prueba el manejo del ID en la URL (`useParams`).
5. **Ejecuta y pega**:
```bash
npx jest vistas/Eventos.test.tsx vistas/EventoPublico.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/Eventos.tsx" --collectCoverageFrom="vistas/EventoPublico.tsx"
```

---

## §2 — Vista de Configuración

**Archivo a testear**: `vistas/Configuracion.tsx`
**Test a crear**: `vistas/Configuracion.test.tsx`

### Instrucciones

1. **¡OJO!** Archivo muy grande (71KB). Probablemente contiene múltiples pestañas o secciones administrables.
2. Identifica los hooks de estado (tabs, toggles) y APIs llamadas.
3. Prueba que al hacer click en las diferentes pestañas de configuración (General, Notificaciones, etc.) cambie el contenido renderizado.
4. Prueba el flujo de guardado simulando una petición exitosa y un error de red (`mockRejectedValueOnce`).
5. **Ejecuta y pega**:
```bash
npx jest vistas/Configuracion.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/Configuracion.tsx"
```

---

## §3 — Master Access & Admin

**Archivos a testear**: `vistas/Administracion.tsx`, `vistas/MasterAccess.tsx`, `vistas/MasterDashboard.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. Son las vistas de súper-administración multiplataforma.
2. Dependerán de validaciones de rol. Simula diferentes respuestas del contexto de Autenticación/Tenant.
3. Para `MasterDashboard.tsx` (43KB), enfócate en testear la carga de métricas y los listados de tenants/escuelas.
4. **Ejecuta y pega**:
```bash
npx jest vistas/Administracion.test.tsx vistas/MasterAccess.test.tsx vistas/MasterDashboard.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/Administracion.tsx" --collectCoverageFrom="vistas/MasterAccess.tsx" --collectCoverageFrom="vistas/MasterDashboard.tsx"
```

---

## §4 — Perfiles de Usuario

**Archivos a testear**: `vistas/MiPerfil.tsx`, `vistas/PerfilTutor.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. Mockea las respuestas del `usuarioApi` o contextos.
2. Comprueba que se rendericen los datos del usuario logueado en los inputs/campos.
3. Verifica la actualización de datos simulando envíos de formulario.
4. **Ejecuta y pega**:
```bash
npx jest vistas/MiPerfil.test.tsx vistas/PerfilTutor.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/MiPerfil.tsx" --collectCoverageFrom="vistas/PerfilTutor.tsx"
```

---

## §5 — Pasarelas y Flujos Públicos

**Archivos a testear**: `vistas/PasarelaInscripcion.tsx`, `vistas/PasarelaPagos.tsx`, `vistas/ReportarPagoPublico.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. Son vistas públicas donde usuarios externos interactúan (formularios multicapa, wizzards).
2. Tienen flujos de pasos (Paso 1, Paso 2, etc.). Simula clicks en botones "Siguiente" y verifica que el step cambie.
3. Mockea APIs de procesamiento como `wompiWebhook` o `pagosApi`.
4. **Ejecuta y pega**:
```bash
npx jest vistas/PasarelaInscripcion.test.tsx vistas/PasarelaPagos.test.tsx vistas/ReportarPagoPublico.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/PasarelaInscripcion.tsx" --collectCoverageFrom="vistas/PasarelaPagos.tsx" --collectCoverageFrom="vistas/ReportarPagoPublico.tsx"
```

---

## §6 — Tienda Pública y Vistas de Inventario

**Archivos a testear**: `vistas/Tienda.tsx`, `vistas/VistaTiendaPublica.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. `Tienda.tsx` es el admin (interno), `VistaTiendaPublica.tsx` es lo que ve el estudiante/público.
2. Prueba listas de productos, filtros de categorías, modal de compra e interfaces vacías.
3. **Ejecuta y pega**:
```bash
npx jest vistas/Tienda.test.tsx vistas/VistaTiendaPublica.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/Tienda.tsx" --collectCoverageFrom="vistas/VistaTiendaPublica.tsx"
```

---

## §7 — Landing Pages y Registro Externo

**Archivos a testear**: `vistas/PublicLanding.tsx`, `vistas/RegistroEscuela.tsx`, `vistas/CensoPublico.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. Son vistas informativas o formularios sin sesión.
2. Mockea requests de creación (añadir nuevo dojang, responder censo) y verifica notificaciones toast/redirects en onSuccess.
3. **Ejecuta y pega**:
```bash
npx jest vistas/PublicLanding.test.tsx vistas/RegistroEscuela.test.tsx vistas/CensoPublico.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/PublicLanding.tsx" --collectCoverageFrom="vistas/RegistroEscuela.tsx" --collectCoverageFrom="vistas/CensoPublico.tsx"
```

---

## §8 — Componentes de Operación Diaria (Clases, Horarios, Carnets)

**Archivos a testear**: `vistas/GestionClase.tsx`, `vistas/Horarios.tsx`, `vistas/Carnetizacion.tsx`, `vistas/Certificaciones.tsx`
**Tests a crear**: En `vistas/`

### Instrucciones

1. Vistas pesadas en manipulación de datos y visualización (tablas, calendarios).
2. Valida la renderización de la información. No intentes testear a fondo librerías externas complejas como calendarios, céntrate en la respuesta de tu propio componente a los mock-datos.
3. **Ejecuta y pega**:
```bash
npx jest vistas/GestionClase.test.tsx vistas/Horarios.test.tsx vistas/Carnetizacion.test.tsx vistas/Certificaciones.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="vistas/GestionClase.tsx" --collectCoverageFrom="vistas/Horarios.tsx" --collectCoverageFrom="vistas/Carnetizacion.tsx" --collectCoverageFrom="vistas/Certificaciones.tsx"
```
