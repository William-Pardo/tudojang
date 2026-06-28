## Prompt – Vertical Servicio `usuariosApi.ts`

**Objetivo**: Refactorizar `servicios/usuariosApi.ts`, crear sus tests unitarios y registrar coverage.

---
### Pasos a ejecutar (copiar a Codex / Cursor)
1. Abrir `servicios/usuariosApi.ts`.
2. Aplicar refactor clean‑architecture siguiendo `manual_refactor_tdd.md`.
3. Crear archivo de tests `servicios/usuariosApi.test.ts` con los mocks indicados en `INSTRUCCIONES_CODEX_CURSOR.md`.
4. Ejecutar coverage:
   ```bash
   npx jest servicios/usuariosApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/usuariosApi.ts"
   ```
5. Copiar el porcentaje obtenido (ej. `84%`) y actualizar el registro de coverage:
   ```bash
   echo "| Servicios | 84% | $(date -Iseconds) | $(git rev-parse HEAD) |" >> coverage/verticals/coverage_report.md
   ```
6. Commitear los cambios:
   ```bash
   git add servicios/usuariosApi.ts servicios/usuariosApi.test.ts coverage/verticals/coverage_report.md
   git commit -m "refactor(servicio): mejorar usuariosApi – coverage 84%"
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
### Resultado esperado
- Archivo refactorizado sin errores de lint.
- Tests pasando.
- Coverage ≥ 80 %.
- Tabla `coverage_report.md` actualizada.
