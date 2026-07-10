# Contrato limitado de implementacion: UX Programa Academico y Publicar Material en Centro Estudios

## 0. Naturaleza del documento

Este documento es un contrato limitado de desarrollo. Su objetivo es impedir reinterpretaciones durante la implementacion.

Toda IA, desarrollador o agente que ejecute este contrato debe cumplir estas reglas:

- No puede ampliar el alcance sin autorizacion explicita del usuario.
- No puede cambiar modulos no autorizados salvo que sea estrictamente necesario para compilar, probar o persistir lo definido aqui.
- Si necesita tocar un archivo no previsto, debe documentar el motivo antes de ejecutar el cambio.
- Cada tarea completada debe marcarse como `[x]`.
- Cada tarea debe seguir ciclo TDD: Red, Green, Refactor.
- Al cerrar cada bloque funcional debe registrarse el avance en Engram.

### 0.1 Regla obligatoria de modelo IA por tarea

Antes de iniciar cualquier tarea del plan ejecutable, la IA o desarrollador debe:

1. Leer el `Modelo requerido` declarado en la tarea.
2. Confirmar en el chat el modelo o nivel que usara.
3. Si no tiene exactamente ese modelo disponible, debe escoger un equivalente propio y declararlo antes de iniciar.
4. No puede ejecutar la tarea si no declaro el modelo o equivalente.
5. Si durante la tarea aparece riesgo arquitectonico, permisos Firestore, integracion Agenda/Clase en Vivo o bloqueo no previsto, debe elevar el nivel a `alto` o `extremadamente alto` antes de continuar.

Tabla de equivalencias para Codex:

| Nivel requerido | Uso esperado |
|---|---|
| `medio` | Lectura, documentacion, estilos menores, verificacion, checklist, Engram. |
| `alto` | UX funcional, estado React, persistencia Firestore, validaciones, TDD, integracion entre Programa/Cohorte/Jornada/Asignacion. |
| `extremadamente alto` | Bloqueos complejos entre Firestore, reglas, permisos, Agenda, Clase en Vivo o regresiones criticas. |

Formato obligatorio antes de ejecutar una tarea:

```text
Tarea: <codigo y nombre>
Modelo requerido: <medio|alto|extremadamente alto>
Modelo/equivalente que usare: <modelo disponible>
Motivo: <una frase>
```

## 1. Alcance autorizado

Este contrato se limita exclusivamente a la UX y funcionalidad de Centro Estudios para:

1. Paso `4. Programa academico`.
2. Ultimo paso `Publicar material`.

Archivo principal autorizado:

- `vistas/admin/AsignacionesView.tsx`

Archivos adicionales permitidos solo si son estrictamente necesarios:

- Servicios academicos relacionados con programa, cohorte, jornada o asignacion.
- Modelos academicos relacionados con programa, cohorte, jornada o asignacion.
- Tests asociados a `AsignacionesView`, jornada, programa, cohorte y asignaciones.
- Reglas Firestore solo si la persistencia definida aqui no puede funcionar sin ajuste. No se autorizan cambios amplios de seguridad.

## 2. Fuera de alcance

Queda prohibido modificar, rediseniar o refactorizar:

- Conexion Google Drive.
- Google Picker.
- Login.
- Auth.
- Sidebar global.
- Disenio global de la app.
- Estudiantes, tesoreria, licencias, tienda, certificaciones u otros modulos.
- Clase en Vivo como UX independiente.
- Agenda como UX independiente.

Excepcion permitida:

- Agenda y Clase en Vivo pueden consumir las jornadas generadas desde Centro Estudios.
- Si requieren un ajuste minimo para leer correctamente esas jornadas, se permite el cambio y debe quedar documentado.

## 3. Objetivo funcional

Redisenar y cerrar funcionalmente el flujo:

`Programa academico -> Cohorte operativa -> Jornadas de agenda -> Publicacion de material por jornada`

El maestro debe poder:

