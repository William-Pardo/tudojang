# GuÃ­a de ConexiÃ³n de Google Drive y ActivaciÃ³n del Centro de Estudios

Este documento contiene la documentaciÃ³n base de infraestructura y UX para la integraciÃ³n del mÃ³dulo de **Centro de Estudios** con **Google Drive** en Tudojang SaaS.

---

## 1. GuÃ­a Preliminar de ConexiÃ³n Google Drive para Administradores (A1.1)

El Centro de Estudios se alimenta de recursos acadÃ©micos almacenados en carpetas de Google Drive especÃ­ficas de cada escuela (tenant). Para establecer la conexiÃ³n:

### Requisitos Previos:
- Una cuenta de Google Drive con acceso de propiedad o ediciÃ³n de la carpeta que se desea vincular.
- Haber iniciado sesiÃ³n como Administrador en Tudojang.

### Paso a Paso para la ConexiÃ³n:
1. DirÃ­jase al menÃº **Biblioteca AcadÃ©mica** (dentro del Centro de Estudios).
2. Si el tenant no estÃ¡ conectado a Google Drive, se mostrarÃ¡ el panel **"ConexiÃ³n Google Drive"**.
3. Haga clic en el botÃ³n **"Conectar Google Drive"**. Esto abrirÃ¡ una pestaÃ±a del flujo seguro de autenticaciÃ³n de Google (OAuth).
4. Inicie sesión con la cuenta de Google deseada y conceda el permiso limitado de Google Drive (`drive.file`), que permite operar solo con archivos o carpetas autorizados explícitamente por el usuario.
5. Tras confirmar la autorizaciÃ³n, Google lo redirigirÃ¡ de regreso a Tudojang.
6. La interfaz de la Biblioteca procesarÃ¡ el cÃ³digo devuelto y cambiarÃ¡ el estado de la conexiÃ³n a **Conectado**, mostrando el identificador de conexiÃ³n asignado (`connectionId`).

---

## 2. GuÃ­a de ActivaciÃ³n del Centro de Estudios por Tenant (A1.2)

La activaciÃ³n del Centro de Estudios para una escuela (tenant) requiere la validaciÃ³n de dependencias. Siga este flujo de pre-requisitos:

1. **OAuth de Google Drive Completo:** Debe haber una conexiÃ³n activa (`connectionId` persistido).
2. **SelecciÃ³n de la Carpeta RaÃ­z (FolderId):** *(Pendiente de C2)* El administrador debe seleccionar o ingresar el enlace de una carpeta de Drive que actuarÃ¡ como biblioteca origen.
3. **Carga y AprobaciÃ³n de Recursos:**
   - La Biblioteca del administrador listarÃ¡ los archivos dentro de la carpeta.
   - El administrador o maestro debe "importar" y clasificar cada recurso (estudio, refuerzo, evaluaciÃ³n, consulta).
   - Los recursos importados quedan en estado "pendiente" en la Biblioteca hasta que sean explÃ­citamente **Aprobados**.
4. **ProgramaciÃ³n y Cierre de Jornadas:**
   - Para que el alumno vea asignaciones, se requiere una **Jornada de InstrucciÃ³n** activa.
   - Al finalizar la clase, el maestro cierra la jornada, lo que puede publicar de manera automatizada objetivos de refuerzo en la secciÃ³n de asignaciones del estudiante.

---

## 3. Matriz de Roles y Accesos (A1.3)

