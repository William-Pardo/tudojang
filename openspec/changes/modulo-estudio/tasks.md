## 1. Infraestructura base y feature flag

- [x] 1.1 Agregar `features.centroEstudios: boolean` al modelo `Tenant` en `src/models/tenant.ts` y actualizar el Context provider para exponerlo. Incluir test unitario del hook de acceso al flag.
- [x] 1.2 Definir los tipos TypeScript base del módulo académico: `RolAcademico`, `EstadoJornada`, `EstadoProgreso`, `TipoRecurso`, `UsoAcademico`, `MomentoAsignacion` en `src/models/academico/index.ts`.
- [x] 1.3 Escribir Firestore Security Rules para las nuevas colecciones académicas (`programas`, `jornadas`, `recursos`, `asignaciones`, `progreso`, `invitaciones`, `vinculos`) con aislamiento por `tenantId` y verificación de rol via custom claim. Incluir tests de reglas con Firebase Emulator.
- [x] 1.4 Crear colecciones Firestore con índices compuestos necesarios (definir en `firestore.indexes.json`): `asignaciones` por `tenantId + estado + fechaCierre`, `progreso` por `tenantId + estudianteId`, `jornadas` por `tenantId + sedeId + fechaHora`.

## 2. Roles académicos e invitaciones

- [x] 2.1 Crear Cloud Function `inviteUser`: genera Firebase Auth action link, envía email al invitado y registra la invitación en `tenants/{tenantId}/invitaciones/{id}` con estado `pendiente` y TTL. Escribir test de integración con `firebase-functions-test`.
- [x] 2.2 Crear Cloud Function `acceptInvitation`: valida que el link sea válido y no esté vencido, crea el usuario en Firebase Auth con custom claims (`role`, `tenantId`), marca la invitación como `aceptada`. Test de función con invitación vencida.
- [x] 2.3 Crear servicio `invitacionService.ts` en `src/services/academico/` con métodos: `createInvitation`, `listInvitations`, `resendInvitation`. Test unitario con mocks de Firebase.
- [x] 2.4 Crear colección de vínculos tutor-estudiante en `tenants/{tenantId}/vinculos/`. Crear servicio `vinculoService.ts` con `linkTutorEstudiante`, `unlinkTutorEstudiante`, `getEstudiantesByTutor`. Incluir test de aislamiento por `tenantId`.
- [x] 2.5 Crear vistas de administración de invitaciones y vínculos en `src/views/admin/InvitacionesView.tsx` y `VinculosView.tsx`. Incluir test de renderizado con Testing Library.

## 3. Google Drive — Conexión OAuth

- [x] 3.1 Crear la interfaz abstracta `StorageProvider` en `services/storage/StorageProvider.ts` con métodos: `listFiles`, `getFileMetadata`, `getTemporaryUrl`. Documentar el contrato para futuros proveedores.
- [x] 3.2 Crear Cloud Function `connectDrive`: genera URL OAuth de Google Drive con scopes `drive.readonly` y `offline_access`, devuelve la URL al frontend. Test con mock del SDK de Google.
- [x] 3.3 Crear Cloud Function `driveOAuthCallback`: recibe el `code` de Google, intercambia por tokens, cifra el `refresh_token` con Cloud KMS y guarda en `tenants/{tenantId}/driveConnections/{connId}`. Test del flujo completo con mocks.
- [x] 3.4 Crear Cloud Function `refreshDriveToken`: lee el `refresh_token` cifrado, lo descifra con KMS, obtiene nuevo `access_token` y actualiza el documento. Test de renovación y manejo de error por token revocado.
- [x] 3.5 Crear Cloud Function `getTemporaryFileUrl`: valida rol del solicitante, existencia de asignación activa y `tenantId`; genera signed URL temporal (15 min) para el archivo en Drive. Tests: acceso válido, asignación vencida (403), archivo eliminado (alerta).
- [x] 3.6 Crear servicio `driveService.ts` en `services/storage/` que orqueste el flujo OAuth desde el frontend (iniciar conexión, seleccionar carpeta raíz). Test unitario con mocks de Cloud Functions.

## 4. Biblioteca académica

- [x] 4.1 Definir modelo `RecursoAcademico` y `FichaAcademica` en `src/models/academico/recurso.ts`. Crear `bibliotecaService.ts` con métodos: `importFromDrive`, `updateFicha`, `approveRecurso`, `archiveRecurso`. Test unitario de transiciones de estado.
- [x] 4.2 Crear Cloud Function `syncDriveMetadata`: detecta archivos renombrados, movidos o eliminados en la carpeta institucional y actualiza los documentos de `RecursoAcademico` en Firestore; emite alerta si un archivo fue eliminado. Test con mocks del webhook de Drive.
- [x] 4.3 Crear vista `BibliotecaView.tsx` en `src/views/admin/` con explorador de Drive, importación, clasificación de recursos y aprobación de aportes del maestro. Test de renderizado y acciones de estado.
- [x] 4.4 Agregar vista de aporte de recurso para el maestro (`AportarRecursoView.tsx`) que permite proponer un archivo de Drive para revisión. Test que verifica que el recurso queda en estado `pendiente`.

