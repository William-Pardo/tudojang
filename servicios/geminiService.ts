
// servicios/geminiService.ts
import { TipoNotificacion, type Estudiante, type ConfiguracionClub } from "../tipos";
import { PLANTILLAS_NOTIFICACIONES } from "../constantes";
import { formatearPrecio } from "../utils/formatters";

/**
 * Genera un mensaje personalizado. 
 * Utiliza plantillas locales con inyección de variables dinámicas del Dojang.
 */
export const generarMensajePersonalizado = async (
  tipo: TipoNotificacion,
  estudiante: Estudiante,
  configClub: ConfiguracionClub, // Añadido para obtener nombre y medios de pago
  datosAdicionales?: { 
    monto?: number; 
    concepto?: string; 
    links?: { nombre: string; url: string }[] 
  }
): Promise<string> => {
  
  const nombreEstudiante = `${estudiante.nombres} ${estudiante.apellidos}`;
  const nombreTutor = estudiante.tutor ? `${estudiante.tutor.nombres}` : 'Padre/Tutor';
  const montoFormateado = datosAdicionales?.monto ? formatearPrecio(datosAdicionales.monto) : '$0';
  const concepto = datosAdicionales?.concepto || 'la mensualidad';
  
  // Construcción dinámica de medios de pago desde la configuración del club
  const medios = [];
  if (configClub.pagoNequi) medios.push(`Nequi (${configClub.pagoNequi})`);
  if (configClub.pagoDaviplata) medios.push(`Daviplata (${configClub.pagoDaviplata})`);
  if (configClub.pagoBanco) medios.push(configClub.pagoBanco);
  const mediosPago = medios.length > 0 ? medios.join(", ") : "Transferencia directa";

  let plantillas: string[] = [];

  switch (tipo) {
    case TipoNotificacion.Bienvenida:
      plantillas = PLANTILLAS_NOTIFICACIONES.BIENVENIDA;
      break;
    case TipoNotificacion.RecordatorioPago:
    case TipoNotificacion.TalonPagoDisponible:
      plantillas = PLANTILLAS_NOTIFICACIONES.RECORDATORIO_PAGO;
      break;
    case TipoNotificacion.AvisoVencimiento:
      plantillas = PLANTILLAS_NOTIFICACIONES.AVISO_VENCIMIENTO;
      break;
    case TipoNotificacion.ConfirmacionCompra:
      plantillas = PLANTILLAS_NOTIFICACIONES.CONFIRMACION_COMPRA;
      break;
    case TipoNotificacion.ConfirmacionInscripcionEvento:
      plantillas = PLANTILLAS_NOTIFICACIONES.INSCRIPCION_EVENTO;
      break;
    default:
      return `Hola ${nombreTutor}, le informamos sobre una novedad de ${nombreEstudiante} en ${configClub.nombreClub}.`;
  }

  const indiceAleatorio = Math.floor(Math.random() * plantillas.length);
  let mensaje = plantillas[indiceAleatorio];

  // Procesar todas las etiquetas de híper-personalización
  mensaje = mensaje
    .replace(/{{ESTUDIANTE}}/g, nombreEstudiante)
    .replace(/{{TUTOR}}/g, nombreTutor)
    .replace(/{{MONTO}}/g, montoFormateado)
    .replace(/{{CONCEPTO}}/g, concepto)
    .replace(/{{CLUB}}/g, configClub.nombreClub) // Inyección del nombre de la academia
    .replace(/{{MEDIOS_PAGO}}/g, mediosPago);

  // Inyectar enlaces si es Bienvenida
  if (tipo === TipoNotificacion.Bienvenida && datosAdicionales?.links && datosAdicionales.links.length > 0) {
    mensaje += "\n\nPor favor, firme los documentos pendientes para completar el registro:";
    datosAdicionales.links.forEach(link => {
      mensaje += `\n- ${link.nombre}: ${link.url}`;
    });
  }

  return mensaje;
};
