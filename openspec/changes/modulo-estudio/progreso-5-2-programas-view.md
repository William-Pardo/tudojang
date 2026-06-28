# Registro 5.2 — vista Programas

- [x] 5.2 Crear vista `ProgramasView` para crear, publicar y asignar programas a grupos.

## Archivos

- `vistas/admin/ProgramasView.tsx`
- `vistas/admin/ProgramasView.test.tsx`

## Evidencia RED

- `npm run test:app -- vistas/admin/ProgramasView.test.tsx` fallo inicialmente porque `ProgramasView` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- vistas/admin/ProgramasView.test.tsx` con 2/2 tests pasando.
- `npm run build` exitoso.

## Alcance

Vista funcional minima conectada al servicio puro `programaService`.
Permite crear un programa con unidad/objetivos base, publicarlo y asignarlo al grupo infantil.

No se conecto aun a navegacion global ni persistencia Firestore para evitar mezclar alcance con los modulos pendientes de Jornadas/Asignaciones.
