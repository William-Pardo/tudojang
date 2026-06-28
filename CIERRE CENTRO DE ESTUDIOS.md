# Cierre Centro de Estudios

Objetivo: llevar el Modulo de Estudios / Centro de Estudios desde piloto funcional validado hasta produccion controlada, segura y trazable.

## Protocolo obligatorio de ejecucion

Cada tarea debe ejecutarse con TDD real usando ciclo:

1. RED: escribir o ajustar primero la prueba que falla y registrar el fallo esperado.
2. GREEN: implementar el minimo cambio necesario para que la prueba pase.
3. REFACTOR: limpiar estructura, nombres o duplicacion sin cambiar comportamiento.
4. VERIFY: ejecutar pruebas focalizadas y, cuando aplique, build/reglas/E2E.
5. TRACE: registrar el cierre en este mismo archivo antes de pasar a la siguiente tarea.

No se debe marcar una tarea como completa sin:

- prueba o evidencia ejecutada;
- resultado de comando;
- archivos modificados;
- fecha;
- decision tecnica si aplica;
- impacto UX/seguridad si aplica.

## Formato obligatorio de registro por tarea

Al cerrar cada tarea, agregar un bloque bajo la tarea correspondiente:

```md
### Registro de cierre

- Fecha:
- Responsable:
- Ciclo RED:
- Ciclo GREEN:
- Ciclo REFACTOR:
- Comandos ejecutados:
- Resultado:
- Archivos modificados:
- Riesgos o deuda tecnica:
- Estado final: COMPLETA / BLOQUEADA
```

## Estado general

- [ ] 1. Persistencia real Firestore
- [ ] 2. Integracion real Google Drive
- [ ] 3. Roles estudiante y tutor
- [ ] 4. Seguridad Firestore, App Check y claims
- [ ] 5. Jornadas reales persistidas
- [ ] 6. Asignaciones academicas reales
- [ ] 7. Notificaciones
- [ ] 8. Limpieza de UX demo/piloto
- [ ] 9. Pruebas staging y despliegue controlado
- [ ] 10. Documentacion operativa y rollback

---

## 1. Persistencia real Firestore

### 1.1 Reemplazar datos piloto/locales por lecturas reales por tenant

- [x] Identificar todas las vistas/servicios del modulo que usan datos demo, memoria local o mocks en runtime.
- [x] Crear tests que fallen cuando la consulta no filtre por `tenantId`.
- [x] Implementar lectura real en colecciones academicas.
- [x] Validar aislamiento por tenant.

### Registro de cierre

- Fecha: 2026-06-28
- Responsable: Antigravity AI
- Ciclo RED: Se crearon pruebas unitarias en `centroEstudiosRepository.test.ts` simulando las dependencias del SDK de Firestore. Las pruebas verifican que la consulta se realice a la subcolección `/tenants/{tenantId}/asignaciones`, aplicando la restricción `estado == 'publicada'` y filtrando en memoria por destinatarios aptos (grupo, grado, o id de estudiante). Los tests fallaron al validar que no se consultaba el estudiante ni se filtraban las asignaciones por grupo/grado y estado de publicación en la versión piloto.
- Ciclo GREEN: Se implementó la clase `FirestoreCentroEstudiosRepository` en `centroEstudiosRepository.ts`. Ésta lee el perfil del estudiante desde `/estudiantes/{estudianteId}` para obtener su `grupo` y `grado`. A continuación, consulta `/tenants/{tenantId}/asignaciones` filtrando por `estado == 'publicada'` a través del query de Firestore, y evalúa cada asignación en memoria con `aplicaAlEstudiante`. Por último, ordena las asignaciones y les aplica el progreso a través de `prepararAsignacionesCentroEstudios`. La factory `crearCentroEstudiosRepository` fue actualizada para inicializar la clase Firestore en producción si Firebase está configurado.
- Ciclo REFACTOR: Se exportó la lógica `aplicaAlEstudiante` desde `asignacionService.ts` para evitar la duplicación de código en el repositorio (patrón DRY). Se actualizó el mock en `centroEstudiosRepository.test.ts` usando `jest.requireActual` para que la función importada conserve su comportamiento real. Se agregaron tipos estrictos a las dependencias inyectadas de Firestore.
- Comandos ejecutados: `npx jest servicios/academico/centroEstudiosRepository.test.ts`
- Resultado: Todos los tests pasaron exitosamente (4 de 4 unitarios ejecutados).
- Archivos modificados: `servicios/academico/centroEstudiosRepository.ts`, `servicios/academico/centroEstudiosRepository.test.ts`, `servicios/academico/asignacionService.ts`, `CIERRE CENTRO DE ESTUDIOS.md`.
- Riesgos o deuda técnica: El filtrado de destinatarios se realiza en memoria tras obtener todas las asignaciones publicadas del tenant, lo cual es necesario dada la estructura anidada y la flexibilidad de destinatarios (grados, grupos, estudiantes individuales). Si el número de asignaciones del tenant crece masivamente en producción, podría aumentar el consumo de red y CPU del cliente.
- Estado final: COMPLETA


