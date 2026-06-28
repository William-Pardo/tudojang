# Fase 1 — Servicios SIN Tests

> **Instrucciones**: Cada sección (§) es un prompt independiente. Copia UNA sección completa al chat de Kilo Code.
> **Antes de empezar**: Lee `.agent/tdd-tracker/kilo-code-rules.md` como contexto.
> **Después de completar cada §**: Actualiza `.agent/tdd-tracker/tdd-state.md`

---

## §1 — configuracionApi.ts

**Archivo a testear**: `servicios/configuracionApi.ts` (7KB)
**Test a crear**: `servicios/configuracionApi.test.ts`

### Contexto
Este servicio maneja la configuración del club/dojang en Firestore. Incluye funciones CRUD para obtener/actualizar configuración, gestión de horarios, y operaciones sobre la estructura del tenant.

### Instrucciones

1. **Lee** `servicios/configuracionApi.ts` completo para entender todas las funciones exportadas
2. **Lee** `servicios/asistenciaApi.test.ts` como referencia del patrón de mock de Firestore
3. **Crea** `servicios/configuracionApi.test.ts` siguiendo este patrón de mock:

```typescript
import { getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
// importa las funciones del servicio

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })), addDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })), where: jest.fn(),
  getDocs: jest.fn(), getDoc: jest.fn(), updateDoc: jest.fn(),
  deleteDoc: jest.fn(), setDoc: jest.fn(),
  doc: jest.fn((...args) => ({ args })), Timestamp: {},
  orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
```

4. **Prueba cada función exportada** con:
   - ✅ Happy path (respuesta exitosa)
   - ❌ Error path (mockRejectedValueOnce con Error)
   - 🔄 Edge cases (datos vacíos, valores null/undefined)

5. **Ejecuta y pega el resultado**:
```bash
npx jest servicios/configuracionApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/configuracionApi.ts"
```

6. **Si coverage < 95%**, identifica las líneas no cubiertas y agrega tests adicionales.

---

## §2 — usuariosApi.ts

**Archivo a testear**: `servicios/usuariosApi.ts` (13KB)
**Test a crear**: `servicios/usuariosApi.test.ts`

### Contexto
Servicio grande que maneja todo el CRUD de usuarios del dojang. Incluye autenticación, gestión de roles, consultas por tenant, operaciones de perfil. Es el servicio más complejo del proyecto.

### Instrucciones

1. **Lee** `servicios/usuariosApi.ts` completo — identifica TODAS las funciones exportadas
2. **Lee** `servicios/estudiantesApi.test.ts` como referencia (servicio grande similar)
3. **Crea** `servicios/usuariosApi.test.ts` con el mock estándar de Firestore (ver §1)
4. **Agrega** mock de Firebase Auth si el servicio lo usa:
```typescript
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));
```

5. **Prueba cada función** con happy path, error path y edge cases
6. **Ejecuta y pega**:
```bash
npx jest servicios/usuariosApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/usuariosApi.ts"
```

---

## §3 — censoApi.ts

**Archivo a testear**: `servicios/censoApi.ts` (6KB)
**Test a crear**: `servicios/censoApi.test.ts`

### Contexto
Servicio para el censo público de practicantes. Maneja formularios públicos de registro, consultas, y operaciones de datos demográficos.

### Instrucciones

1. **Lee** `servicios/censoApi.ts` completo
2. **Crea** `servicios/censoApi.test.ts` con mock estándar de Firestore (ver §1)
3. **Prueba cada función** con happy path, error path, y edge cases (formulario vacío, datos parciales)
4. **Ejecuta y pega**:
```bash
npx jest servicios/censoApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/censoApi.ts"
```

---

## §4 — finanzasApi.ts

**Archivo a testear**: `servicios/finanzasApi.ts` (3KB)
**Test a crear**: `servicios/finanzasApi.test.ts`

### Contexto
Servicio pequeño para operaciones financieras (ingresos, egresos, movimientos). Servicio clave para el negocio.

### Instrucciones

