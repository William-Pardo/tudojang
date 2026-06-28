# Progreso 8.3 - Vista AsignacionesView

Fecha: 2026-06-27

## Alcance cerrado

- Se creo `vistas/admin/AsignacionesView.tsx`.
- La vista permite al maestro preparar una asignacion academica desde recursos aprobados.
- Incluye seleccion de:
  - recurso aprobado
  - destinatario por grupo, grado o estudiante
  - grupo objetivo
  - grados objetivo cuando corresponde
  - fecha de apertura
  - fecha de cierre
  - momento pedagogico
- Usa `publishAsignacion` del servicio academico para publicar localmente una asignacion valida.
- Se mantiene el estilo visual usado por las vistas admin academicas existentes (`ProgramasView`, `JornadasView`).

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- vistas/admin/AsignacionesView.test.tsx` fallo inicialmente con `Cannot find module './AsignacionesView'`. |
| GREEN | El mismo comando paso con 3/3 tests. |
| REFACTOR | Se ajusto el test para consultar el heading publicado y evitar ambiguedad con el texto duplicado del `<option>`. La vista quedo autocontenida con datos demo aprobados mientras se conecta a Firestore/Cloud Functions en una fase posterior. |

## Verificacion

```powershell
npm run test:app -- vistas/admin/AsignacionesView.test.tsx
npm run build
```

Resultado:

```text
PASS vistas/admin/AsignacionesView.test.tsx
Tests: 3 passed, 3 total
✓ built
```

Notas:

- El primer intento de build agoto timeout local; la repeticion con margen mayor termino correctamente.
- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
