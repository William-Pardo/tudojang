# Registro 12.2 — flujo E2E de publicacion

- [x] 12.2 Crear E2E pilotable del flujo de publicacion: recurso aprobado/publicado -> estudiante ve asignacion disponible.

## Archivos

- `cypress/e2e/modulo-estudio-publicacion.cy.ts`
- `components/BrandingProvider.tsx`

## Evidencia RED

- `npx cypress run --spec cypress/e2e/modulo-estudio-publicacion.cy.ts` fallo primero porque Vite no estaba activo.
- Luego fallo por guard de onboarding sin tenant E2E.
- Luego fallo por visibilidad del boton dentro del contenedor.

## Evidencia GREEN / TRIANGULATE

- `npx cypress run --spec cypress/e2e/modulo-estudio-publicacion.cy.ts` con 1/1 test pasando.
- `npm run build`.

## Nota de alcance

Este corte cubre la UX verificable con fixtures Cypress sin tocar datos reales.
El flujo estricto `admin aprueba en Biblioteca -> maestro publica en Asignaciones`
sigue dependiendo de completar las vistas 4.3 y 8.3.
