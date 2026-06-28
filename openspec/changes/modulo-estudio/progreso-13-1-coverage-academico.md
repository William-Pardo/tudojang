# Registro 13.1 — cobertura servicios academicos

- [x] 13.1 Ejecutar suite de tests Jest y verificar cobertura de servicios academicos nuevos.

## Comando

```powershell
npx jest --coverage --collectCoverageFrom="servicios/academico/**/*.ts" servicios/academico --runInBand
```

## Resultado

- Test suites: 6 passed / 6 total.
- Tests: 43 passed / 43 total.
- Statements: 93.06%.
- Branches: 73.03%.
- Functions: 94.82%.
- Lines: 94.46%.

## Veredicto

Cumple el umbral definido de >= 70% statements para servicios academicos nuevos.
