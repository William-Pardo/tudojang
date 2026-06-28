# Plan de implementación — `Modulo_Estudio.md`

## 1. Objetivo y arquitectura

Implementar un Centro de Estudios multi-tenant integrado con Agenda Maestro, sedes, instructores, estudiantes, tutores y Google Drive institucional.

Flujo central:

```text
Google Drive institucional
→ Biblioteca académica
→ Programa formativo
→ Jornada de instrucción
→ Asignación del maestro
→ Centro de Estudios del estudiante
→ Seguimiento del tutor
→ Resultados para maestro y tenant
```

Responsabilidades:

- Google Drive almacena los archivos.
- Tudojang conserva referencias, clasificación y trazabilidad.
- El tenant gobierna biblioteca, programas, sedes y permisos.
- Agenda Maestro coordina jornadas, instructores, espacios y horarios.
- El maestro publica materiales aprobados para grupos, grados o estudiantes.
- El estudiante consume materiales y presenta actividades.
- El tutor supervisa sin poder completar actividades.
- Firebase Authentication gestiona accesos mediante invitación por correo.

## 2. Modelo funcional y de datos

### Identidad y permisos

Ampliar los roles actuales con:

- `Estudiante`: consulta y completa sus asignaciones.
- `Tutor`: supervisa estudiantes vinculados.
- `Instructor`: corresponde a los roles operativos existentes.
- `Admin`: administra todo el tenant.

Cada cuenta tendrá un único UID de Firebase Auth. Un tutor podrá vincularse con varios estudiantes y un estudiante podrá tener varios tutores.

Toda entidad académica incluirá `tenantId`. Las entidades operativas incluirán además `sedeId` cuando corresponda.

### Agenda Maestro

Evolucionar los actuales bloques semanales hacia dos conceptos:

- **Bloque recurrente:** patrón semanal de grupo, sede, espacio, horario y maestro.
- **Jornada de instrucción:** instancia real de una clase en una fecha determinada.

Cada sede tendrá espacios físicos con nombre, capacidad y usos permitidos. Antes de confirmar una jornada, el backend validará:

- Disponibilidad del maestro.
- Disponibilidad del espacio.
- Ausencia de cruces del grupo.
- Autorización del maestro para la sede.
- Capacidad del espacio.
- Compatibilidad entre maestro, disciplina y objetivo.

Estados de jornada:

```text
Borrador
→ Pendiente de confirmación
→ Confirmada
→ En curso
→ Pendiente de cierre
→ Cerrada
```

Alternativas: cancelada, reprogramada, parcial o pendiente de sustitución.

Cerrar una jornada exige registrar asistencia, objetivos impartidos y materiales posteriores. Una clase cancelada no avanza el ciclo.

### Programas y ciclos formativos

Separar los programas comerciales actuales de los nuevos programas académicos.

Un programa académico contendrá:

- Disciplina.
- Nivel o rango de grados.
- Objetivos formativos.
- Unidades y temas.
- Número esperado de clases.
- Prerrequisitos.
- Criterios de evaluación.
- Recursos predeterminados.
- Versión publicada.

Cada grupo tendrá una ejecución independiente del programa. Una jornada podrá contener un objetivo común y adaptaciones por grado, porque en un grupo pueden asistir estudiantes de varios niveles.

Las reglas de activación podrán depender de:

- Número de clase.
- Fecha absoluta.
- Tiempo antes o después de una jornada.
- Tiempo previo al examen de ascenso.
- Activación manual.

### Google Drive y biblioteca académica

Cada tenant conectará una cuenta institucional de Google Drive mediante OAuth. Se seleccionará una carpeta raíz administrada por la academia.

Los tokens permanecerán cifrados en backend. Nunca se expondrán al navegador del estudiante.

Crear una interfaz abstracta de almacenamiento que permita incorporar posteriormente SharePoint/OneDrive y Dropbox. La primera versión implementará exclusivamente Google Drive.

Por cada archivo seleccionado se registrará:

- Proveedor y conexión institucional.
- `externalFileId`.
- Nombre, MIME, tamaño y versión.
- Fecha de modificación.
- Ruta informativa.
- Estado de acceso.
- Hash o identificador de versión cuando esté disponible.

La ficha académica separada contendrá:

- Disciplina y tema.
- Nivel mínimo y máximo.
- Tipo: PDF, video, imagen, presentación, enlace o cuestionario.
- Usos: estudio, preparación, refuerzo, consulta o evaluación.
- Duración estimada.
- Autor.
- Estado: borrador, pendiente, aprobado, archivado o inaccesible.

Mover o renombrar un archivo no romperá la relación mientras conserve su identificador. Si se elimina o pierde permisos, las asignaciones se bloquearán y el tenant recibirá una alerta.

### Asignaciones académicas

El maestro asignado a una jornada podrá publicar directamente recursos institucionales aprobados.

Cada asignación indicará:

- Recurso académico.
- Jornada y programa relacionados.
- Grupo, grados o estudiantes destinatarios.
- Sede.
- Uso académico.
- Obligatoria u opcional.
- Apertura y cierre.
- Momento: preparación, durante el ciclo o refuerzo posterior.
- Criterio de finalización.
- Maestro responsable.

