
// servicios/baseConocimiento.ts
export const MANUAL_TUDOJANG = `
# MANUAL MAESTRO TUDOJANG (SaaS Taekwondo)

## ROLES Y ACCESO
- ADMIN: Acceso total (Finanzas, Configuración, Equipo, Licencia).
- EDITOR: Gestión de Estudiantes, Tienda, Eventos y Alertas.
- ASISTENTE: Registro de asistencias y consulta de estudiantes en sede.
- TUTOR (SABONIM): Registro de su propia asistencia, visualización de sus talones de pago y escaneo de alumnos.

## GESTIÓN DE ESTUDIANTES
- REGISTRO: Requiere Nombres, ID y Fecha Nacimiento.
- GRUPOS (Auto): Infantil (3-6 años), Precadetes (7-12), Cadetes (13+).
- DOCUMENTACIÓN: Cada alumno tiene 3 documentos legales: Consentimiento de Riesgos, Contrato de Servicios y Autorización de Imagen.
- FIRMA DIGITAL: El sistema genera un link único que se envía por WhatsApp al tutor para que firme desde su celular.

## TESORERÍA Y FINANZAS
- MOVIMIENTOS: Se registran Ingresos y Egresos.
- CATEGORÍAS: Mensualidad, Implementos, Eventos, Arriendo, Servicios, Nómina, Otros.
- CARTERA: El saldo deudor de un alumno aumenta automáticamente cuando se le asigna una compra en la Tienda o una inscripción en Eventos.
- REPORTES: El "Informe Visual Ejecutivo" muestra el Margen Operativo y Balance en tiempo real.

## ASISTENCIA Y SALIDA (CLASE EN VIVO)
- ENTRADA: Se registra escaneando el código QR del carnet del alumno desde el móvil del profesor o asistente.
- ESTADO "LISTO": Al terminar la clase, se marca al alumno como "Listo". Esto envía un mensaje automático al WhatsApp del padre.
- ENTREGA: Se debe verificar la "Persona Autorizada" antes de marcar como "Entregado".

## TIENDA Y EVENTOS
- TIENDA: Los padres pueden solicitar compras en la página pública. El Admin debe aprobarlas en el Dashboard para que el cobro se cargue al saldo del alumno.
- EVENTOS: Funcionan igual que la tienda. Al aprobar una inscripción, el valor del evento se suma a la deuda del estudiante.

## CARNETIZACIÓN Y CERTIFICADOS
- CARNETS: Formato PVC 85.6x54mm con QR único de asistencia. Se generan por lotes en la pestaña "Carnetización".
- CERTIFICADOS: Generan PDF de intensidad horaria (Individual o Grupal) basados en los registros de asistencia del sistema.

## CONFIGURACIÓN SAAS
- BRANDING: Se pueden cambiar colores (Fondo, Primario, Acento) y subir el Logo del Club.
- PAGOS: El Dojang configura sus números de Nequi, Daviplata o BRE-B para recaudo.
- LICENCIA: Planes Starter (50 alumnos), Growth (150) y Pro (350). Límites estrictos según plan.
`.trim();