### 1.2 Escritura real de progreso academico

- [ ] Crear test RED para progreso guardado por `tenantId + estudianteId + asignacionId`.
- [ ] Persistir avance de PDF/video/quiz en Firestore.
- [ ] Mantener buffer local solo como respaldo offline/temporal.
- [ ] Validar restauracion al reabrir material.

### 1.3 Indices Firestore

- [ ] Confirmar indices requeridos para asignaciones, progreso, jornadas, recursos e invitaciones.
- [ ] Agregar o ajustar `firestore.indexes.json`.
- [ ] Ejecutar prueba o verificacion de consultas esperadas.

---

## 2. Integracion real Google Drive

### 2.1 OAuth Drive por tenant

- [ ] Crear test o contrato de servicio para inicio de OAuth.
- [ ] Implementar conexion segura de Drive por tenant.
- [ ] Guardar tokens solo en backend/secret storage.
- [ ] Validar reconexion y revocacion.

### 2.2 Biblioteca real desde Drive

- [ ] Crear test RED para listar archivos reales autorizados.
- [ ] Mapear archivos Drive a recursos academicos.
- [ ] Clasificar recurso por uso: estudio, refuerzo, evaluacion, consulta.
- [ ] Evitar exponer links permanentes al estudiante.

### 2.3 Acceso temporal seguro a recursos

- [ ] Crear test RED para URL temporal expirada/no autorizada.
- [ ] Implementar endpoint/function de acceso temporal.
- [ ] Validar rol, tenant y asignacion antes de entregar acceso.

---

## 3. Roles estudiante y tutor

### 3.1 Login real estudiante

- [ ] Crear test RED de estudiante autenticado que solo ve Centro de Estudios y notificaciones.
- [ ] Implementar rutas/menu por rol estudiante.
- [ ] Validar que no acceda a administracion, estudiantes, tesoreria ni configuracion.

### 3.2 Login real tutor/acudiente

- [ ] Crear test RED de tutor autenticado que solo ve supervision y notificaciones.
- [ ] Implementar rutas/menu por rol tutor.
- [ ] Validar lectura de estudiantes vinculados.
- [ ] Bloquear acciones de completar actividades en nombre del estudiante.

### 3.3 Invitaciones y activacion de cuenta

- [ ] Crear E2E RED para invitacion estudiante/tutor.
- [ ] Implementar flujo real de activacion.
- [ ] Validar expiracion, reenvio y token usado.

---

## 4. Seguridad Firestore, App Check y claims

### 4.1 Reglas Firestore finales

- [ ] Crear tests de reglas para estudiante, tutor, maestro, admin y tenant cruzado.
- [ ] Validar que cada rol solo lea/escriba lo permitido.
- [ ] Bloquear lecturas directas de recursos de otros tenants.

### 4.2 Custom claims y roles

- [ ] Crear test/fixture de claims por rol.
- [ ] Validar compatibilidad entre `RolUsuario` frontend y claims backend.
- [ ] Documentar proceso de asignacion de rol.

### 4.3 App Check obligatorio en produccion

- [ ] Confirmar App Check activo para Firebase.
- [ ] Validar functions sensibles con App Check.
- [ ] Documentar excepciones para emulador/staging.

---

## 5. Jornadas reales persistidas

### 5.1 Crear jornada real

- [ ] Crear test RED para crear jornada con tenant, programa, grupo, sede, espacio e instructor.
- [ ] Persistir jornada en Firestore.
- [ ] Validar conflictos basicos antes de confirmar.

### 5.2 Confirmar, iniciar y cerrar jornada real

- [ ] Crear test RED de ciclo completo persistido.
- [ ] Confirmar jornada con validacion de disponibilidad.
- [ ] Iniciar jornada.
- [ ] Registrar asistencia y objetivos impartidos.
- [ ] Cerrar jornada.

### 5.3 Avance real de programa

