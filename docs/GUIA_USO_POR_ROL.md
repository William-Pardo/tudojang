# Guía Final de Uso por Rol – Centro de Estudios

Versión: 1.0 | Fecha: 2026-06-29 | Responsable: Antigravity/Gemini (A3.1)

---

## 1. Administrador

### Acceso
- Inicia sesión con cuenta de Administrador en Tudojang.
- Accede al módulo **Centro de Estudios** desde el menú principal.

### Flujo principal

#### 1.1 Conectar Google Drive
1. Ir a **Biblioteca Académica**.
2. Si el tenant no tiene Drive vinculado, aparece el panel **"Conexión Google Drive"**.
3. Hacer clic en **"Conectar Google Drive"** → flujo OAuth de Google.
4. Autorizar los permisos sobre los archivos seleccionados/autorizados (drive.file).
5. Verificar que el estado cambia a **Conectado**.

#### 1.2 Seleccionar carpeta raíz
1. Pegar el enlace o ID de la carpeta de Drive con los materiales.
2. Confirmar la carpeta con el botón de validación.
3. Verificar que la Biblioteca lista los archivos de la carpeta.

#### 1.3 Importar y clasificar recursos
1. Seleccionar un archivo de Drive y hacer clic en **"Importar"**.
2. Elegir el tipo de recurso: estudio / refuerzo / evaluación / consulta.
3. El recurso queda en estado **Pendiente**.

#### 1.4 Aprobar recursos
1. Ir a la lista de recursos pendientes.
2. Revisar cada recurso y hacer clic en **"Aprobar"**.
3. El recurso pasa a estado **Aprobado** y está disponible para asignar.

#### 1.5 Crear y confirmar jornada
1. Ir a **Jornadas** → **Nueva jornada**.
2. Seleccionar instructor, grupo, sede y espacio.
3. Confirmar la jornada. Estado: **Confirmada**.

#### 1.6 Publicar asignación
1. Desde la jornada confirmada, seleccionar recursos aprobados.
2. Asignar a un grupo o estudiante individual.
3. Confirmar publicación. La asignación aparece en el panel del estudiante.

---

## 2. Maestro / Editor

### Acceso
- Inicia sesión con cuenta de Maestro.
- Accede a **Centro de Estudios** → **Biblioteca**.

### Flujo principal

#### 2.1 Biblioteca de recursos
- Puede ver, clasificar y aprobar recursos en estado Pendiente.
- **No puede** revocar ni modificar credenciales OAuth del tenant.

#### 2.2 Gestión de jornadas
1. Crear jornada con sus datos de grupo e instructor.
2. Confirmar asistencia.
3. Cerrar la jornada al finalizar la clase → puede disparar publicación automática de refuerzos.

#### 2.3 Publicar asignaciones
- Igual que Administrador, con los recursos que él mismo aprobó.

---

## 3. Estudiante

### Acceso
- Inicia sesión con su cuenta de Estudiante.
- Accede a **Mis Asignaciones** o al panel de **Centro de Estudios**.

### Flujo principal

#### 3.1 Ver asignaciones
- Solo ve las asignaciones publicadas para él/ella por el maestro/admin.
- No ve la Biblioteca global, Jornadas ni el panel de administración.

#### 3.2 Consumir material
1. Hacer clic en la asignación para abrirla.
2. El material se abre con una **URL temporal segura** (máx. 1 hora).
3. Progreso se guarda automáticamente (video, PDF, quiz).

#### 3.3 Estado vacío
- Si no hay asignaciones: "Todavía no tenés materiales asignados. Tu maestro los publicará pronto."

---

## 4. Tutor (Acudiente)

### Acceso
- Inicia sesión con cuenta de Tutor.
- Accede al **Dashboard de Tutor** → sección de progreso de sus estudiantes vinculados.

### Flujo principal

#### 4.1 Ver progreso
- Ve el progreso de sus estudiantes vinculados (actividades completadas, material abierto).
- No puede completar quizzes ni marcar actividades en nombre del alumno.
- No puede acceder a links de descarga.

#### 4.2 Estado vacío
- Sin estudiantes vinculados: "Aún no tenés estudiantes vinculados. Contactá al administrador de tu escuela."
- Con estudiantes sin actividad: "Tus estudiantes aún no registran actividad."

---

## 5. Restricciones transversales

| Acción | Admin | Maestro | Estudiante | Tutor |
| :--- | :---: | :---: | :---: | :---: |
| Conectar/desconectar Drive | ✅ | ❌ | ❌ | ❌ |
| Importar recursos | ✅ | ✅ | ❌ | ❌ |
| Aprobar recursos | ✅ | ✅ | ❌ | ❌ |
| Crear/confirmar jornada | ✅ | ✅ | ❌ | ❌ |
| Publicar asignaciones | ✅ | ✅ | ❌ | ❌ |
| Ver propias asignaciones | ❌ | ❌ | ✅ | ❌ |
| Ver progreso de estudiantes | ✅ | ✅ | ❌ | ✅ (solo lectura) |
| Abrir material con URL temporal | ❌ | ❌ | ✅ | ❌ |