Los recursos nuevos aportados por un maestro quedarán pendientes de revisión antes de incorporarse a la biblioteca institucional.

### Progreso y evaluaciones

Estados:

```text
Bloqueado
Disponible
Iniciado
En progreso
Completado
Pendiente de revisión
Aprobado
Requiere refuerzo
Vencido
```

Criterios:

- PDF: páginas únicas visualizadas, permanencia mínima y llegada al tramo final.
- Video: segundos únicos reproducidos; visualización suficiente desde 78%.
- Quiz: respuestas, intentos, puntuación y umbral configurable.
- Actividad práctica: requiere validación presencial del maestro.

Ver un archivo no equivale a dominar el contenido.

La aplicación almacenará progreso local temporal y sincronizará por intervalos, pausa, cierre y finalización. No registrará eventos por segundo.

## 3. Interfaces y servicios

### Administrador del tenant

- Conectar y desconectar Google Drive.
- Seleccionar carpeta institucional.
- Importar y clasificar recursos.
- Aprobar aportes de maestros.
- Crear programas académicos y ciclos.
- Administrar espacios, disponibilidad y competencias.
- Consultar agenda consolidada por sede y maestro.
- Auditar publicaciones, consumo y resultados.

### Maestro

- Consultar agenda y jornadas asignadas.
- Confirmar o rechazar jornadas.
- Revisar objetivos y estudiantes por grado.
- Seleccionar materiales aprobados.
- Publicar por grupo, grado o estudiante.
- Registrar asistencia y modificaciones.
- Cerrar la jornada.
- Validar actividades prácticas.
- Consultar pendientes y dificultades del grupo.

### Estudiante

- Activar cuenta mediante invitación por correo.
- Consultar materiales vigentes.
- Descargar o visualizar recursos autorizados.
- Continuar desde progreso local sincronizado.
- Presentar quizzes.
- Consultar avance y próximas evaluaciones.

### Tutor

- Activar una única cuenta mediante correo.
- Supervisar uno o varios estudiantes vinculados.
- Consultar progreso, pendientes y fechas.
- No reproducir progreso ni responder actividades en nombre del estudiante.

### Backend

Las operaciones sensibles se ejecutarán mediante Cloud Functions:

- Conexión OAuth y renovación de tokens.
- Acceso temporal a archivos.
- Invitación y vinculación de usuarios.
- Confirmación de jornadas.
- Detección de conflictos.
- Publicación de asignaciones.
- Consolidación de progreso.
- Webhooks o sincronización de cambios en Drive.

## 4. Seguridad, costos y migración

- Mantener aislamiento obligatorio por `tenantId`.
- Validar acceso por rol, relación tutor-estudiante y asignación vigente.
- No utilizar documentos de identidad como contraseña.
- No publicar enlaces abiertos de Drive.
- Limitar dispositivos y sesiones simultáneas si el tenant lo configura.
- Cachear metadatos y archivos permitidos con versión y expiración.
- Evitar listeners permanentes y consultas documento por documento.
- Conservar auditoría de conexión, publicación, acceso, evaluación y cierre.

Migración:

1. Mantener temporalmente los actuales `BloqueHorario`.
2. Incorporar espacios, disponibilidad y validación de conflictos.
3. Generar jornadas desde los bloques recurrentes.
4. Añadir cierre operativo sin romper la agenda actual.
5. Activar programas académicos y biblioteca.
6. Crear cuentas de estudiantes y tutores por invitación.
7. Habilitar el Centro de Estudios por tenant mediante feature flag.

## 5. Pruebas y aceptación

- Impedir cruces de maestro, espacio o grupo.
- Permitir ritmos distintos entre grupos de una misma sede.
- Manejar grupos con varios grados.
- No avanzar ciclos por clases canceladas.
- Publicar únicamente materiales aprobados.
- Mantener relaciones cuando un archivo se renombra o mueve.
- Bloquear archivos eliminados o sin permisos.
- Aislar completamente datos entre tenants.
- Verificar acceso de estudiante y solo supervisión del tutor.
- Vincular un tutor con varios estudiantes.
- Calcular PDF, video y quiz sin escrituras excesivas.
- Confirmar que el cierre parcial active solo lo realmente impartido.
- Conservar progreso ante reprogramación, cambio de grupo o versión.
- Validar recuperación de contraseña e invitaciones vencidas.
- Medir consultas y escrituras para sostener los rangos de costos estimados.

## Decisiones aprobadas

- Primera integración: Google Drive institucional.
- Arquitectura preparada para OneDrive/SharePoint y Dropbox.
- Activación de estudiantes y tutores por invitación de correo.
- Publicación directa por el maestro para recursos institucionales aprobados.
- Un tutor puede supervisar varios estudiantes.
- Los archivos permanecen en Drive; Tudojang almacena referencias y metadatos.
- Agenda Maestro será la fuente operativa de jornadas y disponibilidad.
- El cierre del maestro determina el avance efectivo del ciclo.
