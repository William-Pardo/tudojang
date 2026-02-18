
// servicios/baseConocimiento.ts
export const MANUAL_TUDOJANG = `
# MANUAL MAESTRO TUDOJANG (SaaS Taekwondo)

## ROLES Y ACCESO
- ADMIN: Acceso total (Finanzas, Configuración, Equipo, Licencia).
- EDITOR: Gestión de Estudiantes, Tienda, Eventos y Alertas.
- ASISTENTE: Registro de asistencias y consulta de estudiantes en sede.
- TUTOR (SABONIM): Registro de su propia asistencia, visualización de sus talones de pago y escaneo de alumnos.
- SUPERADMIN: Acceso a Consola Aliant (Master Dashboard) para gestión multi-tenant.

## GESTIÓN DE ESTUDIANTES
- REGISTRO: Requiere Nombres, ID y Fecha Nacimiento.
- GRUPOS (Auto): Infantil (3-6 años), Precadetes (7-12), Cadetes (13+).
- DOCUMENTACIÓN: Cada alumno tiene 3 documentos legales: Consentimiento de Riesgos, Contrato de Servicios y Autorización de Imagen.
- FIRMA DIGITAL: El sistema genera un link único que se envía por WhatsApp al tutor para que firme desde su celular.
- IMPORTACIÓN MASIVA: Permite cargar estudiantes desde archivos CSV/Excel con validación automática de datos.

## TESORERÍA Y FINANZAS
- MOVIMIENTOS: Se registran Ingresos y Egresos.
- CATEGORÍAS: Mensualidad, Implementos, Eventos, Arriendo, Servicios, Nómina, Otros.
- CARTERA: El saldo deudor de un alumno aumenta automáticamente cuando se le asigna una compra en la Tienda o una inscripción en Eventos.
- REPORTES: El "Informe Visual Ejecutivo" muestra el Margen Operativo y Balance en tiempo real.
- ESTADOS DE PAGO: Pendiente, Parcial, Pagado con badges visuales para fácil identificación.

## ASISTENCIA Y SALIDA (CLASE EN VIVO)
- ENTRADA: Se registra escaneando el código QR del carnet del alumno desde el móvil del profesor o asistente.
- ESTADO "LISTO": Al terminar la clase, se marca al alumno como "Listo". Esto envía un mensaje automático al WhatsApp del padre.
- ENTREGA: Se debe verificar la "Persona Autorizada" antes de marcar como "Entregado".
- ESCÁNER QR: Componente dedicado para lectura de códigos QR de asistencia en tiempo real.

## TIENDA Y EVENTOS
- TIENDA: Los padres pueden solicitar compras en la página pública. El Admin debe aprobarlas en el Dashboard para que el cobro se cargue al saldo del alumno.
- EVENTOS: Funcionan igual que la tienda. Al aprobar una inscripción, el valor del evento se suma a la deuda del estudiante.
- TIENDA PÚBLICA: Página accesible sin autenticación donde los tutores pueden ver implementos disponibles y solicitar compras.
- COMPARTIR: Funcionalidad para compartir eventos y productos de la tienda por WhatsApp y redes sociales.

## CARNETIZACIÓN Y CERTIFICADOS
- CARNETS: Formato PVC 85.6x54mm con QR único de asistencia. Se generan por lotes en la pestaña "Carnetización".
- CERTIFICADOS: Generan PDF de intensidad horaria (Individual o Grupal) basados en los registros de asistencia del sistema.
- GENERADOR QR: Componente dedicado para generar códigos QR de carnetización.

## HORARIOS
- GESTIÓN DE HORARIOS: Permite crear y administrar los horarios de clases del Dojang.
- ASIGNACIÓN: Relaciona horarios con instructores y sedes.
- VISUALIZACIÓN: Vista calendario y lista de todos los horarios programados.

## GESTIÓN DE CLASE
- CLASE EN VIVO: Interfaz para gestionar la clase activa con control de asistencia en tiempo real.
- ESTADOS: Control de entrada, salida, y estado "listo" para cada alumno durante la clase.
- ESTADÍSTICAS: Resumen de asistencia por clase con métricas en tiempo real.

## MISIÓN KICHO (GAMIFICACIÓN)
- SISTEMA DE RETOS: Programa de gamificación para motivar a los estudiantes.
- PUNTOS Y RECOMPENSAS: Sistema de puntuación por logros y asistencia.
- RANKING: Tabla de posiciones para fomentar la competencia sana.
- BADGES: Insignias digitales por logros alcanzados.

## CERTIFICACIONES
- GENERACIÓN DE CERTIFICADOS: Creación de certificados personalizados en PDF.
- INTENSIDAD HORARIA: Cálculo automático de horas de entrenamiento.
- FIRMAS: Inclusión de firmas digitales en los certificados.

## CENSO PÚBLICO
- FORMULARIO PÚBLICO: Página para que nuevos interesados registren sus datos.
- INTEGRACIÓN: Los datos del censo se integran con el sistema de estudiantes.
- LINKS ÚNICOS: Cada censo tiene un identificador único para seguimiento.

## PERFIL DEL TUTOR
- VISTA TUTOR: Interfaz dedicada para que los tutores vean información de sus hijos.
- TALONES DE PAGO: Visualización de historial de pagos y deudas.
- ASISTENCIAS: Consulta del historial de asistencia de sus hijos.

## PASARELA DE INSCRIPCIÓN
- REGISTRO NUEVO: Flujo de inscripción para nuevos clubes/escuelas.
- SELECCIÓN DE PLAN: Elección entre planes Starter, Growth y Pro.
- PAGO INICIAL: Integración con pasarela de pagos para el primer pago.

## PASARELA DE PAGOS
- INTEGRACIÓN WOMPI: Pasarela de pagos con Wompi para Colombia.
- TARJETAS Y PSE: Acepta tarjetas crédito/débito y PSE.
- WEBHOOKS: Confirmación automática de pagos mediante webhooks.
- FIRMAS DE INTEGRIDAD: Validación segura de transacciones.

## LANDING PÚBLICA
- PÁGINA DE INICIO: Landing page comercial para atraer nuevos clientes.
- INFORMACIÓN DE PLANES: Detalles de planes y precios.
- REGISTRO: Call-to-action para registro de nuevas escuelas.

## REGISTRO DE ESCUELA
- ONBOARDING: Wizard de 5 pasos para configurar una nueva escuela.
- DATOS DEL CLUB: Nombre, dirección, contacto, redes sociales.
- CONFIGURACIÓN INICIAL: Branding, métodos de pago, sedes.
- EQUIPO: Invitación a instructores y personal.

## SALIDA PÚBLICA
- PÁGINA DE SALIDA: Interfaz para que los padres marquen la salida de alumnos.
- VERIFICACIÓN: Control de persona autorizada para recoger al alumno.
- NOTIFICACIONES: Alertas automáticas al marcar salida.

## AYUDA PQRS
- SISTEMA DE SOPORTE: Formulario para peticiones, quejas, reclamos y sugerencias.
- SEGUIMIENTO: Tracking de tickets de soporte.
- RESPUESTAS: Sistema de respuestas desde el panel administrativo.

## ASISTENTE VIRTUAL (SABONIM AI)
- CHAT INTELIGENTE: Asistente virtual basado en IA para resolver dudas.
- CONTEXTO: Conoce el manual y puede responder preguntas sobre el sistema.
- AYUDA EN TIEMPO REAL: Disponible en todas las páginas para asistencia inmediata.

## BÚSQUEDA GLOBAL
- MODAL DE BÚSQUEDA: Búsqueda rápida accesible con atajo de teclado.
- RESULTADOS MULTI-TIPO: Busca en estudiantes, eventos, tienda y más.
- NAVEGACIÓN RÁPIDA: Acceso directo a cualquier entidad desde la búsqueda.

## NOTIFICACIONES PUSH
- CONFIGURACIÓN: Gestión de notificaciones push para dispositivos.
- RECORDATORIOS: Alertas automáticas de pagos, eventos y más.
- PERMISOS: Sistema de solicitud y gestión de permisos de notificación.

## ANALYTICS Y HEATMAP
- TRACKING: Seguimiento de interacciones del usuario en la aplicación.
- HEATMAP: Mapa de calor para visualizar áreas de mayor actividad.
- MÉTRICAS: Datos de uso para optimización de la experiencia.

## AUTOGUARDADO
- GUARDADO AUTOMÁTICO: Los formularios se guardan automáticamente.
- PREVENCIÓN DE PÉRDIDA: Sistema para evitar pérdida de datos no guardados.
- INDICADOR: Visualización del estado de guardado en tiempo real.

## BRANDING DINÁMICO
- PERSONALIZACIÓN: Cada tenant puede personalizar colores y logo.
- COLORES: Fondo, primario, acento configurables.
- LOGO: Carga y visualización del logo del club.
- MODO OSCURO: Soporte para tema claro y oscuro.

## CONFIGURACIÓN SAAS
- BRANDING: Se pueden cambiar colores (Fondo, Primario, Acento) y subir el Logo del Club.
- PAGOS: El Dojang configura sus números de Nequi, Daviplata o BRE-B para recaudo.
- LICENCIA: Planes Starter (50 alumnos), Growth (150) y Pro (350). Límites estrictos según plan.
- SEDES: Gestión de múltiples sedes con límites según plan.
- EQUIPO: Administración de usuarios del sistema con roles y permisos.

## CONSOLA ALIANT (MASTER DASHBOARD)
- MULTI-TENANT: Panel de control para gestionar todos los tenants.
- MÉTRICAS GLOBALES: Estadísticas de uso, ingresos, usuarios activos.
- GESTIÓN DE LICENCIAS: Control de estados de suscripción.
- SOPORTE CENTRALIZADO: Acceso a datos de todos los clubes para soporte.

## RENOVACIÓN DE LICENCIA
- ESTADO DE LICENCIA: Indicador visual del estado de la suscripción.
- MODO DEMO: Funcionalidad limitada cuando la licencia está vencida.
- RENOVACIÓN: Flujo de pago para reactivar la licencia.

## FIRMAS DIGITALES
- CONSENTIMIENTO DE RIESGOS: Documento legal firmado digitalmente.
- CONTRATO DE SERVICIOS: Contrato entre el club y el tutor.
- AUTORIZACIÓN DE IMAGEN: Permiso para uso de imágenes del alumno.
- LINKS ÚNICOS: Cada documento tiene un link único para firma.
- VERIFICACIÓN: Sistema de verificación de firmas realizadas.
`.trim();
