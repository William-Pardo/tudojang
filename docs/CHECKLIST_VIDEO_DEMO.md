# Checklist Manual para Video/Demo – Centro de Estudios

Formato de tabla para pruebas manuales antes de grabar el video de demostración.

## Ruta A - Demo local sin Google Drive real

Usar esta ruta cuando OAuth/Secrets de Google Drive sigan pendientes. Esta demo valida UX, roles, importacion simulada, clasificacion y aprobacion; no valida conexion real a Drive ni URLs temporales reales.

| Acción | Resultado esperado | Evidencia a capturar en video | Riesgo si falla |
| :--- | :--- | :--- | :--- |
| Abrir Centro Estudios como admin/maestro | El modulo carga con el header estandar de Tudojang y sin 404. | Captura de la entrada al modulo. | El modulo no esta montado correctamente en la navegacion. |
| Revisar Biblioteca | Aparece aviso "Modo demo activo" y badge "Demo sin Drive real". | Captura del aviso visible. | El usuario puede confundir datos demo con conexion Drive real. |
| Importar material demo | Un archivo de muestra pasa a Recursos importados. | Grabacion del boton Importar y la tarjeta creada. | No se puede demostrar el flujo academico sin OAuth. |
| Clasificar recurso | Permite ajustar disciplina, tipo y uso academico. | Captura de campos y boton Guardar clasificacion. | El recurso no queda preparado para aprobacion/asignacion. |
| Aprobar recurso | Recurso cambia a estado aprobado. | Captura del estado aprobado. | La biblioteca no puede alimentar asignaciones. |
| Crear/validar jornada | Jornada queda visible dentro de Centro Estudios. | Captura de la seccion Jornadas dentro del modulo. | La trazabilidad queda separada del flujo academico. |
| Revisar vista estudiante/tutor | Estudiante/tutor ve su experiencia limitada, sin panel admin global. | Captura por rol. | Fuga UX o permisos incorrectos. |
| Confirmar bloqueo Drive | Intentar conectar Drive deja claro que OAuth real esta pendiente si no hay secrets. | Captura del mensaje controlado. | Error generico o pantalla en blanco. |

## Ruta B - QA produccion con Google Drive real

| Acción | Resultado esperado | Evidencia a capturar en video | Riesgo si falla |
| :--- | :--- | :--- | :--- |
| Conectar Google Drive | Panel OAuth se abre. Botón "Conectar Google Drive" visible. | Captura del panel antes de OAuth y redirect a Google. | Usuario queda sin Drive vinculado; Biblioteca no opera. |
| Confirmar estado Drive conectado | Interfaz muestra estado "Conectado" con connectionId visible. | Captura del estado post-OAuth con indicador verde. | Estado inconsistente; la UI puede mostrar error o pantalla en blanco. |
| Pegar link o ID de carpeta | Campo acepta la URL o ID y lo valida antes de guardar. | Captura del campo con URL pegada y botón de confirmar. | folderId no se persiste; carpeta queda sin selección. |
| Validar carpeta | Sistema confirma que la carpeta existe y es accesible con permisos actuales. | Captura del mensaje de validación exitosa. | Carpeta inaccesible o permisos insuficientes: UX sin feedback claro. |
| Abrir subcarpeta | Explorador lista subcarpetas y archivos de Drive correctamente. | Grabación del navegador explorando estructura de carpetas. | Explorador en blanco o error 403 sin mensaje legible. |
| Ver carpeta sin archivos | Estado vacío muestra mensaje "Carpeta sin materiales" con botón "Recargar". | Captura del estado vacío con copy correcto. | Spinner infinito o pantalla en blanco sin orientar al usuario. |
| Importar archivo real | Archivo de Drive aparece en la Biblioteca con estado "pendiente". | Grabación del botón "Importar" y transición a lista de pendientes. | Recurso no se crea; Biblioteca queda vacía. |
| Clasificar recurso | Recurso admite tipo (estudio/refuerzo/evaluación/consulta) y se guarda. | Captura del selector de tipo y confirmación de guardado. | Recurso sin clasificar no puede aprobarse ni asignarse. |
| Aprobar recurso | Recurso cambia estado de "pendiente" a "aprobado" y aparece en Biblioteca activa. | Captura del cambio de estado en la lista de la Biblioteca. | Recurso aprobado no visible para estudiante. |
| Confirmar jornada | Jornada queda en estado "confirmada" con instructor, grupo y sede asignados. | Captura del resumen de jornada confirmada. | Asignaciones no pueden publicarse sin jornada activa. |
| Publicar asignación | Asignación aparece en el panel del estudiante vinculado con acceso correcto. | Grabación del flujo admin: seleccionar recurso → asignar → confirmar. | Estudiante no ve la asignación; ciclo de aprendizaje interrumpido. |
| Entrar como estudiante | Estudiante ve solo sus asignaciones; no ve panel admin ni Biblioteca global. | Captura de la vista del estudiante con asignaciones propias. | Fuga de datos: estudiante accede a recursos de otros o a la Biblioteca. |
| Ver asignación publicada | Asignación muestra título, tipo, fecha y estado correcto. | Captura de la tarjeta de asignación con todos los campos. | Asignación en blanco o datos incorrectos desorientan al estudiante. |
| Abrir material | Material se abre con URL temporal segura sin errores de CORS o permisos. | Grabación de la apertura del archivo (PDF/video) desde la URL temporal. | 403 o link roto: estudiante no puede consumir el material. |
| Confirmar acceso temporal seguro | La URL temporal expira dentro del tiempo configurado (máx. 1 hora). | Captura del request con timestamp + captura post-expiración mostrando error esperado. | URL permanente filtrada: riesgo de acceso no autorizado a Drive. |
| Simular error de token revocado | UI muestra "Conexión de Drive expirada" con botón "Reconectar Google Drive". | Captura del mensaje de error con copy correcto. | Error genérico 500 o pantalla en blanco: usuario no sabe qué hacer. |
| Simular error de permisos insuficientes | UI muestra "Permisos insuficientes en Drive" con botón "Verificar Permisos en Drive". | Captura del mensaje de error con copy correcto. | Error genérico: usuario no identifica si el problema es de su cuenta o del sistema. |
| Simular carpeta inaccesible | UI muestra "Carpeta inaccesible" con botón "Verificar carpeta". | Captura del mensaje de error con copy correcto. | Error silencioso: la carpeta desaparece sin aviso y Biblioteca queda en estado indeterminado. |
