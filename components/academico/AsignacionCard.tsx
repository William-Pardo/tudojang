import React from 'react';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import { IconoAgenda, IconoCertificado } from '../Iconos';

export type EstadoVisualAsignacion = 'disponible' | 'iniciado' | 'completado';

const estadoVisual: Record<EstadoVisualAsignacion, { etiqueta: string; progreso: number; clase: string }> = {
  disponible: { etiqueta: 'Disponible', progreso: 0, clase: 'bg-blue-50 text-tkd-blue border-blue-100' },
  iniciado: { etiqueta: 'Iniciado', progreso: 35, clase: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  completado: { etiqueta: 'Completado', progreso: 100, clase: 'bg-green-50 text-green-700 border-green-100' },
};

export function obtenerEstadoVisualAsignacion(indice: number): EstadoVisualAsignacion {
  const estados: EstadoVisualAsignacion[] = ['disponible', 'iniciado', 'completado'];
  return estados[indice % estados.length];
}

function mapearEstadoVisual(asignacion: AsignacionCentroEstudios): EstadoVisualAsignacion {
  if (asignacion.estadoProgreso === 'completado' || asignacion.estadoProgreso === 'aprobado') return 'completado';
  if (asignacion.estadoProgreso === 'iniciado' || asignacion.estadoProgreso === 'en_progreso') return 'iniciado';
  return 'disponible';
}

function formatearFecha(fecha?: string): string {
  if (!fecha) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(fecha));
}

interface AsignacionCardProps {
  asignacion: AsignacionCentroEstudios;
  estado?: EstadoVisualAsignacion;
  onAbrirMaterial?: (asignacion: AsignacionCentroEstudios) => void;
}

const AsignacionCard: React.FC<AsignacionCardProps> = ({ asignacion, estado, onAbrirMaterial }) => {
  const visual = estadoVisual[estado || mapearEstadoVisual(asignacion)];
  const progreso = asignacion.porcentajeProgreso ?? visual.progreso;

  return (
    <article className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-tkd-blue/10 text-tkd-blue flex items-center justify-center">
            {asignacion.uso === 'evaluacion' ? <IconoCertificado className="w-6 h-6" /> : <IconoAgenda className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-tkd-red">{asignacion.uso}</p>
            <h3 className="text-lg font-black text-tkd-dark dark:text-white uppercase leading-tight">{asignacion.titulo}</h3>
          </div>
        </div>
        <span className={`shrink-0 border px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${visual.clase}`}>
          {visual.etiqueta}
        </span>
      </div>

      <p className="mt-5 text-sm text-gray-500 dark:text-gray-300 leading-relaxed">{asignacion.descripcion}</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-black uppercase tracking-widest text-gray-400">
        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4">
          <span className="block text-gray-400">Momento</span>
          <span className="block mt-1 text-tkd-dark dark:text-white">{asignacion.momento.replace('_', ' ')}</span>
        </div>
        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4">
          <span className="block text-gray-400">Entrega</span>
          <span className="block mt-1 text-tkd-dark dark:text-white">{formatearFecha(asignacion.fechaCierre)}</span>
        </div>
        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4">
          <span className="block text-gray-400">Tipo</span>
          <span className="block mt-1 text-tkd-dark dark:text-white">{asignacion.obligatoria ? 'Obligatorio' : 'Opcional'}</span>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
          <span>Progreso</span>
          <span>{progreso}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-tkd-blue transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAbrirMaterial?.(asignacion)}
        className="mt-6 w-full rounded-2xl bg-tkd-dark dark:bg-white text-white dark:text-tkd-dark py-4 text-[11px] font-black uppercase tracking-[0.22em] hover:bg-tkd-blue transition-all"
      >
        Abrir material
      </button>
    </article>
  );
};

export default AsignacionCard;
