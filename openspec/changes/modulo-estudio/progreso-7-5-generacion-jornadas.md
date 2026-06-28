# Progreso 7.5 - Generacion de jornadas desde bloque recurrente

Fecha: 2026-06-27

## Alcance cerrado

- Se implemento `generateJornadasFromBloque` en `servicios/academico/jornadaService.ts`.
- La funcion genera `JornadaInstruccion` por cada fecha del rango que coincide con `BloqueRecurrente.diaSemana`.
- Si el bloque recurrente esta inactivo, no genera jornadas.
- Las jornadas generadas quedan en estado `borrador`, reutilizando `createJornada`.
- Se agrego `bloqueRecurrenteId` opcional a `JornadaInstruccion` para mantener trazabilidad sin interferir con los `BloqueHorario` legacy existentes en `tipos.ts`.

## Evidencia TDD

### RED

- Se agregaron pruebas que esperaban `generateJornadasFromBloque`.
- La primera ejecucion fallo porque la funcion aun no existia:
  - `generateJornadasFromBloque is not a function`

### GREEN

Comando:

```powershell
npm run test:app -- servicios/academico/jornadaService.test.ts
```

Resultado:

```text
PASS servicios/academico/jornadaService.test.ts
Tests: 8 passed, 8 total
```

### Verificacion de build

Comando:

```powershell
npm run build
```

Resultado:

```text
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes ya existentes de Vite sobre `use client`, imports dinamicos y tamano de chunk.
- No se modifico el flujo legacy de `BloqueHorario`; la nueva generacion queda aislada por `BloqueRecurrente`.
