# Fase 3 — Componentes SIN Tests (React Testing Library)

> **Instrucciones**: Cada sección (§) es un prompt independiente. Copia UNA sección completa al chat de Kilo Code.
> **Antes de empezar**: Lee `.agent/tdd-tracker/kilo-code-rules.md` como contexto.
> **Objetivo**: Renderizar el componente, interactuar con userEvent y validar el output visual/callbacks. Coverage > 95%.

---

## Patrones Globales para Componentes

Al crear tests de componentes, usa este setup:

```tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Importa el componente

// 1. Mock de contextos y navegación
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// 2. Mock de DataContext (si el componente lo usa)
jest.mock('../context/DataContext', () => ({
  useSedes: () => ({ sedes: [], sedesVisibles: [] }),
  useConfiguracion: () => ({ configClub: { diasSuspension: 15 } }),
  useProgramas: () => ({ programas: [] }),
}));

// 3. Mock de NotificacionContext
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: jest.fn() }),
}));

// 4. Mock de Framer Motion
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { 
    div: (props: any) => <div {...props} />,
    tr: (props: any) => <tr {...props} />,
    span: (props: any) => <span {...props} />
  },
}));
```

---

## §1 — Componentes UI Básicos

**Archivos a testear**: `EmptyState.tsx`, `ErrorState.tsx`, `Loader.tsx`
**Tests a crear**: En la misma carpeta `components/` (ej: `EmptyState.test.tsx`)

### Instrucciones

1. Estos componentes son puros o "presentacionales". Reciben props y renderizan UI.
2. Crea un test por archivo.
3. Prueba que renderizan correctamente el título, descripción e iconos.
4. Si reciben botones/callbacks (ej. `onAction` o `onRetry`), simula un click con `userEvent` y verifica que la función fue llamada.
5. **Ejecuta y pega**:
```bash
npx jest components/EmptyState.test.tsx components/ErrorState.test.tsx components/Loader.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/EmptyState.tsx" --collectCoverageFrom="components/ErrorState.tsx" --collectCoverageFrom="components/Loader.tsx"
```

---

## §2 — Componentes de Estado Menor

**Archivos a testear**: `EstadoPagoBadge.tsx`, `FormInputError.tsx`, `ToggleSwitch.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. Crea un archivo de test para cada componente.
2. Prueba las variantes visuales:
   - `EstadoPagoBadge`: Renderizado según cada estado (`AlDia`, `Pendiente`, `Vencido`).
   - `FormInputError`: Renderizado solo cuando el mensaje existe.
   - `ToggleSwitch`: Cambio de estado on/off, disparo del callback `onChange`, estado deshabilitado.
3. **Ejecuta y pega**:
```bash
npx jest components/EstadoPagoBadge.test.tsx components/FormInputError.test.tsx components/ToggleSwitch.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/EstadoPagoBadge.tsx" --collectCoverageFrom="components/FormInputError.tsx" --collectCoverageFrom="components/ToggleSwitch.tsx"
```

---

## §3 — Componentes de Formulario Complejos: FormularioUsuario

**Archivo a testear**: `components/FormularioUsuario.tsx`
**Test a crear**: `components/FormularioUsuario.test.tsx`

### Instrucciones

1. Este componente usa `react-hook-form` extensivamente.
2. Asegura tener los mocks de contextos (DataContext, NotificacionContext).
3. Pruebas clave:
   - Renderizado de todos los inputs (nombre, email, rol).
   - Validaciones de formulario (errores al hacer submit vacío, emails inválidos).
   - Llenado del formulario y llamado a `onSubmit`.
   - Carga de datos iniciales cuando recibe el prop `usuarioAEditar`.
4. **Ejecuta y pega**:
```bash
npx jest components/FormularioUsuario.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/FormularioUsuario.tsx"
```

---

## §4 — Componentes de Formulario Complejos: FormularioSede

**Archivo a testear**: `components/FormularioSede.tsx`
**Test a crear**: `components/FormularioSede.test.tsx`

### Instrucciones

1. Mismas directrices que `FormularioUsuario`.
2. Prueba validaciones obligatorias, ingreso de datos de dirección y ciudad.
3. **Ejecuta y pega**:
```bash
npx jest components/FormularioSede.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/FormularioSede.tsx"
```

---

## §5 — Componentes de Formulario Complejos: FormularioImplemento y Movimiento

**Archivos a testear**: `components/FormularioImplemento.tsx`, `components/FormularioMovimiento.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. Son formularios dependientes de la tienda e inventario.
2. Crea los mocks necesarios para los campos `select` o lógicas dinámicas (como añadir variaciones de tallas).
3. Prueba add/remove de campos dinámicos (variaciones en implementos).
4. **Ejecuta y pega**:
```bash
npx jest components/FormularioImplemento.test.tsx components/FormularioMovimiento.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/FormularioImplemento.tsx" --collectCoverageFrom="components/FormularioMovimiento.tsx"
```

---

## §6 — Listas y Tablas: Usuarios