| Rol | Alcance en Centro de Estudios | Permisos de Escritura | Limitaciones / Restricciones |
| :--- | :--- | :--- | :--- |
| **Admin (Administrador)** | GestiÃ³n completa de conexiÃ³n, biblioteca, publicaciÃ³n de asignaciones e inspecciÃ³n de progreso. | SÃ­ (Drive OAuth, aprobaciÃ³n de recursos, asignaciones, parÃ¡metros de tenant). | Acceso total sin restricciones. |
| **Maestro / Editor** | OperaciÃ³n diaria: biblioteca, asignaciÃ³n de recursos a estudiantes, creaciÃ³n y cierre de jornadas. | SÃ­ (AprobaciÃ³n de recursos locales, jornadas, registrar asistencia/objetivos). | No puede revocar o modificar credenciales de conexiÃ³n OAuth globales del tenant. |
| **Estudiante** | VisualizaciÃ³n de asignaciones vigentes, descarga temporal de materiales de estudio y resoluciÃ³n de quizzes. | SÃ­ (Guardado de progreso propio de video, PDF y quizzes). | **Lectura estricta:** Solo ve sus asignaciones asignadas, no ve el panel de administraciÃ³n, biblioteca, ni otros estudiantes. |
| **Tutor (Acudiente)** | Supervision en modo de solo lectura del progreso acadÃ©mico de sus estudiantes vinculados. | No (Solo lectura). | **Bloqueo de escritura:** No puede completar quizzes, marcar actividades como completadas ni abrir enlaces de descarga en nombre del alumno. |

---

## 4. Checklist Manual de Staging Google Drive (A1.4)

Antes de pasar a producciÃ³n o habilitar la integraciÃ³n a un cliente piloto, realice estas comprobaciones manuales:

- [ ] **ConfiguraciÃ³n de Variables de Entorno (Functions):** Verificar que `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI` estÃ©n configuradas y coincidan con el proyecto de Google Cloud Console.
- [ ] **Consentimiento de OAuth:** Verificar que la pantalla de consentimiento de Google OAuth no estÃ© en modo borrador o que el tenant piloto estÃ© registrado como usuario de prueba si el proyecto de Google Cloud estÃ¡ en modo "Testing".
- [ ] **Aislamiento por Tenant (Cross-Tenant check):**
  - Conectar el Tenant A a la Cuenta Google A.
  - Conectar el Tenant B a la Cuenta Google B.
  - Comprobar que desde el Tenant A sea imposible listar o acceder a los archivos del Tenant B.
- [ ] **Acceso Temporal a Archivos:**
  - Intentar descargar un archivo desde la cuenta del Estudiante.
  - Extraer la URL temporal generada.
  - Comprobar que la URL temporal expire correctamente tras el tiempo configurado (mÃ¡ximo 1 hora) y quede inoperable.
- [ ] **RevocaciÃ³n de Acceso:**
  - Desconectar la cuenta en la Biblioteca del Tenant.
  - Comprobar que el token local quede invalidado y que futuros accesos a la API de Drive arrojen un error de credenciales revocadas manejado correctamente por la UI.

---

## 5. Propuesta de Copy y Estados de Interfaz (A1.5)

Para guiar de forma clara al usuario, se proponen los siguientes copys y flujos visuales segÃºn el estado de la conexiÃ³n y permisos:

### 5.1 Drive Desconectado (Estado inicial)
- **TÃ­tulo:** Conecta tu Google Drive
- **Mensaje:** "Para comenzar a utilizar la Biblioteca AcadÃ©mica, necesitas vincular una cuenta de Google Drive. Esto te permitirÃ¡ clasificar e importar tus materiales de estudio de forma segura."
- **BotÃ³n de acciÃ³n:** "Conectar Google Drive"

### 5.2 OAuth Pendiente (Durante la redirecciÃ³n)
- **TÃ­tulo:** Conectando con Google...
- **Mensaje:** "Estamos validando tus credenciales con Google. SerÃ¡s redirigido de regreso a Tudojang en un momento."
- **Estado visual:** Spinner animado de carga.

### 5.3 Carpeta No Seleccionada (OAuth activo, pero sin directorio raÃ­z)
- **TÃ­tulo:** Selecciona una Carpeta RaÃ­z
- **Mensaje:** "Â¡Tu Google Drive estÃ¡ conectado! Ahora debes seleccionar la carpeta que contiene los materiales acadÃ©micos para tus estudiantes."
- **BotÃ³n de acciÃ³n:** "Seleccionar Carpeta" o "Pegar Enlace de Carpeta"

