# Manual Maestro de Refactorización y TDD Ultrariguroso para Tudojang

Este documento es una especificación técnica de precisión matemática diseñada para que **Codex** o **Cursor** ejecuten el proceso de TDD (Test-Driven Development) y refactorización sin desviaciones, garantizando un 100% de cobertura y calidad de software de nivel Enterprise.

---

## 1. El Estándar de Rigor Técnico (Reglas Inquebrantables)

### 1.1 Ciclo TDD Estricto por Componente/Servicio
Para cada archivo a intervenir, Codex/Cursor debe seguir este flujo secuencial:
1. **Red (Fallo):** Escribir la suite de pruebas describiendo el comportamiento esperado, aserciones y excepciones *antes* de modificar el código de producción. Ejecutar el test y comprobar que falla.
2. **Green (Paso):** Escribir la implementación mínima necesaria en el código de producción para que las pruebas pasen con éxito.
3. **Refactor (Limpieza):** Mejorar la estructura del código garantizando legibilidad, tipado estricto y desacoplamiento, sin alterar el comportamiento verificado por las pruebas.

### 1.2 Estructura Obligatoria de Archivos de Prueba
Cada archivo de prueba (`*.test.ts` o `*.test.tsx`) debe contener como mínimo:
- **Pruebas de Flujo Feliz (Happy Paths):** Cobertura de las funcionalidades en condiciones óptimas.
- **Pruebas de Límites (Boundary Tests):** Inputs en los límites (ej. strings vacíos, fechas futuras, números negativos).
- **Pruebas de Excepciones y Robustez:** Simular caídas de Firebase, fallos de red (`mockRejectedValueOnce`) y validar el manejo de errores.
- **Pruebas de Triangulación:** Mínimo 3 datasets diferentes para validar cálculos lógicos y evitar implementaciones "cableadas" o hardcodeadas.

---

## 2. Especificación Detallada de Ejecución por Verticales

---

### Vertical A: Módulo Estudiantes

#### 1. `servicios/estudiantesApi.ts`
- **Refactor:** Asegurar control de errores tipado y normalización del campo `carnetGenerado`.
- **Casos de Test Obligatorios en `servicios/estudiantesApi.test.ts`:**
  - `obtenerEstudiantes`: Integración con snapshot de Firebase simulando 2 registros válidos; simulación de error de red arrojando `Error('Red caída')`.
  - `obtenerEstudiantePorId`: Búsqueda de ID inexistente debe lanzar la excepción `"Estudiante no encontrado."`.
  - `agregarEstudiante`: Triangulación de edades para asignación de grupo:
    - Input: `2018-01-01` -> Output: `GrupoEdad.Infantil`
    - Input: `2014-06-01` -> Output: `GrupoEdad.Precadetes`
    - Input: `2009-03-15` -> Output: `GrupoEdad.Cadetes`
    - Input: `1990-12-31` -> Output: `GrupoEdad.Adultos`
  - `guardarFirmaConsentimiento`: Validar concatenación del prefijo de base64 si no está presente. Simular fallo de Firebase Storage (`Storage lleno`).

#### 2. `components/FormularioEstudiante.tsx`
- **Refactor:**
  - Quitar el cálculo manual de grupo por edad del usuario.
  - Implementar un `watch('fechaNacimiento')` usando `react-hook-form`. Calcular de manera automática la edad técnica y ejecutar `setValue('grupo', nuevoGrupo)`.
  - Limpiar el renderizado del selector de sedes: `{sede.nombre}${sede.ciudad ? ` (${sede.ciudad})` : ''}` para evitar la visualización de paréntesis vacíos `()`.
- **Casos de Test en `components/FormularioEstudiante.test.tsx`:**
  - Renderizado inicial con valores por defecto y carga de estudiante existente (modo edición).
  - Simular escritura en el campo de fecha de nacimiento y verificar mediante aserción reactiva que el input de grupo cambia al valor correcto (aplicar triangulación con las 4 edades críticas).
  - Enviar formulario y simular fallo en la llamada a `agregarEstudiante` o `actualizarEstudiante`. Verificar que se renderiza el toast de error correspondiente.

