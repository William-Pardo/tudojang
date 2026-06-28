# Registro 7.4 — vista Jornadas

- [x] 7.4 Crear vista `JornadasView` para maestro: agenda, confirmacion, inicio, registro de asistencia/objetivos y cierre. Test de flujo completo de cierre.

## Archivos

- `vistas/admin/JornadasView.tsx`
- `vistas/admin/JornadasView.test.tsx`

## Evidencia RED

- `npm run test:app -- vistas/admin/JornadasView.test.tsx` fallo inicialmente porque `JornadasView` no existia.

## Evidencia GREEN / TRIANGULATE

- `npm run test:app -- vistas/admin/JornadasView.test.tsx` con 3/3 tests pasando.
- `npm run build` exitoso.

## Casos cubiertos

- Render de agenda de jornada para maestro.
- Confirmar jornada.
- Iniciar jornada.
- Registrar asistencia.
- Registrar objetivo impartido.
- Cerrar jornada y avanzar programa.
- Mostrar error al cerrar sin asistencia.

## Alcance

Vista funcional minima conectada a `jornadaService` y `closeJornada`.
La persistencia real y agenda multi-jornada quedan para integración posterior.
