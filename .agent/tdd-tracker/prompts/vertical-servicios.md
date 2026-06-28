## Prompt – Vertical Servicios (sin tests)

**Objetivo**: Refactorizar `servicios/pagosEstudiantesApi.ts` siguiendo la guía de `manual_refactor_tdd.md` y preparar el archivo para pruebas.

---
### Pasos a ejecutar (copiar a Codex / Cursor)
1. **Abrir archivo** `servicios/pagosEstudiantesApi.ts`.
2. Aplicar refactor clean‑architecture:
   - Extraer lógica de negocio a una función pura `calcularPago(...): number`.
   - Inyectar dependencia de Firestore mediante parámetro `db`.
   - Renombrar funciones a **camelCase** y exportar solo lo necesario.
3. Añadir **comentario de cobertura** al final del archivo con el marcador `/* COVERAGE: SERVICIOS */`.
4. Guardar cambios.
5. Ejecutar cobertura:
   ```bash
   npx jest servicios/pagosEstudiantesApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/pagosEstudiantesApi.ts"
   ```
6. Copiar el **porcentaje** que muestra la salida (ej. `85%`) y **añadir** una línea al registro de coverage:
   ```bash
   echo "| Servicios | 85% | $(date -Iseconds) | $(git rev-parse HEAD) |" >> coverage/verticals/coverage_report.md
   ```
7. Commitear los cambios:
   ```bash
   git add servicios/pagosEstudiantesApi.ts coverage/verticals/coverage_report.md
   git commit -m "refactor(servicio): mejorar pagosEstudiantesApi – coverage 85%"
   ```
---
### Mocking (según INSTRUCCIONES_CODEX_CURSOR.md)
```typescript
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  Timestamp: {},
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
```

---
### Salida esperada
- Archivo refactorizado sin errores de lint.
- Cobertura ≥ 80 %.
- Registro actualizado en `coverage/verticals/coverage_report.md`.