#### 3. `components/FilaEstudiante.tsx` & `TablaEstudiantes.tsx`
- **Casos de Test en `components/FilaEstudiante.test.tsx`:**
  - Renderizado correcto del nombre completo, número de identificación y tag de grado.
  - Simular click en "Editar" y verificar llamada a callback.
  - Simular click en "Eliminar" y verificar apertura del modal de confirmación.

#### 4. `vistas/Estudiantes.tsx`
- **Casos de Test en `vistas/Estudiantes.test.tsx`:**
  - Mockear el `DataContext` para inyectar una lista de 5 estudiantes de prueba.
  - Simular filtrado por texto de búsqueda y validar que la tabla se reduce a los elementos coincidentes.
  - Simular cambio de filtro de sede y validar renderizado correcto.

---

### Vertical B: Pagos y Finanzas

#### 1. `servicios/pagosApi.ts` & `pagosEstudiantesApi.ts`
- **Refactor:**
  - Separar el cálculo de saldos pendientes y el histórico de pagos del componente visual. Crear helpers en `utils/finanzas.ts` si corresponde.
- **Casos de Test Obligatorios:**
  - Triangulación de cálculo de saldo deudor:
    - Caso 1: Estudiante con mensualidad de $100, registra pago de $100 -> Saldo: $0.
    - Caso 2: Estudiante con mensualidad de $100, registra pago de $40 -> Saldo: $60 (Deudor).
    - Caso 3: Estudiante con mensualidad de $100, registra pago de $120 -> Saldo: -$20 (Saldo a favor).
  - Validar excepción cuando el ID del pago no coincide con ningún estudiante.

#### 2. `components/ModalRegistrarPago.tsx`
- **Refactor:**
  - Validar campos de entrada (monto debe ser estrictamente positivo y mayor a cero).
- **Casos de Test:**
  - Simular selección de método de pago "Wompi" y verificar que se despliega el flujo correspondiente.
  - Ingresar monto de `$0` o negativo y validar que el botón de envío permanece inhabilitado y se muestra un error de validación visual.

---

### Vertical C: Eventos y Asistencia

#### 1. `servicios/asistenciaApi.ts`
- **Casos de Test Obligatorios:**
  - Registrar asistencia para un estudiante activo.
  - Excepción: Registrar asistencia para un ID inexistente debe fallar controladamente.
  - Registrar asistencia para un estudiante con estado de pago "Deudor" debe retornar advertencia visual pero permitir el registro según las políticas de Tudojang.

#### 2. `components/EscanerAsistencia.tsx`
- **Refactor:**
  - Extraer la dependencia directa de la cámara a un adapter/wrapper inyectable.
- **Casos de Test:**
  - Simular respuesta del scanner con un JSON de QR corrupto y verificar que el componente captura la excepción y muestra un error legible ("Código QR inválido").

---

### Vertical D: Configuración y Multi-Tenant (Seguridad)

#### 1. `vistas/Configuracion.tsx` & `servicios/configuracionApi.ts`
- **Refactor:**
  - Validar que todas las consultas a Firebase tengan la cláusula de seguridad `where('tenantId', '==', tenantId)`.
- **Casos de Test:**
  - Validar que ante la ausencia de `tenantId` en la sesión activa, todas las llamadas a la API lancen inmediatamente un error de tipo `"Sesión inválida o Tenant no especificado."` sin interactuar con Firestore.

---

## 3. Comandos de Verificación para Cursor/Codex

El agente debe ejecutar localmente el siguiente comando en la consola de comandos de Windows (cmd) para confirmar la efectividad del coverage al 100% en el módulo bajo desarrollo:

```powershell
node_modules\.bin\jest.cmd --coverage --collectCoverageFrom=components/FormularioEstudiante.tsx
```

No se considerará finalizada una vertical hasta que la tabla de cobertura de Jest muestre **100%** en todas las columnas para los archivos modificados.
