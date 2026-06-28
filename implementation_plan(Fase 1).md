# Plan de Refactorización y Cobertura: Módulo Estudiantes (Fase 1)

Este plan aborda la refactorización y la cobertura del módulo de **Estudiantes** de Tudojang al 100%, eliminando la deuda técnica y asegurando la estabilidad mediante TDD, pruebas unitarias, de integración, de excepciones y triangulación de datos.

## User Review Required

> [!IMPORTANT]
> **Reactividad y Cálculo Automático de Grupo:**
> Vincularemos `fechaNacimiento` con `grupo` automáticamente en el formulario usando un observador (`watch`). Esto evitará discrepancias de negocio.
>
> **Formateo del Selector de Sedes:**
> Se eliminarán los paréntesis vacíos `()` para sedes sin ciudad.

---

## Fases y Componentes a Intervenir

### Fase 1: Servicios y APIs (Completada preliminarmente)
- [x] Cobertura del 100% en `servicios/estudiantesApi.ts` con tests unitarios, de integración, mockeando Firestore/Storage, pruebas de excepciones y triangulación de grupos.

### Fase 2: Componentes Unitarios y Auxiliares
- [ ] `components/FilaEstudiante.tsx`
- [ ] `components/FiltrosEstudiantes.tsx`
- [ ] `components/TablaEstudiantes.tsx`

### Fase 3: Formulario Estudiante (Core del Flujo)
- [ ] Refactor y reactividad en `components/FormularioEstudiante.tsx`
- [ ] Cobertura 100% en `components/FormularioEstudiante.test.tsx` (Triangulación de edades, validaciones de campos y manejo de errores de envío).

### Fase 4: Vista de Integración Principal
- [ ] Cobertura 100% en `vistas/Estudiantes.tsx` (Flujos completos, carga, búsqueda, eliminación y modales).

---

## Proposed Changes

### [Módulo Estudiantes]

#### [MODIFY] [FormularioEstudiante.tsx](file:///e:/Apps/Tudojang/components/FormularioEstudiante.tsx)
- Agregar hook reactivo para calcular grupo de edad en base a la fecha de nacimiento ingresada.
- Corregir renderizado de sedes para evitar `()` vacíos.

#### [NEW] [FilaEstudiante.test.tsx](file:///e:/Apps/Tudojang/components/FilaEstudiante.test.tsx)
- Suite unitaria para renderizado, botones de acción, tags de grado y estados de pago. Cobertura: 100%.

#### [NEW] [FiltrosEstudiantes.test.tsx](file:///e:/Apps/Tudojang/components/FiltrosEstudiantes.test.tsx)
- Suite unitaria para inputs de búsqueda, selectores de grupo, grado y sede. Cobertura: 100%.

#### [NEW] [TablaEstudiantes.test.tsx](file:///e:/Apps/Tudojang/components/TablaEstudiantes.test.tsx)
- Suite para renderizado de filas, estados vacíos y paginación si aplica. Cobertura: 100%.

#### [NEW] [Estudiantes.test.tsx](file:///e:/Apps/Tudojang/vistas/Estudiantes.test.tsx)
- Suite de integración completa: carga de datos desde context, filtros interactivos, apertura de formularios y eliminación de estudiantes. Cobertura: 100%.

---

## Verification Plan

### Automated Tests
- Ejecutar suite completa con cobertura:
  ```powershell
  node_modules\.bin\jest.cmd --coverage --collectCoverageFrom=components/FormularioEstudiante.tsx --collectCoverageFrom=components/FilaEstudiante.tsx --collectCoverageFrom=components/FiltrosEstudiantes.tsx --collectCoverageFrom=components/TablaEstudiantes.tsx --collectCoverageFrom=vistas/Estudiantes.tsx
  ```
