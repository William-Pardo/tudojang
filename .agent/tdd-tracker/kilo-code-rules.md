# Reglas de Contexto para Kilo Code

## Instrucción Principal

Cuando recibas un prompt de testing de `.agent/tdd-tracker/prompts/`, seguí estas reglas SIN EXCEPCIÓN:

### 1. TDD Estricto
- **PRIMERO** escribí el test
- **DESPUÉS** verificá que falla (Red)
- **DESPUÉS** implementá/corregí el código (Green)
- **DESPUÉS** refactorizá si es necesario (Refactor)

### 2. Ejecución Obligatoria
Después de escribir cada test, EJECUTÁ el comando de coverage:
```bash
npx jest <archivo.test.ts> --coverage --coverageReporters=text --collectCoverageFrom="<archivo-source>"
```
**Pegá el output COMPLETO de coverage en el chat.** Esto es OBLIGATORIO.

### 3. Criterio de Éxito
- Coverage de Statements ≥ 95% (ideal 100%)
- Coverage de Branches ≥ 90% (ideal 100%)
- Coverage de Functions = 100%
- TODOS los tests pasan (0 failures)

### 4. Manejo de Errores
- Si un test falla, mostrá el error completo y corregilo antes de continuar
- Si hay un error de configuración de Jest, documentalo en el chat

### 5. Convención de Commits
Después de cada archivo completado:
```
test(módulo): add unit tests for <NombreArchivo>

Coverage: Stmts X% | Branch Y% | Funcs Z% | Lines W%
```

### 6. Actualización de Estado
Después de completar exitosamente, actualizá `.agent/tdd-tracker/tdd-state.md`:
- Cambiá `⬜` a `✅` para el item completado
- Anotá la cobertura obtenida en la columna correspondiente

### 7. Si Algo No Está Claro
NUNCA asumas. Preguntá al usuario antes de continuar.

## Proyecto: Tudojang

- **Stack**: React + TypeScript + Firebase/Firestore
- **Tests**: Jest 29 + ts-jest + @testing-library/react
- **Estilos**: CSS modules (mockeados con identity-obj-proxy)
- **State**: Context API (DataContext, NotificacionContext)
- **Patrones**: Container-Presentational, mock completo de Firebase
