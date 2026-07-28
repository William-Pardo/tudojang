import type { JornadaInstruccion } from '../../models/academico/jornada';
import { minutosRestantesDeVentana } from './ventanaClaseEnVivoService';

/**
 * WS-9 (§14): estados formales de Clase en Vivo -- mapeo de EstadoJornada
 * a estados visuales del módulo operacional. Independiente del ciclo de vida
 * académico (borrador/confirmada/en_curso/cerrada), este servicio determina
 * cómo debe verse la clase EN VIVO para el usuario.
 *
 * Estados visuales:
 * - `scheduled`: existe pero aún no está en ventana permitida
 * - `available`: dentro de la ventana, listo para operar
 * - `in_progress`: ya se registraron operaciones (asistencias/checkpoints)
 * - `closed`: cerrada correctamente
 * - `expired`: pasó la ventana sin cierre formal
 * - `cancelled`: fue cancelada desde la fuente
 */
export type EstadoClaseEnVivo = 'scheduled' | 'available' | 'in_progress' | 'closed' | 'expired' | 'cancelled';

export interface InfoEstadoClaseEnVivo {
  estado: EstadoClaseEnVivo;
  etiqueta: string;
  colorBg: string;
  colorTexto: string;
  colorBorde: string;
  descripcion: string;
}

export function determinarEstadoClaseEnVivo(
  jornada: JornadaInstruccion,
  ahora: string,
  tieneOperaciones: boolean
): EstadoClaseEnVivo {
  // Cancelada toma precedencia.
  if (jornada.estado === 'cancelada') {
    return 'cancelled';
  }

  // Cerrada.
  if (jornada.estado === 'cerrada') {
    return 'closed';
  }

  // Determinar si está dentro de la ventana permitida.
  const minutosRestantes = minutosRestantesDeVentana(jornada, ahora);
  const dentroDeLaVentana = minutosRestantes > 0;

  // Si pasó la ventana y la jornada aún no se cerró: expirada.
  if (!dentroDeLaVentana && (jornada.estado === 'en_curso' || jornada.estado === 'pendiente_cierre')) {
    return 'expired';
  }

  // Dentro de la ventana.
  if (dentroDeLaVentana) {
    // Si ya se registraron operaciones: in_progress.
    if (tieneOperaciones) {
      return 'in_progress';
    }
    // Dentro de la ventana pero sin operaciones: available.
    return 'available';
  }

  // Fuera de la ventana, no cerrada y sin operaciones: scheduled (aún no llegó).
  return 'scheduled';
}

export function obtenerInfoEstadoClaseEnVivo(estado: EstadoClaseEnVivo): InfoEstadoClaseEnVivo {
  const info: Record<EstadoClaseEnVivo, InfoEstadoClaseEnVivo> = {
    scheduled: {
      estado: 'scheduled',
      etiqueta: 'Próximamente',
      colorBg: 'bg-slate-500/20',
      colorTexto: 'text-slate-400',
      colorBorde: 'border-slate-400',
      descripcion: 'La clase aún no está dentro de la ventana permitida',
    },
    available: {
      estado: 'available',
      etiqueta: 'Disponible ahora',
      colorBg: 'bg-emerald-500/20',
      colorTexto: 'text-emerald-400',
      colorBorde: 'border-emerald-400',
      descripcion: 'La clase está dentro de la ventana permitida',
    },
    in_progress: {
      estado: 'in_progress',
      etiqueta: 'En progreso',
      colorBg: 'bg-sky-500/20',
      colorTexto: 'text-sky-400',
      colorBorde: 'border-sky-400',
      descripcion: 'Se han registrado operaciones en esta clase',
    },
    closed: {
      estado: 'closed',
      etiqueta: 'Cerrada',
      colorBg: 'bg-slate-500/20',
      colorTexto: 'text-slate-400',
      colorBorde: 'border-slate-400',
      descripcion: 'La clase fue cerrada correctamente',
    },
    expired: {
      estado: 'expired',
      etiqueta: 'Ventana expirada',
      colorBg: 'bg-rose-500/20',
      colorTexto: 'text-rose-400',
      colorBorde: 'border-rose-400',
      descripcion: 'La ventana permitida ha pasado sin cierre formal',
    },
    cancelled: {
      estado: 'cancelled',
      etiqueta: 'Cancelada',
      colorBg: 'bg-rose-500/20',
      colorTexto: 'text-rose-400',
      colorBorde: 'border-rose-400',
      descripcion: 'La clase fue cancelada',
    },
  };

  return info[estado];
}
