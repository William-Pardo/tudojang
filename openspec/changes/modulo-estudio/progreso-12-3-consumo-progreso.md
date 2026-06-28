# Registro 12.3 — flujo E2E de consumo y progreso

- [x] 12.3 Escribir test E2E del flujo de consumo y progreso: estudiante abre PDF -> visualiza paginas -> sincronizacion se dispara -> progreso guardado correctamente.

## Archivos

- `components/academico/MaterialPreviewModal.tsx`
- `components/academico/MaterialPreviewModal.test.tsx`
- `cypress/e2e/modulo-estudio-consumo-progreso.cy.ts`

## Evidencia RED

- `npm run test:app -- components/academico/MaterialPreviewModal.test.tsx` fallo porque el modal de material no evaluativo todavia mostraba placeholder y no montaba `PdfViewer`.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- components/academico/MaterialPreviewModal.test.tsx` con 4/4 tests pasando.
- `npx cypress run --spec cypress/e2e/modulo-estudio-consumo-progreso.cy.ts` con 1/1 test pasando.
- `npm run build`.

## Alcance

El flujo valida que el estudiante abra un material PDF, marque paginas vistas, guarde progreso en `localStorage` y emita payload de sincronizacion observable.
La persistencia real en Firestore queda delegada al adaptador/backend ya creado para `consolidateProgress`.
