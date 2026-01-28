
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
- INSCRIPCIÓN PREMIUM: Proceso de 4 pasos para nuevos alumnos:
  1. Pago: El alumno paga inscripción + primer mes y sube soporte.
  2. Verificación: El Admin valida el pago (Efectivo o Digital).
  3. Datos: Se desbloquea el formulario de captura técnico.
  4. Legalización: El sistema dispara automáticamente los 3 contratos por WhatsApp.

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
- TIENDA (Gestión): El Admin puede crear, editar precios y eliminar implementos desde el Panel de Administración. Cada artículo puede tener variaciones (ej: tallas) con precios independientes.
- COMPRAS: Los padres solicitan compras. El Admin aprueba para cargar al saldo del alumno.
- EVENTOS: Funcionan igual que la tienda. Al aprobar una inscripción, el valor se suma a la deuda del estudiante.

## RECARGOS POR MORA (PENALIDADES)
- CONFIGURACIÓN: El Tenant define si cobra mora fija o porcentual (ej: 5% del valor de la clase).
- DÍAS DE GRACIA: Periodo de espera configurado antes de aplicar el recargo automático.
- PERSONALIZACIÓN: Las penalidades pueden ser generales para toda la academia o específicas para ciertos programas o sedes.
- AUTOMATIZACIÓN: El sistema aplica el recargo automáticamente al detectar pagos vencidos fuera del periodo de gracia.

## CARNETIZACIÓN Y CERTIFICADOS
- CARNETS: Formato PVC 85.6x54mm con QR único de asistencia. Se generan por lotes en la pestaña "Carnetización".
- CERTIFICADOS: Generan PDF de intensidad horaria (Individual o Grupal) basados en los registros de asistencia del sistema.

## CONFIGURACIÓN SAAS
- BRANDING: Se pueden cambiar colores (Fondo, Primario, Acento) y subir el Logo del Club.
- PAGOS: El Dojang configura sus números de Nequi, Daviplata o BRE-B para recaudo.
- LICENCIA: Planes Starter (50 alumnos), Growth (150) y Pro (350). Límites estrictos según plan.
`.trim();
