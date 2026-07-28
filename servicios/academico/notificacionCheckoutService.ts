import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { RegistroAsistencia } from '../../models/academico/asistencia';
import type { Estudiante, Sede } from '../../tipos';
import { enviarNotificacion, guardarNotificacionEnHistorial } from '../notificacionesApi';
import { TipoNotificacion } from '../../tipos';

/**
 * WS-3b (§8): notificación a padres/acudientes cuando un estudiante termina la clase.
 * Mensaje: "El estudiante terminó la clase. Ya puede ser recogido."
 * Incluye: hora de salida, sede, nombre de la clase.
 *
 * Reglas:
 * - No enviar si no existe acudiente registrado
 * - No enviar duplicados (registrar estado)
 * - Si falla, guardar error para reintento
 * - Reutilizar integración existente de WhatsApp/Email
 */

export interface ConfigNotificacionCheckout {
  estudianteId: string;
  estudianteNombre: string;
  jornadaId: string;
  sedeName?: string;
  claseTema?: string;
  horaSalida: string;
  canalPreferido?: 'WhatsApp' | 'Email';
}

export interface ResultadoNotificacion {
  exitoso: boolean;
  mensaje: string;
  error?: string;
  timestamp: string;
}

/**
 * Construye el mensaje de checkout para padres/acudientes.
 */
export function construirMensajeCheckout(config: ConfigNotificacionCheckout): string {
  const { estudianteNombre, sedeName, claseTema, horaSalida } = config;

  const partes: string[] = [
    `¡Notificación importante!`,
    ``,
    `El estudiante ${estudianteNombre} terminó su clase y ya puede ser recogido.`,
    ``,
    `📍 Información:`,
    `  • Hora de salida: ${horaSalida}`,
  ];

  if (sedeName) {
    partes.push(`  • Sede: ${sedeName}`);
  }

  if (claseTema) {
    partes.push(`  • Clase: ${claseTema}`);
  }

  partes.push(``, `Recuerda estar atento para la recogida puntual.`);
  partes.push(``, `— Sistema de Control Clase en Vivo`);

  return partes.join('\n');
}

/**
 * Intenta enviar notificación de checkout a un contacto.
 * En producción, esto obtendría tutores desde la base de datos.
 *
 * Por ahora, acepta un contacto manual (teléfono o email) para testing.
 * TODO: integrar con tutorStudentResolver.ts para obtener tutores reales.
 */
export async function enviarNotificacionCheckout(
  config: ConfigNotificacionCheckout,
  contactoAcudiente: {
    nombre: string;
    whatsapp?: string;
    email?: string;
  }
): Promise<ResultadoNotificacion> {
  const timestamp = new Date().toISOString();

  try {
    // Validar que existe al menos un contacto.
    if (!contactoAcudiente.whatsapp && !contactoAcudiente.email) {
      return {
        exitoso: false,
        mensaje: 'No se encontraron contactos de acudientes',
        error: 'Sin WhatsApp ni Email registrado',
        timestamp,
      };
    }

    const mensaje = construirMensajeCheckout(config);

    // Intentar enviar por canal preferido (o WhatsApp por defecto).
    const canal = config.canalPreferido ?? (contactoAcudiente.whatsapp ? 'WhatsApp' : 'Email');
    const destinatario = canal === 'WhatsApp' ? contactoAcudiente.whatsapp : contactoAcudiente.email;

    if (!destinatario) {
      return {
        exitoso: false,
        mensaje: `Canal ${canal} no disponible para este acudiente`,
        error: `${canal} no configurado`,
        timestamp,
      };
    }

    // Enviar notificación.
    await enviarNotificacion(canal, destinatario, mensaje);

    // Guardar en historial.
    await guardarNotificacionEnHistorial({
      fecha: timestamp,
      estudianteId: config.estudianteId,
      estudianteNombre: config.estudianteNombre,
      tutorNombre: contactoAcudiente.nombre,
      destinatario,
      canal,
      tipo: TipoNotificacion.AvanceAcademico,
      mensaje,
      leida: false,
    });

    return {
      exitoso: true,
      mensaje: `Notificación enviada a ${contactoAcudiente.nombre} por ${canal}`,
      timestamp,
    };
  } catch (error) {
    console.error('Error al enviar notificación de checkout:', error);
    return {
      exitoso: false,
      mensaje: 'Error al enviar la notificación',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp,
    };
  }
}

/**
 * Construye un resumen de la clase para incluir en documentos/recibos.
 */
export function construirResumenClaseEnVivo(
  jornada: JornadaInstruccion,
  asistencias: RegistroAsistencia[],
  sedeName?: string
): string {
  const presentes = asistencias.filter((a) => !a.isLate).length;
  const tarde = asistencias.filter((a) => a.isLate).length;
  const completados = asistencias.filter((a) => a.horaSalida).length;

  return `Resumen Clase en Vivo
${jornada.tema ? `Tema: ${jornada.tema}` : ''}
Fecha: ${jornada.fecha}
Hora: ${jornada.horaInicio} - ${jornada.horaFin}
${sedeName ? `Sede: ${sedeName}` : ''}

Asistencia:
- Presentes: ${presentes}
- Tarde: ${tarde}
- Completados: ${completados}

Estado: ${jornada.estado}`;
}
