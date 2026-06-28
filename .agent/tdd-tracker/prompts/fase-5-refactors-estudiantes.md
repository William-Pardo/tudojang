# Fase 5 — Refactors (OpenSpec: Estudiantes)

> **Instrucciones**: Cada sección (§) es un prompt independiente. Copia UNA sección completa al chat de Kilo Code.
> **Antes de empezar**: Lee `.agent/tdd-tracker/kilo-code-rules.md` como contexto.
> **Importante**: ¡Esto es TDD estricto! El test va PRIMERO antes de modificar el componente.

---

## §1 — Refactor: Watch de Fecha de Nacimiento en FormularioEstudiante

**Objetivo**: Normalizar el Grupo Técnico basado en la Edad automáticamente.
**Archivo origen**: `components/FormularioEstudiante.tsx`
**Archivo test**: `components/FormularioEstudiante.test.tsx` (modificar)

### Instrucciones

1. Abre `components/FormularioEstudiante.test.tsx`
2. **ESCRIBE EL TEST PRIMERO (Red)**: Añade un test donde uses `userEvent` para escribir una fecha de nacimiento (ej. `2015-05-10`), espera, y verifica que el campo de "Grupo" cambió automáticamente su valor al grupo correspondiente (ej. `Infantil` o `Precadetes` dependiendo de la lógica de edad).
   - Ejecuta Jest. El test DEBE FALLAR. (Muestra el fallo en el chat).
3. **IMPLEMENTA LA LÓGICA (Green)**: 
   - Abre `components/FormularioEstudiante.tsx`
   - Importa o usa la función utilitaria `calcularEdadYGrupo(fechaNacimiento)` (o similar) existente en los tipos o servicios del sistema.
   - Usa `watch('fechaNacimiento')` y un `useEffect`. Cuando cambie la fecha, calcula el grupo y haz `setValue('grupo', nuevoGrupo, { shouldValidate: true })`.
4. **VERIFICA Y REFACTORIZA**: 
   - Vuelve a ejecutar Jest. Ahora debe pasar. 
   - Ejecuta coverage para el archivo.
```bash
npx jest components/FormularioEstudiante.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/FormularioEstudiante.tsx"
```
5. **Pega todo en el chat**:
   - El test fallando.
   - Tu solución implementada.
   - El resultado del coverage con todos los tests pasando.

---

## §2 — Refactor: Selector de Sedes (Quitar Paréntesis Vacíos)

**Objetivo**: El selector de sedes en `FormularioEstudiante` muestra `()` cuando la sede no tiene una ciudad configurada. Hay que ocultar los paréntesis si no hay ciudad.
**Archivo origen**: `components/FormularioEstudiante.tsx`
**Archivo test**: `components/FormularioEstudiante.test.tsx`

### Instrucciones

1. Abre `components/FormularioEstudiante.test.tsx`
2. **ESCRIBE EL TEST PRIMERO**: Añade un mock de datos donde devuelvas al `DataContext` dos sedes: una con ciudad ("Bogotá") y una sin ciudad (`undefined` o `null`).
   - El test debe buscar los strings renderizados en el Select y esperar que aparezca "Sede Central (Bogotá)" y "Sede Norte", y rechazar que aparezca "Sede Norte ()".
   - Corre Jest. DEBE FALLAR.
3. **IMPLEMENTA**:
   - Abre `components/FormularioEstudiante.tsx`.
   - Busca el renderizado del `<select>` o opciones de `sedes`.
   - Modifica el string literal/template string: usa una condición limpia tipo `{sede.nombre}{sede.ciudad ? \` (\${sede.ciudad})\` : ''}`
4. **VERIFICA**:
   - Ejecuta Jest de nuevo. Debe pasar.
5. **Pega todo el proceso en el chat** (Fallo -> Arreglo -> Éxito).