### 5.4 Carpeta Sin Archivos (Explorador vacÃ­o)
- **TÃ­tulo:** Carpeta sin materiales
- **Mensaje:** "No encontramos archivos vÃ¡lidos (PDF, Videos o Documentos) en la carpeta seleccionada. Sube contenido a tu Google Drive e intenta recargar."
- **BotÃ³n de acciÃ³n:** "Buscar de nuevo / Recargar"

### 5.5 Token Revocado (Error de expiraciÃ³n o desvinculaciÃ³n manual desde Google)
- **TÃ­tulo:** ConexiÃ³n de Drive expirada
- **Mensaje:** "Se ha perdido el acceso autorizado a tu Google Drive (el token fue revocado o expirÃ³). Por favor, vuelve a vincular tu cuenta para restablecer el servicio."
- **BotÃ³n de acciÃ³n:** "Reconectar Google Drive"

### 5.6 Permisos Insuficientes (La cuenta de Google seleccionada no tiene acceso al archivo o carpeta)
- **TÃ­tulo:** Permisos insuficientes en Drive
- **Mensaje:** "No tenemos acceso a este archivo. AsegÃºrate de que la cuenta de Google vinculada tenga permisos de lector en la carpeta de Drive seleccionada."
- **BotÃ³n de acciÃ³n:** "Verificar Permisos en Drive"
### 5.7 Carpeta Inaccesible (Error de acceso)
- **TÃ­tulo:** Carpeta inaccesible
- **Mensaje:** "No podemos acceder a la carpeta seleccionada. Verifique permisos de lectura y que la carpeta exista."
- **BotÃ³n de acciÃ³n:** "Verificar carpeta"

---

## 6. Estados vacÃ­os reales

Tabla de referencia para diseÃ±ar y validar los estados vacÃ­os del mÃ³dulo segÃºn rol y contexto de Drive.

| Estado | CuÃ¡ndo aparece | Texto sugerido | AcciÃ³n primaria | AcciÃ³n secundaria | Rol afectado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Admin/maestro sin Drive conectado | Usuario accede a Biblioteca sin haber completado OAuth. | "Conecta tu Google Drive para empezar a gestionar materiales acadÃ©micos." | "Conectar Google Drive" | â€” | Admin, Maestro |
| Admin/maestro con Drive conectado pero sin carpeta seleccionada | OAuth activo pero `folderId` no configurado. | "Â¡Drive conectado! SeleccionÃ¡ la carpeta que contiene los materiales de tu escuela." | "Seleccionar carpeta" | "Pegar link de carpeta" | Admin, Maestro |
| Carpeta Drive vacÃ­a | Carpeta vÃ¡lida seleccionada pero sin archivos compatibles (PDF, video, doc). | "No encontramos archivos en esta carpeta. SubÃ­ contenido a Drive e intentÃ¡ de nuevo." | "Buscar de nuevo / Recargar" | â€” | Admin, Maestro |
| Biblioteca sin recursos importados | Carpeta tiene archivos pero ninguno fue importado. | "TodavÃ­a no importaste ningÃºn material. ExplorÃ¡ tu carpeta y seleccionÃ¡ los recursos para importar." | "Explorar carpeta" | â€” | Admin, Maestro |
| Biblioteca sin recursos aprobados | Recursos importados pero todos en estado "pendiente". | "TenÃ©s materiales pendientes de aprobaciÃ³n. Revisalos y aprobÃ¡ los que estÃ©n listos para tus estudiantes." | "Ver pendientes" | â€” | Admin, Maestro |
| Estudiante sin asignaciones | Estudiante autenticado sin asignaciones activas en su jornada. | "TodavÃ­a no tenÃ©s materiales asignados. Tu maestro los publicarÃ¡ pronto." | â€” | â€” | Estudiante |
| Tutor sin estudiantes vinculados | Tutor sin alumnos activos bajo su supervisiÃ³n. | "AÃºn no tenÃ©s estudiantes vinculados. ContactÃ¡ al administrador de tu escuela." | â€” | â€” | Tutor |
| Tutor con estudiantes vinculados pero sin progreso | Estudiantes activos, pero sin actividad registrada. | "Tus estudiantes aÃºn no registran actividad. Los datos aparecerÃ¡n cuando comiencen a trabajar en sus asignaciones." | â€” | â€” | Tutor |
| Token revocado | El token OAuth expirÃ³ o fue revocado desde la cuenta Google del usuario. | "ConexiÃ³n de Drive expirada. VolvÃ© a vincular tu cuenta para restablecer el servicio." | "Reconectar Google Drive" | â€” | Admin, Maestro |
| Permisos insuficientes | La cuenta de Google no tiene permisos de lectura sobre el archivo o carpeta. | "No tenemos acceso a este archivo. Asegurate de que tu cuenta tenga permisos de lector en la carpeta de Drive." | "Verificar Permisos en Drive" | â€” | Admin, Maestro |
| Carpeta inaccesible | La carpeta fue eliminada, movida o sus permisos cambiaron desde Drive. | "No podemos acceder a la carpeta seleccionada. VerificÃ¡ permisos y que la carpeta exista en Drive." | "Verificar carpeta" | â€” | Admin, Maestro |

