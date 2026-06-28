# Progreso 9.1 - Calculos puros de progreso academico

Fecha: 2026-06-27

## Alcance cerrado

- Se verifico y completo `utils/progreso/calculos.ts`.
- `calcularPdfProgress` calcula progreso por paginas unicas, permanencia minima y llegada al tramo final.
- `calcularVideoProgress` ahora acepta conteo numerico o arreglo de segundos, ignorando duplicados y valores fuera de rango.
- `calcularQuizProgress` ahora acepta conteo numerico o arreglo de respuestas evaluadas `{ correcta: boolean }`.
- Las funciones son puras y no dependen de Firebase, DOM ni almacenamiento local.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- utils/progreso/calculos.test.ts` fallo al agregar contratos con arreglo de segundos y arreglo de respuestas. |
| GREEN | El mismo comando paso con 11/11 tests. |
| REFACTOR | Se mantuvo compatibilidad con el contrato previo y se agregaron tipos explicitos para respuestas de quiz. |

## Verificacion

```powershell
npm run test:app -- utils/progreso/calculos.test.ts
npm run build
```

Resultado:

```text
PASS utils/progreso/calculos.test.ts
Tests: 11 passed, 11 total
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