1. Crear o editar un programa academico.
2. Definir su cohorte operativa.
3. Generar jornadas futuras en Agenda.
4. Navegar clase por clase.
5. Asignar materiales aprobados a jornadas especificas.
6. Evitar duplicados.
7. Editar o eliminar asignaciones publicadas.

## 4. Definiciones obligatorias

### 4.1 Programa academico

Representa el plan academico general.

Debe contener:

- Nombre.
- Tema.
- Instructor sugerido.
- Sede sugerida.
- Grupo objetivo.
- Fecha inicio.
- Fecha fin.
- Tags.

La descripcion puede existir, pero no es obligatoria.

### 4.2 Cohorte operativa

Representa la ejecucion real de un programa para:

- Un grupo especifico.
- Una sede.
- Un maestro.
- Dias de clase.
- Horario.
- Rango de fechas.

Ejemplo:

`Infantil iniciacion Jul/Sep 2026 - Sede B - Alonzo - lunes y miercoles 4:00 PM`

### 4.3 Jornada / clase

Representa cada clase individual generada desde la cohorte.

Debe tener:

- Fecha.
- Hora inicio.
- Hora fin.
- Sede.
- Grupo.
- Instructor.
- Estado.

### 4.4 Asignacion de material

Representa la publicacion de un recurso aprobado contra una jornada especifica.

Un recurso puede reutilizarse en multiples jornadas.

## 5. Reglas funcionales obligatorias

### 5.1 Generacion de jornadas

Al confirmar programa/cohorte:

- El sistema debe calcular las jornadas dentro del rango `fechaInicio` / `fechaFin`.
- Debe usar dias de clase y horario definidos en la cohorte.
- Debe generar jornadas en Agenda.

### 5.2 Regeneracion por edicion

Si se edita una cohorte ya generada:

- Solo se pueden regenerar jornadas futuras en estado:
  - `borrador`
  - `programada`
  - `confirmada`
- No se pueden modificar jornadas:
  - con asistencia registrada;
  - iniciadas;
  - cerradas;
  - canceladas;
  - con registros operativos no migrables.
- La UX debe pedir confirmacion antes de regenerar.
- Tecnicamente se permite mover asignaciones por indice de clase solo si es seguro.
- Si no es seguro, se debe conservar la jornada anterior y reportar la situacion al usuario.

### 5.3 Publicacion de material

El material debe publicarse contra una jornada especifica, no contra el programa completo.

Debe bloquearse la publicacion si:

- No existe jornada activa seleccionada.
- No existe recurso aprobado seleccionado.
- Faltan campos obligatorios.

### 5.4 Prevencion de duplicados

Debe bloquearse duplicado si coinciden:

- `jornadaId`
- `recursoId`
- `criterio`
- `asignacion`
- `gradosIds`

### 5.5 Auditoria

Debe registrarse auditoria basica para:

- Programa creado.
- Programa editado.
- Cohorte creada.
- Cohorte editada.
- Jornadas generadas.
- Jornadas regeneradas.
- Material publicado.
- Material editado.
- Material eliminado.

## 6. UX obligatoria: Paso 4 Programa academico

El paso debe llamarse exactamente:

`Programa academico`

El modal debe tener cierre visible con boton `X`.

Si existen cambios no guardados y el usuario intenta cerrar, debe pedir confirmacion.

### 6.1 Bloques verticales del modal

El modal debe organizarse en estos bloques:

1. Datos del programa.
2. Tags academicos.
3. Cohorte operativa.
4. Jornadas calculadas.

### 6.2 Campos obligatorios

Los siguientes campos son obligatorios:

- Nombre del programa.
- Tema.
- Instructor.
- Sede.
- Grupo.
- Fecha inicio.
- Fecha fin.
- Tags.

### 6.3 Cohorte operativa obligatoria

Debe incluir:

- Dias de clase.
- Hora inicio.
- Hora fin.
- Instructor.
- Sede.
- Grupo.

### 6.4 Vista previa de jornadas

Antes de confirmar, el modal debe mostrar:

- Cantidad de jornadas calculadas.
- Primera fecha.
- Ultima fecha.
- Dias seleccionados.
- Horario.