## 5. Programas académicos

- [x] 5.1 Definir modelo `ProgramaAcademico`, `EjecucionPrograma`, `UnidadTematica` y `ObjetivoFormativo` en `src/models/academico/programa.ts`. Crear `programaService.ts` con: `createPrograma`, `publishPrograma`, `assignProgramaToGrupo`, `advanceCiclo`. Test de avance de ciclo y cancelación que no avanza.
- [x] 5.2 Crear vista `ProgramasView.tsx` en `src/views/admin/` para crear, editar, versionar y asignar programas a grupos. Test de renderizado y flujo de publicación.
- [x] 5.3 Crear vista `EjecucionProgramaView.tsx` que muestra el estado del ciclo de un grupo en un programa (posición actual, objetivos completados, jornadas realizadas). Test que verifica ritmos independientes entre dos grupos.

## 6. Espacios físicos por sede

- [x] 6.1 Definir modelo `EspacioFisico` en `src/models/academico/espacio.ts`. Crear `espacioService.ts` con: `createEspacio`, `updateEspacio`, `getDisponibilidad`. Test de disponibilidad con espacios superpuestos.
- [x] 6.2 Crear vista `EspaciosView.tsx` en `src/views/admin/` para gestionar espacios por sede, ver disponibilidad en calendario y detectar conflictos visualmente. Test de renderizado.

## 7. Jornadas de instrucción

- [x] 7.1 Definir modelo `JornadaInstruccion` y `BloqueRecurrente` en `src/models/academico/jornada.ts`. Crear `jornadaService.ts` con métodos de lectura y transición de estado local. Test del modelo de ciclo de vida.
- [x] 7.2 Crear Cloud Function `confirmJornada`: valida disponibilidad de maestro, espacio, grupo (sin cruces), autorización de sede, capacidad y compatibilidad disciplina-objetivo. Rechaza con error descriptivo por cada tipo de conflicto. Tests: cada validación individual + combinadas.
- [x] 7.3 Crear Cloud Function `closeJornada`: valida que asistencia y objetivos estén registrados, cierra la jornada, llama a `advanceCiclo` del programa con los objetivos impartidos. Soporta cierre parcial. Tests: cierre completo, parcial y sin asistencia (error).
- [x] 7.4 Crear vista `JornadasView.tsx` para el maestro: agenda, jornadas asignadas, confirmación/rechazo, registro de asistencia y cierre. Test de flujo completo de cierre.
- [x] 7.5 Implementar generación de `JornadaInstruccion` desde `BloqueRecurrente` por rango de fechas. Crear función `generateJornadasFromBloque` en `jornadaService.ts`. Test de generación y verificación de coexistencia con `BloqueHorario` actuales.

## 8. Asignaciones académicas

- [x] 8.1 Definir modelo `AsignacionAcademica` y `DestinatarioAsignacion` en `src/models/academico/asignacion.ts`. Crear `asignacionService.ts` con: `publishAsignacion`, `getAsignacionesByEstudiante`, `validateAsignacion`. Test de filtrado por grado y de rechazo de recurso no aprobado.
- [x] 8.2 Crear Cloud Function `publishAsignacion`: valida que el recurso esté `aprobado`, que el maestro sea el asignado a la jornada y que `tenantId` corresponda. Crea la asignación. Test con recurso pendiente (error) y maestro no autorizado (error).
- [x] 8.3 Crear vista `AsignacionesView.tsx` para el maestro: selección de recurso aprobado, destinatarios, fechas, momento pedagógico y criterio de finalización. Test de publicación con grupos y con grados.
- [x] 8.4 Implementar lógica de bloqueo automático por fecha de apertura/cierre y transición a `vencido`. Puede ejecutarse en un Cloud Function schedulable diario. Test de transición de estados por fecha.

## 9. Motor de progreso