- [ ] Crear test RED donde cierre completo avanza programa.
- [ ] Crear test RED donde cierre parcial solo avanza objetivos impartidos.
- [ ] Persistir ejecucion actualizada.

### 5.4 Trazabilidad de jornada

- [ ] Registrar auditoria: usuario, fecha, accion y cambios.
- [ ] Mostrar historial basico en la UX del maestro/admin.

---

## 6. Asignaciones academicas reales

### 6.1 Publicar asignacion desde recurso aprobado

- [ ] Crear test RED para recurso pendiente rechazado.
- [ ] Crear test RED para recurso aprobado publicado.
- [ ] Persistir asignacion por grupo, grado o estudiante individual.

### 6.2 Visibilidad estudiante

- [ ] Crear test RED donde estudiante solo ve asignaciones vigentes propias.
- [ ] Respetar fecha de apertura.
- [ ] Respetar fecha de cierre.
- [ ] Mostrar bloqueadas/vencidas correctamente.

### 6.3 Supervision tutor

- [ ] Crear test RED donde tutor ve pendientes, progreso y vencimientos.
- [ ] Bloquear acciones de consumo/completado.

---

## 7. Notificaciones

### 7.1 Notificacion de nueva asignacion

- [ ] Crear test RED de notificacion a estudiante.
- [ ] Crear test RED de notificacion a tutor si aplica.
- [ ] Persistir notificacion por usuario/tenant.

### 7.2 Notificacion de vencimiento

- [ ] Crear test RED para asignacion proxima a vencer.
- [ ] Crear scheduler/function diario.
- [ ] Evitar duplicados.

### 7.3 Notificacion de refuerzo posterior

- [ ] Crear test RED al cerrar jornada parcial.
- [ ] Publicar refuerzo.
- [ ] Notificar estudiante/tutor.

---

## 8. Limpieza UX demo/piloto

### 8.1 Eliminar textos demo en produccion

- [ ] Identificar textos `Demo UX`, `piloto`, datos simulados visibles.
- [ ] Crear test que valide que no aparecen en modo produccion.
- [ ] Mantenerlos solo bajo feature flag o entorno local.

### 8.2 Estados vacios reales

- [ ] Crear estados vacios para estudiante, tutor y maestro.
- [ ] Evitar datos falsos en produccion.
- [ ] Mantener datos demo solo en entorno controlado.

### 8.3 Navegacion por rol

- [ ] Validar menu real por rol.
- [ ] Centro de Estudios debe ser eje academico por rol.
- [ ] Jornadas no debe aparecer como modulo independiente visible.

---

## 9. Pruebas staging y despliegue controlado

### 9.1 Suite final local

- [ ] Ejecutar unit tests del modulo.
- [ ] Ejecutar tests de reglas Firestore.
- [ ] Ejecutar Cypress E2E del modulo.
- [ ] Ejecutar build.

### 9.2 Staging Firebase

- [ ] Desplegar a entorno staging.
- [ ] Probar dos tenants.
- [ ] Probar roles admin, maestro/editor, estudiante y tutor.
- [ ] Validar Drive real.
- [ ] Validar App Check/reglas.

### 9.3 Rollout por feature flag

- [ ] Mantener `features.centroEstudios`.
- [ ] Activar primero en tenant interno.
- [ ] Activar en tenant piloto.
- [ ] Documentar criterio de rollback.

---

## 10. Documentacion operativa y rollback

### 10.1 Guia de activacion por tenant

- [ ] Documentar como activar Centro de Estudios.
- [ ] Documentar requisitos previos: Drive, roles, programas, recursos.

### 10.2 Guia de uso por rol

- [ ] Admin/maestro: biblioteca, asignacion, jornada, cierre.
- [ ] Estudiante: consumir recursos, quizzes, progreso.
- [ ] Tutor: supervision, alertas, pendientes.

### 10.3 Guia de rollback

- [ ] Documentar como apagar feature flag.
- [ ] Documentar impacto de datos ya creados.
- [ ] Documentar restauracion de acceso previo.

---

## Criterio de produccion

El modulo solo puede considerarse listo para produccion cuando:

- [ ] Todas las tareas esten completas.
- [ ] Cada tarea tenga registro de cierre en este archivo.
- [ ] Unit tests pasen.
- [ ] Firestore Rules tests pasen.
- [ ] Cypress E2E pase.
- [ ] Build pase.
- [ ] Staging haya sido validado con al menos dos tenants.
- [ ] Feature flag y rollback esten documentados.