Ejemplo:

`Se generaran 24 clases entre 2026-07-01 y 2026-09-30.`

### 6.5 Confirmacion

Al aceptar, debe aparecer confirmacion con este sentido:

`Se generaran X jornadas futuras en Agenda. Las jornadas futuras existentes podran actualizarse segun esta cohorte. Confirmar?`

No debe decir que solo se guarda un programa si tambien se generan jornadas.

## 7. UX obligatoria: Publicar material

Publicar material debe operar clase por clase.

### 7.1 Navegacion por jornadas

Debe existir navegacion con bullets numerados.

Cada bullet representa una jornada/clase generada desde la cohorte.

Colores obligatorios:

- Gris: clase sin material.
- Azul: clase con material asignado.
- Rojo/alerta: clase vencida o con error.
- Verde: clase publicada correctamente.

Debe existir navegacion:

- Clase anterior.
- Clase siguiente.
- Indicador `Clase X de N`.

### 7.2 Informacion visible de la clase activa

Cada clase activa debe mostrar:

- Fecha.
- Hora.
- Sede.
- Instructor.
- Grupo.
- Tema del dia.
- Materiales disponibles.
- Materiales asignados.

### 7.3 Campos editables por jornada

Debe permitirse editar:

- Tema del dia.
- Grado o grados mediante multi-select.
- Asignacion.
- Criterio de asignacion.

### 7.4 Materiales disponibles

Debe mostrar recursos aprobados que hacen match con:

- Tags del programa.
- Tags de la clase.
- Tags del recurso.

Debe permitir seleccionar uno o varios recursos.

### 7.5 Acciones obligatorias

Debe existir:

- `Publicar material`.
- `Asignar otro`.
- `Editar`.
- `Eliminar`.

`Publicar material` debe aplicar a la jornada activa.

### 7.6 Listado final de asignaciones

Debe existir listado final con:

- Icono del material.
- Titulo visible.
- Jornada / clase.
- Fecha de publicacion.
- Fecha de vencimiento si aplica.
- Destinatario.
- Grados.
- Estado.
- Editar.
- Eliminar.

## 8. Persistencia Firestore obligatoria

### 8.1 Programa academico

Ruta:

`tenants/{tenantId}/programasAcademicos/{programaId}`

Campos minimos:

- `id`
- `tenantId`
- `nombre`
- `tema`
- `descripcion?`
- `instructorId`
- `instructorNombre`
- `sedeId`
- `sedeNombre`
- `grupoObjetivo`
- `fechaInicio`
- `fechaFin`
- `tags`
- `estado`
- `creadoPorUid`
- `creadoEn`
- `actualizadoEn`

### 8.2 Cohorte academica

Ruta:

`tenants/{tenantId}/cohortesAcademicas/{cohorteId}`

Campos minimos:

- `id`
- `tenantId`
- `programaId`
- `nombre`
- `sedeId`
- `sedeNombre`
- `instructorId`
- `instructorNombre`
- `grupoObjetivo`
- `diasSemana`
- `horaInicio`
- `horaFin`
- `fechaInicio`
- `fechaFin`
- `estado`
- `jornadasGeneradas`
- `creadoPorUid`
- `creadoEn`
- `actualizadoEn`

### 8.3 Jornadas

Ruta:

`tenants/{tenantId}/jornadas/{jornadaId}`

Campos minimos:

- `id`
- `tenantId`
- `programaId`
- `cohorteId`
- `sedeId`
- `sedeNombre`
- `instructorId`
- `instructorNombre`
- `grupoObjetivo`
- `fecha`
- `horaInicio`
- `horaFin`
- `estado`
- `temaDia?`
- `origen: centro_estudios`
- `asistenciaRegistrada: false`
- `creadoPorUid`
- `creadoEn`
- `actualizadoEn`

### 8.4 Asignaciones academicas

Ruta:

`tenants/{tenantId}/asignacionesAcademicas/{asignacionId}`

Campos minimos:

