
// servicios/baseConocimiento.ts
export const MANUAL_TUDOJANG = `
# MANUAL MAESTRO TUDOJANG (SaaS Taekwondo) - Versión 4.5

## ROLES Y ACCESO
- ADMIN: Acceso total (Finanzas, Configuración, Equipo, Licencia).
- EDITOR: Gestión de Estudiantes, Tienda, Eventos y Alertas.
- ASISTENTE: Registro de asistencias y consulta de estudiantes en sede.
- TUTOR (SABONIM): Registro de su propia asistencia y escaneo de alumnos.
- SUPERADMIN: Gestión de todos los clubes desde el Master Dashboard de Aliant.

## PERFIL DEL TUTOR (FAMILIA)
- PÁGINA DEL TUTOR: Vista exclusiva para padres donde ven el progreso de sus hijos.
- TALONES DE PAGO: Consulta de recibos y deudas pendientes.
- ASISTENCIA: Historial de clases asistidas.
- FIRMAS LEGALES: Espacio para firmar Contrato, Consentimiento y Autorización de Imagen.

## GESTIÓN DE ESTUDIANTES
- FICHA TÉCNICA: Centraliza datos médicos (EPS, RH, Lesiones), contacto y acudientes.
- GRUPOS POR EDAD: Infantil (3-6), Precadetes (7-12), Cadetes (13) y Adultos.
- DOCUMENTACIÓN: 3 documentos base: Consentimiento de Riesgo, Contrato de Servicio y Autorización de Imagen.
- FIRMA DIGITAL: Link único enviado por WhatsApp para firma táctil en el celular del tutor.

## MISIÓN KICHO (PROTOCOLO DE CENSO)
- CARGA MASIVA: Protocolo técnico para registrar muchos alumnos en poco tiempo.
- CÓDIGO QR / LINK: Genera un acceso público de 72 horas para que los padres llenen los datos.
- VALIDACIÓN: El Admin revisa los registros capturados en la "Cola de Aspirantes".
- LEGALIZACIÓN: El Director firma el lote y los datos se "inyectan" automáticamente a la base oficial.

## CLASE EN VIVO (MONITOR DE SEGURIDAD)
- REGISTRO DE ENTRADA: Escaneo de carnet (QR) desde el móvil del profesor.
- NOTIFICACIÓN DE SALIDA: El botón "Marcar Listo" envía un WhatsApp automático al padre informando que la clase terminó junto con una frase motivacional.
- PROTOCOLO DE ENTREGA: Antes de entregar al alumno, el sistema muestra la lista de "Personas Autorizadas" para validar identidad.
- LEGALIZACIÓN DE SALIDA: Registra quién recogió al alumno y la hora exacta del egreso.

## TESORERÍA Y CAJA REGISTRADORA
- MOVIMIENTOS: Registro de Ingresos y Egresos con categorías (Arriendo, Servicios, Nómina).
- PAGOS EN EFECTIVO: Módulo de "Caja" para recibir dinero manual por mensualidades, tienda o eventos.
- CARTERA: Control de deudas en tiempo real. El saldo deudor se actualiza según aprobaciones en tienda y eventos.
- ANALÍTICA: Informe Visual Ejecutivo con flujo de caja y rentabilidad.

## TIENDA Y EVENTOS
- TIENDA PÚBLICA: Catálogo de uniformes e implementos accesible para los padres.
- INSCRIPCIÓN A EVENTOS: Landing pública para torneos o seminarios del club.
- APROBACIÓN: Todas las solicitudes deben ser aprobadas por el Admin para cargar la deuda al estudiante.

## CARNETIZACIÓN PROFESIONAL
- PRODUCCIÓN TÉCNICA: Genera PDFs a 300 DPI listos para imprenta.
- REGLA DE LEGIBILIDAD: El sistema cambia el fondo del carnet según la marca del club (vía luminancia) para asegurar que los datos sean legibles.
- FORMATOS: Soporta Carta, Oficio y formato individual CR80 (PVC).
- MARCAS DE CORTE: Incluye guías para guillotina automática.

## EXTENSIÓN ALIANT WHATSAPP
- ENVÍOS MASIVOS: Herramienta para enviar recibos de pago y notificaciones masivas.
- GENERACIÓN DE PNG: Crea imágenes de recibos personalizados con el logo del club para facilitar el envío.

## LABORATORIO DE PRUEBAS (SIMULADORES)
- STRESS TEST KICHO: Inyecta 15 aspirantes ficticios (adultos/niños) para probar el flujo de censo.
- SIMULADOR DE CLASE: Inyecta 5 asistencias reales para probar el monitor de salida y notificaciones de WhatsApp.

## CONFIGURACIÓN DEL CLUB (SAAS)
- BRANDING DINÁMICO: Cambio de Logo y colores (Primario, Secundario, Acento) que afecta a toda la app.
- LÍMITES DE LICENCIA: Control estricto de estudiantes, sedes y usuarios según el Plan (Starter, Growth, Pro).
- SEDES: Gestión multi-sede con monitoreo independiente de clases.
`.trim();
