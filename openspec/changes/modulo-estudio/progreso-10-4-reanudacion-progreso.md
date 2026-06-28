# Progreso 10.4 - Reanudacion de progreso al abrir recurso

Fecha: 2026-06-27

## Alcance cerrado

- Se conecto `MaterialPreviewModal` con `progresoRepository.leerSync`.
- Al abrir un material no evaluativo, el modal pasa `cargarProgreso` a `PdfViewer`.
- `PdfViewer` ya delega esa carga a `useProgressSync`, que prioriza progreso remoto/local cargado sobre el estado inicial.
- Se agrego test que verifica que el progreso guardado se carga al abrir el recurso.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- components/academico/MaterialPreviewModal.test.tsx` fallo porque el modal no pasaba `cargarProgreso` al visor. |
| GREEN | El mismo comando paso con 5/5 tests. |
| REFACTOR | Se mantuvo la responsabilidad de reanudacion en el repositorio/hook; el modal solo conecta la fuente de datos. |

## Verificacion

```powershell
npm run test:app -- components/academico/MaterialPreviewModal.test.tsx
npm run build
```

Resultado:

```text
PASS components/academico/MaterialPreviewModal.test.tsx
Tests: 5 passed, 5 total
✓ built
```

Notas:

- La implementacion queda lista para usar `FirestoreProgressRepository` cuando el contexto de autenticacion entregue el `estudianteId`.
- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