- [x] 9.1 Implementar funciones puras de cálculo de progreso para cada tipo de recurso en `src/utils/progreso/`: `calcularPdfProgress(paginasVistas, permanencia, totalPaginas)`, `calcularVideoProgress(segundosUnicos, totalSegundos)`, `calcularQuizProgress(respuestas, umbral)`. Tests unitarios exhaustivos sin dependencias de Firebase.
- [x] 9.2 Crear hook `useProgressSync(asignacionId, tipo)` en `src/hooks/academico/` que: acumula progreso en `localStorage`/`IndexedDB`, sincroniza cada 30s, en pausa/visibilidad oculta y en unmount. Test de que no escribe en cada evento individual y que escribe en cierre.
- [x] 9.3 Crear Cloud Function `consolidateProgress`: recibe el batch de progreso del cliente, valida `tenantId`, asignación activa y estudiante; persiste en `progreso/{uid}/{asignacionId}`; evalúa si se cumple el criterio de finalización y actualiza el estado. Test de consolidación con criterios PDF y video.
- [x] 9.4 Crear visor PDF integrado en `src/components/academico/PdfViewer.tsx` con rastreo de páginas únicas, permanencia y tramo final. Conectar con `useProgressSync`. Test de que el seeking no cuenta páginas no visualizadas.
- [x] 9.5 Crear componente de video `VideoPlayer.tsx` en `src/components/academico/` con rastreo de segundos únicos (sin contar seeking). Conectar con `useProgressSync`. Test del contador de segundos únicos.

## 10. Centro de Estudios del estudiante

- [x] 10.0 Corte UX grabable: crear ruta real `#/centro-estudios`, entrada en menú lateral y vista piloto `vistas/CentroEstudios.tsx` con asignaciones demo, métricas visuales, estados y aviso de feature flag apagado. Incluye tests dirigidos en `vistas/CentroEstudios.test.tsx` y `servicios/academico/asignacionService.test.ts`.
- [x] 10.1 Crear vista `CentroEstudiosView.tsx` en `src/views/estudiante/` con lista de asignaciones vigentes ordenadas por urgencia, indicador de estado y acceso a recursos. Test de renderizado con asignaciones en distintos estados.
- [x] 10.2 Crear componente `ProgresoResumenCard.tsx` con métricas del estudiante: completadas, en progreso, vencidas y próximas a vencer. Test de cálculo de métricas.
- [x] 10.3a Implementar base funcional de `QuizView.tsx`: preguntas, selección de respuestas, cálculo de puntuación local y resultado aprobado/refuerzo. Test de quiz aprobado.
- [x] 10.3 Implementar vista de presentación de quizzes `QuizView.tsx` con: preguntas, respuestas, cálculo de puntuación, control de intentos y transición de estado post-quiz. Test de agotamiento de intentos y de quiz aprobado.
- [x] 10.4a Implementar reanudación local de progreso de quiz con `localStorage`, clave por tenant/asignación y test de restauración tras cierre.
- [x] 10.4b Aplicar progreso local restaurado al listado del Centro de Estudios para que tarjetas y métricas reflejen el avance al cerrar/reabrir el material.
- [x] 10.4c Crear `centroEstudiosRepository` como adaptador entre la vista y la fuente actual de asignaciones, preparando migración futura a Firestore/Cloud Functions sin reescribir la UX.
- [x] 10.4d Ajustar el header del Centro de Estudios al patrón visual compacto de los demás módulos internos, sin modificar otros módulos. Test de renderizado actualizado.
- [x] 10.4 Implementar reanudación de progreso: al abrir un recurso, cargar el progreso guardado en Firestore y posicionar el visor en la última posición. Test de reanudación tras cierre.

## 11. Panel del tutor

- [x] 11.1 Crear vista `TutorDashboardView.tsx` en `src/views/tutor/` con selector de estudiante vinculado, progreso detallado y alertas de vencimiento. Test de acceso de solo lectura (no pueden activarse controles de consumo).
- [x] 11.2 Implementar Security Rules que rechacen cualquier escritura de progreso por un usuario con rol `tutor`. Test de reglas con Emulator: escritura de progreso por tutor = `PERMISSION_DENIED`.

## 12. Tests E2E (Cypress)

- [x] 12.1 Escribir test E2E del flujo de invitación: admin invita estudiante → estudiante activa cuenta → estudiante ve su Centro de Estudios vacío.
- [x] 12.2 Escribir test E2E del flujo de publicación: admin aprueba recurso → maestro publica asignación → estudiante ve asignación disponible.
- [x] 12.3 Escribir test E2E del flujo de consumo y progreso: estudiante abre PDF → visualiza páginas → sincronización se dispara → progreso guardado correctamente.
- [x] 12.4 Escribir test E2E del flujo de cierre de jornada: maestro registra asistencia + objetivos → cierra jornada → programa avanza posición → asignaciones de refuerzo publicadas.

## 13. Cobertura y calidad

- [x] 13.1 Ejecutar suite de tests Jest y verificar cobertura de servicios académicos nuevos: `npx jest --coverage --collectCoverageFrom="src/services/academico/**/*.ts"`. Asegurar ≥ 70 % de statements.
- [x] 13.2 Ejecutar build de producción de Vite para verificar que strict TypeScript no genere errores: `npm run build`. Corregir cualquier error de tipo antes de marcar el módulo como listo.
- [x] 13.3 Verificar que todos los tests existentes de `client-item`, `evento-landing-publica` y `evento-lead-capture` continúan pasando sin modificaciones.
