## Context

El módulo de estudiantes de Tudojang tiene una cobertura de pruebas muy baja y dos defectos en el formulario:
1. La fecha de nacimiento no dispara el cálculo automático del grupo técnico, dejando la selección manual sujeta a errores humanos de digitación.
2. El selector de sedes muestra paréntesis vacíos `()` si la sede no tiene una ciudad configurada.
Para solucionar esto y asegurar la estabilidad de la aplicación a largo plazo, implementaremos pruebas automatizadas unitarias, de integración y de excepciones, buscando el 100% de cobertura y aplicando pruebas de triangulación donde sea útil (como en el cálculo de la edad y asignación de grupo).

## Goals / Non-Goals

**Goals:**
- Implementar reactividad en el formulario de estudiante para sincronizar `fechaNacimiento` con `grupo` automáticamente.
- Corregir el formateo visual de la sede en el selector.
- Crear pruebas unitarias para `servicios/estudiantesApi.ts` logrando cobertura del 100%.
- Crear pruebas unitarias y de integración para `components/FormularioEstudiante.tsx`, `components/FilaEstudiante.tsx`, `components/TablaEstudiantes.tsx`, `components/FiltrosEstudiantes.tsx` y `vistas/Estudiantes.tsx` alcanzando el 100% de cobertura.
- Probar flujos de excepción (errores de red, fallos de base de datos) y aplicar triangulación de datos en el cálculo de grupos por edad.

**Non-Goals:**
- Modificar el flujo de negocio del estudiante (inscripciones, cobros) más allá de la normalización del grupo por edad.
- Agregar nuevas vistas o rediseñar la interfaz gráfica fuera de los controles corregidos.

## Decisions

### 1. Vincular React-Hook-Form con un Observador para fechaNacimiento
- **Opción A (Elegida):** Observar `fechaNacimiento` usando `watch('fechaNacimiento')` y actualizar el formulario en un `useEffect`. Si el grupo calculado difiere del actual, ejecutar `setValue('grupo', nuevoGrupo, { shouldValidate: true })`. Esto garantiza consistencia y normaliza el campo en el estado del formulario.
- **Opción B:** Hacer el cálculo únicamente en el evento `onChange` del input. Es descartado porque no maneja valores cargados inicialmente para editar o drafts restaurados del autosave.

### 2. Mockear Firestore Completo en `servicios/estudiantesApi.test.ts`
- Utilizar mocks de Jest (`jest.mock('firebase/firestore')`) para simular las llamadas a `collection`, `query`, `getDocs`, `addDoc`, `updateDoc` y `deleteDoc`.
- Probar tanto respuestas exitosas (Happy Paths) como fallos controlados arrojando excepciones (`mockRejectedValueOnce`) para comprobar que los servicios capturan y formatean los errores correctamente.

### 3. Triangulación de Entrada para cálculo de Grupo de Edad
- Probar con múltiples fechas de nacimiento correspondientes a diferentes rangos de edad (menor a 3, entre 3 y 6, entre 7 y 12, mayor o igual a 13) para validar que la lógica de clasificación de grupos (`calcularEdadYGrupo`) se comporte correctamente y mitigue falsos positivos.

### 4. Limpieza del Nombre de Sede
- Usar un string format simple en el selector: `{s.nombre}{s.ciudad ? ` (${s.ciudad})` : ''}` para evitar paréntesis vacíos.

## Risks / Trade-offs

- **[Riesgo]** El autocalculo de grupo podría impedir que un administrador asigne a un estudiante un grupo diferente por criterio técnico propio.
  - *Mitigación:* La asignación de grupo por edad se mantiene rígida para evitar errores, pero si se requiere flexibilidad, en el futuro se podría agregar un override manual. Por ahora, nos ceñimos a la especificación original de normalización.
- **[Riesgo]** Los tests de componentes visuales muy acoplados a Firebase pueden ser difíciles de configurar.
  - *Mitigación:* Utilizar mocks limpios del `DataContext` y `NotificacionContext` como hicimos en las correcciones anteriores.
