## Why

El módulo de estudiantes de Tudojang tiene una cobertura de pruebas muy baja (23.5% en la API de servicios y 0% en la mayoría de sus componentes y vistas). Esto representa una alta deuda técnica que pone en riesgo la estabilidad del core de la aplicación ante futuras modificaciones. Además, existen dos defectos técnicos en el formulario de estudiantes: el cálculo automático del grupo técnico por fecha de nacimiento está desconectado en el formulario, y el selector de sedes muestra paréntesis vacíos `()` si la sede no tiene una ciudad configurada.

## What Changes

- **Normalización del Grupo Técnico:** Implementar un observador (`watch`) sobre la fecha de nacimiento en el formulario de estudiante para calcular y autocompletar el `grupo` técnico automáticamente (Infantil, Precadetes, Cadetes, Adultos) según la edad del alumno.
- **Formateo del Selector de Sedes:** Corregir el renderizado del selector de sedes en el formulario de estudiantes para ocultar los paréntesis vacíos `()` cuando la sede no tiene una ciudad asignada.
- **Suite de Pruebas Unitarias de Servicios:** Crear y configurar `servicios/estudiantesApi.test.ts` con cobertura al 100% de todas sus funciones y captura de excepciones.
- **Suite de Pruebas Unitarias y de Integración de Componentes:** Incrementar la cobertura de `FormularioEstudiante.tsx` al 100% y crear pruebas con cobertura completa para `FilaEstudiante.tsx`, `TablaEstudiantes.tsx`, `FiltrosEstudiantes.tsx` y `vistas/Estudiantes.tsx`.
- **Pruebas de Triangulación y Excepciones:** Aplicar pruebas de triangulación en cálculos de edad y simular fallos de base de datos (red/seguridad) para comprobar el manejo robusto de excepciones.

## Capabilities

### New Capabilities
- `cobertura-pruebas-estudiantes`: Cobertura del 100% en pruebas unitarias, de integración, de triangulación y excepciones para todo el código relacionado con estudiantes.
- `autocalculo-grupo-estudiante`: Normalización y cálculo automático del grupo de edad en base a la fecha de nacimiento ingresada en el formulario de estudiantes.

### Modified Capabilities

## Impact

- `servicios/estudiantesApi.ts`
- `components/FormularioEstudiante.tsx`
- `components/FilaEstudiante.tsx`
- `components/TablaEstudiantes.tsx`
- `components/FiltrosEstudiantes.tsx`
- `vistas/Estudiantes.tsx`
- `components/FormularioEstudiante.test.tsx`
