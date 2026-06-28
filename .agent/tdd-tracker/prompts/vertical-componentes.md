## Prompt – Vertical Componentes (sin tests)

**Objetivo**: Refactorizar los componentes del proyecto (ej. `components/Iconos.tsx`) siguiendo la guía de `manual_refactor_tdd.md` y prepararlos para pruebas.

---
### Pasos a ejecutar (copiar a Codex / Cursor)
1. **Abrir archivo** `components/Iconos.tsx` (y otros componentes listados en la vertical).
2. Aplicar refactor clean‑architecture:
   - Extraer lógica compleja a hooks (`useIcono`) o funciones auxiliares.
   - Cambiar nombres de exportación a **PascalCase** y usar `export default` solo donde corresponda.
   - Añadir **prop‑types** o interfaces de TypeScript y usar `React.memo` donde aplique.
3. Añadir comentario de cobertura al final del archivo con el marcador `/* COVERAGE: COMPONENTES */`.
4. Guardar cambios.
5. Ejecutar cobertura del componente (ejemplo):
   ```bash
   npx jest components/Iconos.test.tsx --coverage --coverageReporters=text --collectCoverageFrom="components/Iconos.tsx"
   ```
6. Copiar el **porcentaje** obtenido y registrar en el informe de coverage:
   ```bash
   echo "| Componentes | <COVERAGE>% | $(date -Iseconds) | $(git rev-parse HEAD) |" >> coverage/verticals/coverage_report.md
   ```
7. Commitear los cambios:
   ```bash
   git add components/Iconos.tsx coverage/verticals/coverage_report.md
   git commit -m "refactor(componente): mejorar Iconos – coverage <COVERAGE>%"
   ```
---
### Mocking (según INSTRUCCIONES_CODEX_CURSOR.md)
```typescript
jest.mock('../context/DataContext', () => ({
  useSedes: () => ({ sedes: [], sedesVisibles: [] }),
  useConfiguracion: () => ({ configClub: { diasSuspension: 15 } }),
  useProgramas: () => ({ programas: [] }),
}));
```
---
### Salida esperada
- Archivo refactorizado sin errores de lint.
- Cobertura ≥ 80 %.
- Registro actualizado en `coverage/verticals/coverage_report.md`.
