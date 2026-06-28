# Registro 5.3 — vista EjecucionPrograma

- [x] 5.3 Crear vista `EjecucionProgramaView` que muestra el estado del ciclo de un grupo en un programa: posicion actual, objetivos completados, jornadas realizadas/base de avance. Test verifica ritmos independientes entre dos grupos.

## Archivos

- `vistas/admin/EjecucionProgramaView.tsx`
- `vistas/admin/EjecucionProgramaView.test.tsx`

## Evidencia RED

- `npm run test:app -- vistas/admin/EjecucionProgramaView.test.tsx` fallo inicialmente porque `EjecucionProgramaView` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- vistas/admin/EjecucionProgramaView.test.tsx` con 2/2 tests pasando.
- `npm run build` exitoso.

## Alcance

Vista funcional minima basada en `programaService`:

- Renderiza programa activo.
- Muestra unidad actual.
- Muestra objetivo actual.
- Muestra objetivos completados.
- Demuestra ritmos independientes entre grupo infantil y grupo cadetes.

La vinculacion real con jornadas cerradas queda pendiente para 7.3 y 7.4.