1. **Lee** `servicios/finanzasApi.ts` completo
2. **Crea** `servicios/finanzasApi.test.ts` con mock estándar de Firestore (ver §1)
3. **Presta atención** a cálculos numéricos — usa triangulación con múltiples valores
4. **Ejecuta y pega**:
```bash
npx jest servicios/finanzasApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/finanzasApi.ts"
```

---

## §5 — sedesApi.ts

**Archivo a testear**: `servicios/sedesApi.ts` (3KB)
**Test a crear**: `servicios/sedesApi.test.ts`

### Contexto
CRUD de sedes (locaciones/sucursales) del dojang. Incluye consultas por tenant.

### Instrucciones

1. **Lee** `servicios/sedesApi.ts` completo
2. **Crea** `servicios/sedesApi.test.ts` con mock estándar de Firestore (ver §1)
3. **Prueba** CRUD completo + filtrado por tenant + manejo de sedes sin ciudad
4. **Ejecuta y pega**:
```bash
npx jest servicios/sedesApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/sedesApi.ts"
```

---

## §6 — programasApi.ts

**Archivo a testear**: `servicios/programasApi.ts` (4KB)
**Test a crear**: `servicios/programasApi.test.ts`

### Contexto
Gestión de programas de entrenamiento (Taekwondo, etc). CRUD por tenant.

### Instrucciones

1. **Lee** `servicios/programasApi.ts` completo
2. **Crea** `servicios/programasApi.test.ts` con mock estándar de Firestore (ver §1)
3. **Prueba** cada función exportada con happy/error/edge
4. **Ejecuta y pega**:
```bash
npx jest servicios/programasApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/programasApi.ts"
```

---

## §7 — notificacionesApi.ts

**Archivo a testear**: `servicios/notificacionesApi.ts` (6KB)
**Test a crear**: `servicios/notificacionesApi.test.ts`

### Contexto
Servicio de notificaciones internas del sistema. Maneja creación, lectura, marcado como leídas, y limpieza de notificaciones por usuario/tenant.

### Instrucciones

1. **Lee** `servicios/notificacionesApi.ts` completo
2. **Crea** `servicios/notificacionesApi.test.ts` con mock estándar de Firestore (ver §1)
3. **Prueba** flujos de creación, lectura, marcado, y eliminación + errores
4. **Ejecuta y pega**:
```bash
npx jest servicios/notificacionesApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/notificacionesApi.ts"
```

---

## §8 — tiendaApi.ts

**Archivo a testear**: `servicios/tiendaApi.ts` (15KB)
**Test a crear**: `servicios/tiendaApi.test.ts`

### Contexto
Servicio GRANDE para la tienda del dojang (implementos, uniformes). Incluye CRUD de productos, variaciones, gestión de inventario, solicitudes de compra, y procesamiento de pedidos.

### Instrucciones

1. **Lee** `servicios/tiendaApi.ts` completo — identifica TODAS las funciones (hay muchas)
2. **Lee** `servicios/estudiantesApi.test.ts` como referencia de servicio grande
3. **Crea** `servicios/tiendaApi.test.ts` con mock estándar de Firestore (ver §1)
4. **Agrupa los tests** por entidad/feature (productos, variaciones, solicitudes, inventario)
5. **Prueba** cada función con happy/error/edge
6. **Ejecuta y pega**:
```bash
npx jest servicios/tiendaApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/tiendaApi.ts"
```

---

## §9 — soporteApi.ts + soporteService.ts

**Archivos a testear**: `servicios/soporteApi.ts` (2KB) + `servicios/soporteService.ts` (5KB)
**Tests a crear**: `servicios/soporteApi.test.ts` + `servicios/soporteService.test.ts`

### Contexto
Módulo de soporte técnico / PQR. El API maneja las operaciones de Firestore y el Service orquesta la lógica de negocio.

### Instrucciones

1. **Lee** ambos archivos
2. **Crea** tests separados para cada uno
3. Para `soporteService.ts`, mockea el `soporteApi` como dependencia:
```typescript
jest.mock('./soporteApi');
```
4. **Ejecuta ambos y pega**:
```bash
npx jest servicios/soporteApi.test.ts servicios/soporteService.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/soporteApi.ts" --collectCoverageFrom="servicios/soporteService.ts"
```