- `id`
- `tenantId`
- `programaId`
- `cohorteId`
- `jornadaId`
- `recursoId`
- `driveFileId`
- `tituloVisible`
- `gradosIds`
- `asignacion`
- `criterio`
- `fechaPublicacion`
- `fechaVencimiento?`
- `estado`
- `creadoPorUid`
- `creadoEn`
- `actualizadoEn`

## 9. TDD obligatorio

Cada tarea debe seguir:

1. Red: escribir o ajustar test que falle.
2. Green: implementar minimo para pasar.
3. Refactor: limpiar sin cambiar comportamiento.

No se considera completa una tarea sin prueba o justificacion tecnica documentada.

## 10. Tests minimos obligatorios

- [ ] Render del paso `Programa academico`.
- [ ] Validacion de campos obligatorios.
- [ ] Calculo de jornadas por rango y dias.
- [ ] Generacion de jornadas futuras.
- [ ] Regeneracion solo de jornadas futuras permitidas.
- [ ] Bloqueo de modificacion de jornadas con asistencia.
- [x] Navegacion por bullets clase por clase.
- [x] Publicacion de material por jornada.
- [x] Bloqueo de duplicados.
- [x] Edicion de asignacion.
- [x] Eliminacion de asignacion.
- [ ] Persistencia de programa en Firestore.
- [ ] Persistencia de cohorte en Firestore.
- [ ] Persistencia de jornadas en Firestore.
- [ ] Persistencia de asignaciones en Firestore.
- [ ] Auditoria basica.
- [x] Build final.

Comandos minimos esperados:

```powershell
npm run test:app -- --runTestsByPath vistas/admin/AsignacionesView.test.tsx
npm run build
```

Si se modifican servicios academicos, ejecutar ademas los tests especificos del servicio modificado.

## 11. Plan de tareas ejecutable

### Bloque A: Preparacion contractual

- [x] A1. Confirmar que el contrato fue leido antes de implementar. Modelo requerido: `medio`.
- [x] A2. Confirmar modelo de IA equivalente antes de iniciar si lo ejecuta otra IA. Modelo requerido: `medio`.
- [x] A3. Identificar archivos que seran modificados. Modelo requerido: `medio`.
- [x] A4. Registrar inicio en Engram. Modelo requerido: `medio`.

### Bloque B: Programa academico

- [x] B1. Crear tests del render del paso `Programa academico`. Modelo requerido: `alto`.
- [x] B2. Rediseniar modal con cierre visible. Modelo requerido: `alto`.
- [x] B3. Implementar validacion de campos obligatorios. Modelo requerido: `alto`.
- [x] B4. Implementar confirmacion de cierre con cambios no guardados. Modelo requerido: `alto`.
- [x] B5. Implementar bloque de tags academicos. Modelo requerido: `alto`.
- [x] B6. Implementar bloque de cohorte operativa. Modelo requerido: `alto`.
- [x] B7. Implementar vista previa de jornadas calculadas. Modelo requerido: `alto`.
- [x] B8. Implementar confirmacion antes de generar jornadas. Modelo requerido: `alto`.

### Bloque C: Persistencia programa/cohorte/jornadas

- [x] C1. Crear o ajustar modelos de programa academico. Modelo requerido: `alto`.
- [x] C2. Crear o ajustar modelos de cohorte academica. Modelo requerido: `alto`.
- [x] C3. Crear o ajustar generacion de jornadas. Modelo requerido: `alto`.
- [x] C4. Persistir programa en `programasAcademicos`. Modelo requerido: `alto`.
- [x] C5. Persistir cohorte en `cohortesAcademicas`. Modelo requerido: `alto`.
- [x] C6. Persistir jornadas en `jornadas`. Modelo requerido: `alto`.
- [x] C7. Regenerar solo jornadas futuras permitidas. Modelo requerido: `alto`.
- [x] C8. Proteger jornadas con asistencia o estados no modificables. Modelo requerido: `alto`.
- [x] C9. Registrar auditoria. Modelo requerido: `medio`.

### Bloque D: Publicar material