**Archivos a testear**: `FilaUsuario.tsx`, `TablaUsuarios.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. Lee `components/TablaEstudiantes.test.tsx` como patrón de diseño para mockear la Fila dentro de la Tabla.
2. Prueba que la Fila renderiza los datos correctos (nombre, rol, sedes).
3. Prueba que la Tabla itera y muestra tantas filas como datos reciba, y maneja el array vacío (`EmptyState`).
4. Dispara las acciones (Editar/Eliminar) y verifica los callbacks.
5. **Ejecuta y pega**:
```bash
npx jest components/FilaUsuario.test.tsx components/TablaUsuarios.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/FilaUsuario.tsx" --collectCoverageFrom="components/TablaUsuarios.tsx"
```

---

## §7 — Tarjetas Dinámicas (Eventos y Historial)

**Archivos a testear**: `TarjetaEventoAdmin.tsx`, `TarjetaEventoPublico.tsx`, `TarjetaHistorial.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. Renderizan datos muy específicos con formatos de fechas y cálculos (ej. días restantes).
2. Pasa datos mockeados y usa `getByText` para validar el formateo de los campos.
3. **Ejecuta y pega**:
```bash
npx jest components/TarjetaEventoAdmin.test.tsx components/TarjetaEventoPublico.test.tsx components/TarjetaHistorial.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/TarjetaEventoAdmin.tsx" --collectCoverageFrom="components/TarjetaEventoPublico.tsx" --collectCoverageFrom="components/TarjetaHistorial.tsx"
```

---

## §8 — Modales Operativos (Parte 1)

**Archivos a testear**: `ModalAgendarClase.tsx`, `ModalBusquedaGlobal.tsx`, `ModalCompartirEvento.tsx`, `ModalCompartirTienda.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. Estos modales a menudo dependen de un portal o simplemente devuelven UI con z-index alto.
2. Prueba:
   - Que cierran al presionar escape o el botón "X" (callback `onClose`).
   - Lógicas internas (ej: buscar algo en el input dispara la acción de búsqueda en `BusquedaGlobal`).
   - Click en el botón de copiar URL en los modales de Compartir.
3. **Ejecuta y pega**:
```bash
npx jest components/ModalAgendarClase.test.tsx components/ModalBusquedaGlobal.test.tsx components/ModalCompartirEvento.test.tsx components/ModalCompartirTienda.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/ModalAgendarClase.tsx" --collectCoverageFrom="components/ModalBusquedaGlobal.tsx" --collectCoverageFrom="components/ModalCompartirEvento.tsx" --collectCoverageFrom="components/ModalCompartirTienda.tsx"
```

---

## §9 — Modales Operativos (Parte 2)

**Archivos a testear**: `ModalGestionarSolicitudes.tsx`, `ModalImportacionMasiva.tsx`, `ModalRecuperarContrasena.tsx`, `ModalSeleccionarEstudiante.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. `ModalImportacionMasiva` tiene lógica pesada para leer **Excel (.xlsx/.xls)** vía `xlsx` y `FileReader`. Mockea `xlsx` (`read`, `writeFile`, `utils.*`) y el File API (`readAsArrayBuffer`). **No uses papaparse** — el componente no importa CSV.
2. `ModalGestionarSolicitudes` aprueba/rechaza pedidos de tienda. Verifica los botones correspondientes.
3. `ModalRecuperarContrasena` valida un input de email y dispara un Firebase Auth call mockeado.
4. **Ejecuta y pega**:
```bash
npx jest components/ModalGestionarSolicitudes.test.tsx components/ModalImportacionMasiva.test.tsx components/ModalRecuperarContrasena.test.tsx components/ModalSeleccionarEstudiante.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/ModalGestionarSolicitudes.tsx" --collectCoverageFrom="components/ModalImportacionMasiva.tsx" --collectCoverageFrom="components/ModalRecuperarContrasena.tsx" --collectCoverageFrom="components/ModalSeleccionarEstudiante.tsx"
```

### ✅ Completado — `ModalImportacionMasiva` (task-976)

| Campo | Valor |
|-------|-------|
| Test | `components/ModalImportacionMasiva.test.tsx` |
| Casos | 21 |
| Cobertura | 100% Stmts · 100% Branch · 100% Funcs · 100% Lines |
| Fecha | 2026-06-22 |

**Props reales del componente:** `abierto`, `onCerrar`, `onExito` (no `isOpen`/`onCancel`/`files`).

**Escenarios cubiertos:** pasos `inicio`/`previa`/`procesando`; descarga plantilla; carga Excel (vacío, estructura inválida, error lectura); auditoría por fila (tutor, grado, correo, ID, fecha); cancelar preview; importación exitosa/parcial; defaults de sede/grado/campos médicos; `Date` en celda Excel; desmontaje.

**Referencia de implementación:** ver `ModalImportacionMasiva.test.tsx` (helper `simularCargaExcel`, mocks de contexto y `xlsx`).

---

## §10 — Modales Operativos (Parte 3)

**Archivos a testear**: `ModalSolicitarCompra.tsx`, `ModalSolicitarInscripcion.tsx`, `ModalVerFirma.tsx`
**Tests a crear**: En `components/`

### Instrucciones

1. `ModalSolicitarCompra/Inscripcion` combinan lógica de visualización de productos y formulario.
2. `ModalVerFirma` renderiza un canvas/imagen con Base64 u URL. Verifica el `src` renderizado.
3. **Ejecuta y pega**:
```bash
npx jest components/ModalSolicitarCompra.test.tsx components/ModalSolicitarInscripcion.test.tsx components/ModalVerFirma.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/ModalSolicitarCompra.tsx" --collectCoverageFrom="components/ModalSolicitarInscripcion.tsx" --collectCoverageFrom="components/ModalVerFirma.tsx"
```

---

## §11 — AsistenteVirtual.tsx

**Archivo a testear**: `components/AsistenteVirtual.tsx`
**Test a crear**: `components/AsistenteVirtual.test.tsx`

### Instrucciones

1. Un chat UI complejo flotante (probablemente basado en LLMs).
2. Mockea llamadas al servicio `geminiService` o de Inteligencia Artificial que se use detrás.
3. Prueba abrir el chat, escribir un mensaje, simular la respuesta, auto-scroll (mockea `scrollIntoView`), y cerrar el chat.
4. **Ejecuta y pega**:
```bash
npx jest components/AsistenteVirtual.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/AsistenteVirtual.tsx"
```
