# Delta for Academico Biblioteca

## MODIFIED Requirements

### Requirement: Título visible curado por recurso

`RecursoAcademico` MUST soportar `tituloVisible` opcional, persistido al clasificar; todo flujo que titule una asignación publicada (individual o en lote) MUST priorizar `tituloVisible` sobre `nombre` cuando ambos existen.
(Previously: la publicación en lote usaba `recurso.nombre` directo, sin considerar `tituloVisible`.)

#### Scenario: El título visible se persiste al clasificar

- GIVEN un título visible ingresado en el modal
- WHEN el usuario guarda la clasificación
- THEN `tituloVisible` MUST persistirse vía `bibliotecaService.updateFicha`

#### Scenario: Publicación en lote respeta tituloVisible

- GIVEN un recurso aprobado con `tituloVisible` distinto de `nombre`
- WHEN se publica en lote sin título personalizado explícito
- THEN la asignación creada MUST usar `tituloVisible`, no `nombre`
- AND un recurso sin `tituloVisible` MUST usar `nombre` como respaldo, sin backfill

### Requirement: Selección de aprobados unificada en Centro de recursos

El grid de `aprobado` MUST vivir en `BibliotecaView.tsx`, expuesto a `AsignacionesView.tsx` vía callback; este MUST NOT mantener grid propio. Con múltiples grupos de publicación, la selección recibida MUST enrutarse al "grupo activo" (por defecto, el último agregado).
(Previously: la selección llegaba a un único set plano, sin noción de grupo destino.)

#### Scenario: La selección llega al grupo activo

- GIVEN 2 grupos existentes, el segundo agregado más recientemente
- WHEN el usuario confirma una selección de aprobados desde `BibliotecaView`
- THEN esos recursos MUST agregarse al segundo grupo (activo), no al primero
- AND `AsignacionesView.tsx` MUST recibirlos vía callback, sin mantener grid propio