- [x] D1. Crear tests de navegacion clase por clase. Modelo requerido: `alto`.
- [x] D2. Implementar bullets por jornada. Modelo requerido: `alto`.
- [x] D3. Implementar colores por estado. Modelo requerido: `medio`.
- [x] D4. Mostrar informacion de clase activa. Modelo requerido: `alto`.
- [x] D5. Permitir editar tema del dia. Modelo requerido: `alto`.
- [x] D6. Implementar multi-select de grados. Modelo requerido: `alto`.
- [x] D7. Filtrar materiales por match de tags. Modelo requerido: `alto`. Resuelto en change `asignacion-material-por-clase` (sección "Publicación en lote", filtro por tag sobre `recursosDisponibles`).
- [x] D8. Permitir asignar uno o varios materiales a la jornada activa. Modelo requerido: `alto`. Resuelto en change `asignacion-material-por-clase` (multi-select recurso×jornada + `publicarLote()` + callable batch `publishAsignacionesBatch`).
- [x] D9. Publicar material contra `jornadaId`. Modelo requerido: `alto`.
- [x] D10. Bloquear duplicados. Modelo requerido: `alto`.
- [x] D11. Implementar editar asignacion. Modelo requerido: `alto`.
- [x] D12. Implementar eliminar asignacion. Modelo requerido: `alto`.
- [x] D13. Mostrar listado final de asignaciones. Modelo requerido: `medio`.
- [ ] D14. Registrar auditoria. Modelo requerido: `medio`.

### Bloque E: Verificacion final

- [x] E1. Ejecutar tests unitarios y de integracion aplicables. Modelo requerido: `medio`.
- [x] E2. Ejecutar build. Modelo requerido: `medio`.
- [ ] E3. Validar manualmente en `http://localhost:5173/#/centro-estudios`. Modelo requerido: `medio`.
- [ ] E4. Confirmar que Drive no fue modificado. Modelo requerido: `medio`.
- [ ] E5. Confirmar que Agenda solo consume jornadas generadas. Modelo requerido: `alto`.
- [ ] E6. Confirmar que Clase en Vivo solo consume jornadas generadas. Modelo requerido: `alto`.
- [ ] E7. Registrar cierre en Engram. Modelo requerido: `medio`.

## 11.1 Estado de ejecucion al 2026-07-03

Verificacion ejecutada:

- `npm run test:app -- --runTestsByPath vistas/admin/AsignacionesView.test.tsx servicios/cohortesApi.test.ts servicios/jornadasApi.test.ts servicios/academico/programaAcademicoRepository.test.ts --silent` => 4 suites, 26 tests passing.
- `npm run build` => build exitoso.

Pendientes antes de considerar el contrato cerrado:

- D7 y D8: resueltos el 2026-07-04 vía change `asignacion-material-por-clase` (ver `openspec/changes/asignacion-material-por-clase/`).
- D14: registrar auditoria para material publicado/editado/eliminado.
- E3: validar manualmente en `http://localhost:5173/#/centro-estudios`.
- E4: confirmar con diff limpio de la tarea que no se modifico Drive. El working tree contiene cambios previos fuera del contrato, por lo que esta verificacion debe hacerse por alcance de commit o branch.
- E5/E6: confirmar consumo de jornadas generadas por Agenda y Clase en Vivo.
- E7: registrar cierre final en Engram cuando todos los pendientes anteriores esten completos.

## 12. Criterio de terminado

El contrato se considera cumplido solo si:

- Todos los items requeridos estan marcados como `[x]`.
- Los tests minimos pasan.
- El build pasa.
- El flujo puede ejecutarse en localhost.
- El usuario puede crear programa/cohorte, generar jornadas, navegar clases y publicar material por jornada.
- No se modificaron modulos fuera de alcance sin justificacion documentada.
- Engram contiene registro del avance y cierre.

## 13. Prohibicion de reinterpretacion

Si una instruccion no esta en este contrato, no se implementa.

Si una implementacion requiere decidir entre varias opciones no definidas, se debe detener la ejecucion y pedir confirmacion al usuario.
