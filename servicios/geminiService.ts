
// servicios/geminiService.ts
import { TipoNotificacion, type Estudiante, type ConfiguracionClub, type Programa } from "../tipos";
import { PLANTILLAS_NOTIFICACIONES } from "../constantes";
import { formatearPrecio, generarUrlAbsoluta } from "../utils/formatters";
import { calcularTotalMensualidadEstudiante, calcularTarifaBaseEstudiante, calcularSumaProgramasRecurrentes } from "../utils/calculations";

export const generarMensajePersonalizado = async (
  tipo: TipoNotificacion,
  estudiante: Estudiante,
  configClub: ConfiguracionClub,
  datosAdicionales?: {
    monto?: number;
    concepto?: string;
    links?: { nombre: string; url: string }[];
    programas?: Programa[];
    sedes?: any[];
  }
): Promise<string> => {

  const nombreEstudiante = `${estudiante.nombres} ${estudiante.apellidos}`;
  const nombreTutor = estudiante.tutor ? `${estudiante.tutor.nombres}` : 'Padre/Tutor';

  // Cálculo inteligente del monto para recordatorios
  let montoFormateado = datosAdicionales?.monto ? formatearPrecio(datosAdicionales.monto) : '$0';
  let desglose = "";

  if (tipo === TipoNotificacion.RecordatorioPago && datosAdicionales?.programas && datosAdicionales?.sedes) {
    const total = calcularTotalMensualidadEstudiante(estudiante, configClub, datosAdicionales.sedes, datosAdicionales.programas);
    const base = calcularTarifaBaseEstudiante(estudiante, configClub, datosAdicionales.sedes);
    const extras = calcularSumaProgramasRecurrentes(estudiante, datosAdicionales.programas);

    montoFormateado = formatearPrecio(total);
    if (extras > 0) {
      desglose = ` (Membresía: ${formatearPrecio(base)} + Programas: ${formatearPrecio(extras)})`;
    }
  }

  const concepto = (datosAdicionales?.concepto || 'la mensualidad') + desglose;

  const medios = [];
  if (configClub.pagoNequi) medios.push(`Nequi (${configClub.pagoNequi})`);
  if (configClub.pagoBanco) medios.push(configClub.pagoBanco);
  const mediosPago = medios.join(", ");

  let plantillas: string[] = [];

  switch (tipo) {
    case TipoNotificacion.Bienvenida: plantillas = PLANTILLAS_NOTIFICACIONES.BIENVENIDA; break;
    case TipoNotificacion.RecordatorioPago: plantillas = PLANTILLAS_NOTIFICACIONES.RECORDATORIO_PAGO; break;
    case TipoNotificacion.AvisoVencimiento: plantillas = PLANTILLAS_NOTIFICACIONES.AVISO_VENCIMIENTO; break;
    case TipoNotificacion.ConfirmacionCompra: plantillas = PLANTILLAS_NOTIFICACIONES.CONFIRMACION_COMPRA; break;
    default: return `Novedad de ${nombreEstudiante} en ${configClub.nombreClub}.`;
  }

  const index = Math.floor(Math.random() * plantillas.length);
  let msj = plantillas[index]
    .replace(/{{ESTUDIANTE}}/g, nombreEstudiante)
    .replace(/{{TUTOR}}/g, nombreTutor)
    .replace(/{{MONTO}}/g, montoFormateado)
    .replace(/{{CONCEPTO}}/g, concepto)
    .replace(/{{CLUB}}/g, configClub.nombreClub)
    .replace(/{{MEDIOS_PAGO}}/g, mediosPago);

  // Agregar link de reporte si es un cobro
  if (tipo === TipoNotificacion.RecordatorioPago || tipo === TipoNotificacion.AvisoVencimiento) {
    const linkReporte = generarUrlAbsoluta(`/reportar-pago?id=${estudiante.numeroIdentificacion}`);
    msj += `\n\n✅ Reporta tu pago aquí: ${linkReporte}`;
  }

  return msj;
};
