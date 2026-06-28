# Progreso UX - Jornadas dentro de Centro de Estudios

## Resultado

Se reubicó la experiencia de jornadas para que deje de aparecer como módulo independiente en el menú principal y pase a vivir dentro de Centro de Estudios para roles maestro/admin.

## Cambios aplicados

- Se quitó el enlace visible `Jornadas` de la barra lateral.
- Se mantuvo la ruta interna `#/jornadas` para compatibilidad y pruebas existentes.
- `CentroEstudios` ahora renderiza la sección `Plan y cierre de clase` solo para roles `Admin` y `Editor`.
- `JornadasView` ahora soporta modo `embedded` para usarse dentro de Centro de Estudios sin duplicar encabezados.
- Se actualizó el contrato de pruebas para validar la nueva experiencia UX.

## Racional UX

Centro de Estudios queda como eje académico por rol:

- Estudiante: materiales, tareas, progreso y notificaciones.
- Tutor: seguimiento y alertas.
- Maestro/Admin: biblioteca, asignaciones, planificación, cierre y trazabilidad.

La clase presencial no depende del módulo para ejecutarse; el módulo solo registra trazabilidad antes/después de la clase y permite consultar cumplimiento de asignaciones.

## Evidencia

```powershell
npm run test:app -- --silent vistas/CentroEstudios.test.tsx vistas/admin/JornadasView.test.tsx
```

Resultado: 2 suites / 12 tests passing.

```powershell
npm run test:app -- --silent servicios/academico vistas/admin/BibliotecaView.test.tsx vistas/admin/AportarRecursoView.test.tsx vistas/admin/JornadasView.test.tsx vistas/CentroEstudios.test.tsx components/academico hooks/academico utils/progreso vistas/tutor/TutorDashboardView.test.tsx
```

Resultado: 23 suites / 134 tests passing.

```powershell
npm run build
```

Resultado: build passing con advertencias no bloqueantes de Vite ya conocidas.
