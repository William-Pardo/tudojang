# Progreso 9.4 - PdfViewer con tracking de permanencia

Fecha: 2026-06-27

## Alcance cerrado

- Se completo `components/academico/PdfViewer.tsx`.
- El visor esta conectado a `useProgressSync` con `tipo: 'pdf'`.
- Mantiene sincronizacion manual mediante `flush`.
- Permite cargar progreso guardado para reanudacion.
- Agrega flujo de apertura de pagina con permanencia minima antes de registrar la pagina como vista.
- Mantiene boton manual `Marcar pagina como vista` para control explicito en UX/demo.
- Evita que solo navegar/abrir una pagina cuente como visualizacion hasta cumplir la permanencia minima.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- components/academico/PdfViewer.test.tsx` fallo porque no existia el flujo `Abrir pagina` con permanencia. |
| GREEN | El mismo comando paso con 5/5 tests. |
| REFACTOR | Se reemplazo el archivo con texto sin mojibake para estabilizar queries accesibles y evitar fallos por codificacion. |

## Verificacion

```powershell
npm run test:app -- components/academico/PdfViewer.test.tsx
npm run build
```

Resultado:

```text
PASS components/academico/PdfViewer.test.tsx
Tests: 5 passed, 5 total
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
