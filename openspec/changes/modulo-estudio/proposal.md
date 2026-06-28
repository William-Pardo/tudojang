## Why

Tudojang gestiona dojangs de Taekwondo como negocio, pero carece de toda la capa académica: los maestros no tienen cómo publicar materiales de estudio, los estudiantes no tienen un espacio propio para consumirlos, y los tutores no pueden hacer seguimiento del progreso de sus pupilos. La academia necesita esta capa para elevar la calidad pedagógica, reducir la carga operativa de los maestros y brindar trazabilidad académica al tenant — capacidades que los competidores directos ya ofrecen.

## What Changes

- **NUEVO** Centro de Estudios del estudiante: espacio personal para consumir materiales, presentar quizzes y consultar progreso.
- **NUEVO** Roles académicos: `Estudiante` y `Tutor` con activación por invitación de correo (Firebase Auth).
- **NUEVO** Biblioteca académica por tenant: repositorio de recursos conectado a Google Drive institucional via OAuth. Tokens cifrados en Cloud Functions; Tudojang solo almacena referencias y metadatos.
- **NUEVO** Programas formativos académicos: disciplina, niveles, objetivos, unidades, temas, prerrequisitos y criterios de evaluación — separados de los programas comerciales existentes.
- **NUEVO** Jornadas de instrucción: instancias reales de clases generadas a partir de bloques recurrentes, con validación de conflictos (maestro, espacio, grupo) y ciclo de vida completo (Borrador → Pendiente → Confirmada → En curso → Cerrada).
- **NUEVO** Espacios físicos por sede: nombre, capacidad y usos permitidos; participan en la validación de jornadas.
- **NUEVO** Asignaciones académicas: el maestro publica recursos aprobados para grupos, grados o estudiantes individuales, con apertura/cierre, criterio de finalización y momento pedagógico.
- **NUEVO** Motor de progreso: seguimiento granular por tipo de recurso (PDF por páginas únicas, video por segundos únicos, quiz por umbral configurable). Sincronización por intervalos, no por evento.
- **NUEVO** Supervisión del tutor: lectura del progreso del estudiante sin capacidad de completar actividades en su nombre.
- **MODIFICADO** `BloqueHorario` existente: se extiende con el concepto de bloque recurrente; los bloques actuales se mantienen temporalmente durante la migración.
- **MODIFICADO** Roles de usuario: se añaden `Estudiante` y `Tutor` al sistema de permisos actual con aislamiento `tenantId` obligatorio.

## Capabilities

### New Capabilities

- `drive-integration`: Conexión OAuth con Google Drive institucional por tenant; importación, clasificación y refresco de metadatos de archivos; interfaz abstracta preparada para OneDrive/Dropbox.
- `biblioteca-academica`: Gestión de recursos académicos: ficha de clasificación (disciplina, nivel, tipo, uso, estado), auditoría de acceso y alertas por archivos eliminados o sin permisos.
- `programas-academicos`: Definición y versionado de programas formativos con unidades, objetivos, prerrequisitos y criterios; ejecución independiente por grupo.
- `jornadas-instruccion`: Ciclo de vida de jornadas (creación, conflictos, confirmación, cierre), registro de asistencia y objetivos impartidos; avance del programa solo al cerrar.
- `espacios-sede`: Administración de espacios físicos por sede con capacidad y usos; participan en la validación de jornadas.
- `asignaciones-academicas`: Publicación de recursos por el maestro a grupos/grados/estudiantes con contexto pedagógico, apertura/cierre y criterio de finalización.
- `roles-academicos`: Roles `Estudiante` y `Tutor` con activación por invitación, vinculación tutor-estudiante (N:M) y aislamiento por `tenantId`.
- `centro-estudios-estudiante`: Vista personal del estudiante: materiales vigentes, consumo de recursos, presentación de quizzes y consulta de progreso.
- `supervision-tutor`: Vista de supervisión: progreso y pendientes de los estudiantes vinculados, sin capacidad de completar actividades.
- `motor-progreso`: Rastreo granular por tipo (PDF, video, quiz, actividad práctica), sincronización optimista con reconsolidación en backend, estados de progreso completos.

### Modified Capabilities

- `agenda-maestro`: Los bloques horarios actuales evolucionan a bloques recurrentes + jornadas de instrucción. Cambian los requisitos de programación: ahora incluyen sede, espacio, validación de conflictos y cierre operativo.

## Impact

### Código afectado

- **`src/models/`**: Nuevos tipos para `JornadaInstruccion`, `BloqueRecurrente`, `EspacioFisico`, `ProgramaAcademico`, `RecursoAcademico`, `AsignacionAcademica`, `ProgresoEstudiante`, `InvitacionUsuario`.
- **`src/services/`**: Nuevos servicios para Drive OAuth, biblioteca, programas, jornadas, asignaciones y progreso. Extensión de `authService` para invitaciones y roles académicos.
- **`src/hooks/`**: Hooks para progreso local (PDF, video, quiz) con sincronización por intervalo.
- **`src/views/`**: Vistas nuevas: Centro de Estudios, Supervisión Tutor, Agenda del Maestro ampliada, Admin de Biblioteca y Programas.
- **`functions/`**: Cloud Functions para OAuth Drive, acceso temporal a archivos, invitaciones, confirmación de jornadas, detección de conflictos, consolidación de progreso y webhooks de Drive.
- **`firestore.rules`**: Nuevas reglas para colecciones académicas con aislamiento por `tenantId`, validación de roles y relación tutor-estudiante.

### APIs y dependencias nuevas

- **Google Drive API v3**: OAuth institucional, metadata de archivos, acceso temporal a contenido.
- **Firebase Auth**: Flujo de invitación por correo (custom action links).
- **Cloud Functions Node 20**: Operaciones sensibles de backend (tokens, conflictos, cierre).

### Tests afectados

- Cobertura actual: desconocida (no hay evidencia de coverage report en el repositorio).
- Cobertura objetivo: ≥ 70 % en servicios nuevos (Jest); tests E2E (Cypress) para flujos críticos: invitación, publicación de asignación, consumo de recurso y cierre de jornada.
- Los tests existentes de `client-item`, `evento-landing-publica` y `evento-lead-capture` no se ven afectados directamente.

### Plan de rollback

El Centro de Estudios se habilitará por tenant mediante **feature flag** en Firestore (`tenants/{id}/features.centroEstudios: boolean`). Si se detectan problemas en producción:
1. Desactivar el flag del tenant afectado → la UI oculta todas las vistas académicas.
2. Las Cloud Functions académicas son independientes; se pueden desactivar sin afectar el núcleo comercial.
3. Los `BloqueHorario` actuales se conservan durante la migración; se puede revertir a la agenda original si la evolución a jornadas falla.
