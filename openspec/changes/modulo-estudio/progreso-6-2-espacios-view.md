# Registro 6.2 — vista Espacios

- [x] 6.2 Crear vista `EspaciosView` para gestionar espacios por sede, ver disponibilidad y detectar conflictos visualmente.

## Archivos

- `vistas/admin/EspaciosView.tsx`
- `vistas/admin/EspaciosView.test.tsx`

## Evidencia RED

- `npm run test:app -- vistas/admin/EspaciosView.test.tsx` fallo inicialmente porque `EspaciosView` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- vistas/admin/EspaciosView.test.tsx` con 3/3 tests pasando.
- `npm run build` exitoso.

## Alcance

Vista funcional minima conectada a `espacioService`:

- Crear espacio con nombre/capacidad.
- Listar espacios por sede.
- Mostrar estado disponible.
- Mostrar conflicto visual por reserva superpuesta.

No se conecto aun a persistencia Firestore ni a agenda real; eso queda para Jornadas.