---

## §10 — emailService.ts

**Archivo a testear**: `servicios/emailService.ts` (4KB)
**Test a crear**: `servicios/emailService.test.ts`

### Contexto
Servicio de envío de emails (probablemente via Cloud Functions o API externo). Mockea las llamadas HTTP/fetch.

### Instrucciones

1. **Lee** `servicios/emailService.ts` completo
2. **Identifica** si usa `fetch`, `axios`, o Cloud Functions callable
3. **Crea** `servicios/emailService.test.ts` mockeando las dependencias externas apropiadas:
```typescript
// Si usa fetch:
global.fetch = jest.fn();
// Si usa Cloud Functions:
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));
```
4. **Ejecuta y pega**:
```bash
npx jest servicios/emailService.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/emailService.ts"
```

---

## §11 — pushService.ts

**Archivo a testear**: `servicios/pushService.ts` (2KB)
**Test a crear**: `servicios/pushService.test.ts`

### Contexto
Servicio de notificaciones push (FCM). Archivo pequeño.

### Instrucciones

1. **Lee** `servicios/pushService.ts` completo
2. **Crea** `servicios/pushService.test.ts` mockeando Firebase Messaging:
```typescript
jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  onMessage: jest.fn(),
}));
```
3. **Ejecuta y pega**:
```bash
npx jest servicios/pushService.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/pushService.ts"
```

---

## §12 — plantillas.ts

**Archivo a testear**: `servicios/plantillas.ts` (8KB)
**Test a crear**: `servicios/plantillas.test.ts`

### Contexto
Funciones de generación de plantillas HTML (carnets, certificados, recibos). Son funciones puras que reciben datos y retornan strings HTML.

### Instrucciones

1. **Lee** `servicios/plantillas.ts` completo
2. **Crea** `servicios/plantillas.test.ts` — este es FÁCIL porque son funciones puras
3. **No necesita mocks de Firebase**. Solo importa las funciones y verifica el output
4. **Usa** snapshot testing o string matching para validar el HTML generado
5. **Ejecuta y pega**:
```bash
npx jest servicios/plantillas.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/plantillas.ts"
```

---

## §13 — baseConocimiento.ts

**Archivo a testear**: `servicios/baseConocimiento.ts` (4KB)
**Test a crear**: `servicios/baseConocimiento.test.ts`

### Contexto
Base de conocimiento para el asistente virtual. Maneja documentos de FAQ/ayuda almacenados en Firestore.

### Instrucciones

1. **Lee** `servicios/baseConocimiento.ts` completo
2. **Crea** `servicios/baseConocimiento.test.ts` con mock estándar de Firestore (ver §1)
3. **Ejecuta y pega**:
```bash
npx jest servicios/baseConocimiento.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/baseConocimiento.ts"
```

---

## §14 — tudojangRelay.ts

**Archivo a testear**: `servicios/tudojangRelay.ts` (3KB)
**Test a crear**: `servicios/tudojangRelay.test.ts`

### Contexto
Servicio de relay/proxy para comunicación entre servicios. Probablemente usa fetch o axios.

### Instrucciones

1. **Lee** `servicios/tudojangRelay.ts` completo
2. **Crea** `servicios/tudojangRelay.test.ts` mockeando las dependencias HTTP
3. **Ejecuta y pega**:
```bash
npx jest servicios/tudojangRelay.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/tudojangRelay.ts"
```

---

## §15 — wompiWebhook.ts

**Archivo a testear**: `servicios/wompiWebhook.ts` (2KB)
**Test a crear**: `servicios/wompiWebhook.test.ts`

### Contexto
Webhook handler para Wompi (pasarela de pagos colombiana). Maneja validación de firmas y procesamiento de eventos de pago.

### Instrucciones

1. **Lee** `servicios/wompiWebhook.ts` completo
2. **Crea** `servicios/wompiWebhook.test.ts`
3. **Presta especial atención** a la validación de firmas/checksums — usa triangulación
4. **Ejecuta y pega**:
```bash
npx jest servicios/wompiWebhook.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/wompiWebhook.ts"
```
