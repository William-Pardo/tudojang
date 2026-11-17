# Propuesta: Agregar Video Directo a Biblioteca y Asignación de Material

## Contexto y Motivación
Actualmente, para que un video se pueda reproducir en el Centro de Estudios, el sistema exige tener conectada una cuenta de Google Drive, seleccionar una carpeta e importar un archivo físico desde Drive. Solo después de eso, se puede editar la ficha del archivo y pegarle un enlace de video (YouTube).

Esto genera un acoplamiento indebido:
1. El video en realidad vive en una plataforma externa (YouTube) y se reproduce vía streaming/iframe sin costo de almacenamiento ni transferencia para Drive.
2. Obliga a subir un archivo "fantasma" a Drive solo para habilitar la ficha.
3. Si Google Drive no está conectado o la sesión expira, no es posible cargar ni asignar videos.

## Solución Propuesta
Habilitar la creación y asignación directa de recursos de video mediante URL en dos puntos clave de la interfaz, sin alterar el flujo actual:
1. **En la vista de Biblioteca (`BibliotecaView.tsx`):**
   - Incorporar un botón con ícono de video (`+`) junto a la sección de recursos detectados / carpeta activa, con tooltip flotante "Agregar video".
   - Al pulsar el botón, abrir el modal de clasificación con los mismos campos existentes (Título visible, Disciplina, Tipo: video, URL del video, Tags).
   - Unificar la lista de recursos detectados para que incluya tanto los archivos de Drive como los recursos creados directamente por URL, permitiendo que sigan siendo visibles, editables y aprobados aunque Drive no esté conectado.
2. **En el Asistente de Asignar Material (`AsignarMaterialWizard.tsx`):**
   - Incorporar en el Paso 1 (Material) el botón con ícono de video y nota/tooltip "Agregar video".
   - Al pulsarlo, abrir el mismo modal emergente de clasificación de video.
   - Al guardar, el video se persiste en la biblioteca, se aprueba, se añade a la lista de materiales disponibles y queda automáticamente seleccionado para la clase en curso.
3. **Validación y Resiliencia:**
   - Validar que la URL ingresada sea válida y reproducible antes de permitir guardar.
   - Mantener compatibilidad total hacia atrás con los modelos de datos existentes (`RecursoAcademico` y `AsignacionAcademica`).
