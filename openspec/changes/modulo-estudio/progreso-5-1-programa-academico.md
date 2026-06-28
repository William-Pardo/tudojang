# Registro 5.1 — programa academico base

- [x] 5.1 Definir modelo `ProgramaAcademico`, `EjecucionPrograma`, `UnidadTematica` y `ObjetivoFormativo`; crear `programaService` con `createPrograma`, `publishPrograma`, `assignProgramaToGrupo`, `advanceCiclo`.

## Archivos

- `models/academico/programa.ts`
- `servicios/academico/programaService.ts`
- `servicios/academico/programaService.test.ts`

## Evidencia RED

- `npm run test:app -- servicios/academico/programaService.test.ts` fallo inicialmente porque `programaService` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- servicios/academico/programaService.test.ts` con 6/6 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Creacion de programa en borrador con unidades ordenadas.
- Publicacion solo con unidades y objetivos.
- Asignacion de programa publicado a grupo/sede.
- Avance de ciclo por objetivos impartidos.
- No avance de ejecucion cancelada.
- Cierre de ejecucion al completar el ultimo objetivo.
