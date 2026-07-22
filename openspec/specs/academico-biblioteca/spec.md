# Academico Biblioteca Specification

## Purpose

Especifica la clasificación y aprobación manual de recursos de Drive, el título visible por recurso, la selección unificada de aprobados para lote y el pipeline de 3 pasos.

## Requirements

### Requirement: Clasificación manual de recursos detectados

El sistema MUST exigir clasificación manual vía modal antes de mover un recurso de `borrador` a `pendiente`, y MUST NOT generar una ficha sintética sin intervención humana.

#### Scenario: Clasificar abre el modal en vez de auto-aprobar

- GIVEN un recurso en estado `borrador`
- WHEN el usuario hace click sobre el archivo
- THEN el sistema MUST abrir un modal de clasificación editable
- AND el recurso MUST NOT pasar a `aprobado` por ese click

#### Scenario: Guardar la clasificación deja el recurso en pendiente

- GIVEN el modal abierto para un recurso en `borrador`
- WHEN el usuario completa los campos y confirma
- THEN el recurso MUST quedar `pendiente` vía `bibliotecaService.updateFicha`, sin invocar la aprobación

### Requirement: Aprobación separada de la clasificación

El sistema MUST ofrecer una aprobación distinta, habilitada solo para recursos `pendiente`.

#### Scenario: Aprobar un recurso ya clasificado

- GIVEN un recurso `pendiente` con ficha clasificada
- WHEN el usuario ejecuta la acción de aprobar
- THEN el recurso MUST pasar a `aprobado` vía `bibliotecaService.approveRecurso`, sin repetir `updateFicha`

#### Scenario: Un recurso sin clasificar no puede aprobarse

- GIVEN un recurso `borrador` sin ficha
- WHEN el usuario intenta aprobarlo directamente
- THEN el sistema MUST exigir clasificarlo antes de habilitar la aprobación

### Requirement: Título visible curado por recurso

`RecursoAcademico` MUST soportar `tituloVisible` opcional, persistido al clasificar; todo flujo que titule una asignación publicada (individual o en lote) MUST priorizar `tituloVisible` sobre `nombre` cuando ambos existen.

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

El grid de aprobados MUST seguir viviendo en `BibliotecaView.tsx`, expuesto vía callback. La selección MUST enrutarse al Paso 1 del asistente unificado para la clase activa.

#### Scenario: La selección llega al Paso 1 de la clase activa

- GIVEN el asistente abierto en Paso 1
- WHEN el usuario confirma una selección desde `BibliotecaView`
- THEN esos recursos MUST integrarse a la lista, excluyendo los ya asignados a esa clase

### Requirement: Eliminación de "Reutilizar" y "Aprobado para"

El sistema MUST NOT ofrecer el tab "Reutilizar" en aprobados ni el toggle "Aprobado para" al preparar asignación.

#### Scenario: Reutilizar y "Aprobado para" ya no existen

- GIVEN el usuario en aprobados o en preparar asignación
- WHEN busca el tab "Reutilizar" o el toggle "Aprobado para"
- THEN el sistema MUST mostrar solo el grid de aprobados, y el modal MUST NOT incluir ese toggle

### Requirement: Pipeline de Centro de Estudios en 3 pasos

`CentroEstudios.tsx` MUST mostrar exactamente 3 pasos — "Conectar Drive", "Centro de recursos" (clasificación+aprobación) y "Programa y publicación" (combinado, sin dividirse).

#### Scenario: El stepper muestra 3 pasos

- GIVEN un Admin/Editor en Centro de Estudios
- WHEN carga la vista
- THEN MUST ver exactamente 3 pasos, en orden, sin un cuarto paso separado

#### Scenario: El estado del paso 2 refleja clasificación y aprobación combinadas

- GIVEN recursos en `borrador`, `pendiente` y `aprobado`
- WHEN se calcula el estado del paso "Centro de recursos"
- THEN el indicador MUST reflejar el progreso combinado, no un paso adicional