---

## 7. RevisiÃ³n de textos demo/piloto

Textos de demo y piloto identificados o plausibles en el mÃ³dulo. Deben estar bajo feature flag o eliminarse antes de producciÃ³n.

| Texto encontrado | Archivo o mÃ³dulo | Riesgo UX | Reemplazo recomendado | Prioridad | ObservaciÃ³n |
| :--- | :--- | :--- | :--- | :--- | :--- |
| "Demo UX" | requiere bÃºsqueda en cÃ³digo | Confunde al usuario real; rompe la percepciÃ³n de producto profesional. | Eliminar o reemplazar por copy real segÃºn estado de Drive. | Alta | Buscar con `grep -r "Demo UX"` en `components/` y `vistas/`. |
| "piloto" | requiere bÃºsqueda en cÃ³digo | Expone terminologÃ­a interna; genera incertidumbre en usuarios piloto reales. | Reemplazar por copy definitivo de bienvenida o descripciÃ³n del mÃ³dulo. | Alta | Puede aparecer en banners de activaciÃ³n o headers de secciÃ³n. |
| "datos demo" | requiere bÃºsqueda en cÃ³digo | Muestra datos ficticios como si fueran reales; rompe la confianza del usuario. | Eliminar o reemplazar por estado vacÃ­o real segÃºn contexto. | Alta | Verificar en fixtures, seeders y componentes de preview. |
| "modo piloto" | requiere bÃºsqueda en cÃ³digo | Genera confusiÃ³n sobre disponibilidad del mÃ³dulo. | Eliminar. Mostrar solo cuando el feature flag estÃ© activo en entorno controlado. | Media | Solo debe verse en entornos con `FEATURE_DEMO=true`. |
| "sin consumo de IA" | requiere bÃºsqueda en cÃ³digo | Expone detalle tÃ©cnico interno; irrelevante para el usuario final. | Eliminar. No mostrar mensajes de arquitectura interna al usuario. | Media | Puede estar en tooltips o footers de mÃ³dulos IA. |
| "tenant-demo" | requiere bÃºsqueda en cÃ³digo | Identificador de tenant de prueba expuesto en UI o logs; riesgo de confusiÃ³n. | Reemplazar por nombre real del tenant o eliminarlo de la vista. | Alta | Verificar en selectores de tenant o mensajes de bienvenida. |
| "admin-demo" | requiere bÃºsqueda en cÃ³digo | Identificador de usuario demo expuesto; riesgo de confusiÃ³n con administrador real. | Reemplazar por nombre real del usuario autenticado. | Alta | Verificar en headers de usuario o mensajes de saludo. |

