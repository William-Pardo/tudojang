// components/academico/ProgresoEstudianteCard.tsx
// Tarjeta que muestra el detalle de actividad y métricas académicas de UN estudiante.
// Visible para maestros y tenants. El estudiante ve su propia tarjeta resumida.

import React from 'react';
import type { MetricasEstudiante, AvanceAsignacion } from '../../models/academico/actividad';

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------

function formatearFecha(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function iconoPorTipo(tipo: string): string {
  switch (tipo) {
    case 'video':         return '▶';
    case 'pdf':           return '📄';
    case 'imagen':        return '🖼';
    case 'texto':         return '📝';
    case 'presentacion':  return '📊';
    case 'quiz':          return '✏️';
    default:              return '📁';
  }
}

function colorBarraConsumo(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

function colorScore(score?: number): string {
  if (score === undefined) return 'text-gray-400';
  if (score >= 80)  return 'text-green-600 dark:text-green-400';
  if (score >= 60)  return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Sub-componente: barra de progreso de un recurso
// ---------------------------------------------------------------------------

interface FilaAvanceProps {
  avance: AvanceAsignacion;
}

const FilaAvance: React.FC<FilaAvanceProps> = ({ avance }) => {
  const {
    tituloRecurso,
    tipoRecurso,
    porcentajeConsumo,
    scoreUltimaEvaluacion,
    vecesEvaluado,
    ultimaActividadEn,
  } = avance;

  return (
    <li className="flex flex-col gap-1 py-2 border-b border-gray-100 dark:border-white/10 last:border-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200 truncate max-w-[60%]">
          <span aria-hidden>{iconoPorTipo(tipoRecurso)}</span>
          {tituloRecurso || '(Sin título)'}
        </span>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase text-gray-400 shrink-0">
          {tipoRecurso === 'quiz' && scoreUltimaEvaluacion !== undefined && (
            <span className={`text-sm font-black ${colorScore(scoreUltimaEvaluacion)}`}>
              {scoreUltimaEvaluacion}%
              {vecesEvaluado && vecesEvaluado > 1 && (
                <span className="ml-1 font-normal">({vecesEvaluado}×)</span>
              )}
            </span>
          )}
          <span>{formatearFecha(ultimaActividadEn)}</span>
        </div>
      </div>

      {/* Barra de consumo */}
      <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorBarraConsumo(porcentajeConsumo)}`}
          style={{ width: `${porcentajeConsumo}%` }}
          role="progressbar"
          aria-valuenow={porcentajeConsumo}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${porcentajeConsumo}% de consumo`}
        />
      </div>
      <span className="text-[9px] font-bold text-gray-400">
        {porcentajeConsumo}% consumido
      </span>
    </li>
  );
};

// ---------------------------------------------------------------------------
// Componente principal: ProgresoEstudianteCard
// ---------------------------------------------------------------------------

export interface ProgresoEstudianteCardProps {
  metricas: MetricasEstudiante;
  /** Si es true, muestra la tarjeta expandida con el detalle de cada asignación. */
  expandido?: boolean;
  onToggleExpandido?: () => void;
}

const ProgresoEstudianteCard: React.FC<ProgresoEstudianteCardProps> = ({
  metricas,
  expandido = false,
  onToggleExpandido,
}) => {
  const {
    estudianteNombre,
    porcentajeGlobalConsumo,
    promedioScoreEvaluaciones,
    totalAsignaciones,
    asignacionesIniciadas,
    asignacionesCompletadas,
    totalEvaluacionesRealizadas,
    avancePorAsignacion,
    ultimaActividadEn,
  } = metricas;

  return (
    <article
      className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden"
      aria-label={`Progreso académico de ${estudianteNombre ?? metricas.estudianteId}`}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar inicial */}
          <div
            className="w-10 h-10 rounded-2xl bg-tkd-blue flex items-center justify-center text-white font-black text-sm shrink-0"
            aria-hidden
          >
            {(estudianteNombre ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-black text-gray-900 dark:text-white truncate">
              {estudianteNombre ?? metricas.estudianteId}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Última actividad {formatearFecha(ultimaActividadEn)}{' '}
              {formatearHora(ultimaActividadEn)}
            </p>
          </div>
        </div>

        {/* Porcentaje global */}
        <div className="flex flex-col items-end shrink-0">
          <span
            className="text-2xl font-black"
            style={{ color: porcentajeGlobalConsumo >= 70 ? '#22c55e' : porcentajeGlobalConsumo >= 40 ? '#eab308' : '#ef4444' }}
          >
            {porcentajeGlobalConsumo}%
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Consumo global</span>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/10 border-t border-gray-100 dark:border-white/10">
        <div className="p-3 text-center">
          <p className="text-lg font-black text-tkd-blue">{asignacionesCompletadas}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Completadas</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-lg font-black text-gray-700 dark:text-gray-200">{asignacionesIniciadas}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Iniciadas</p>
        </div>
        <div className="p-3 text-center">
          <p className={`text-lg font-black ${colorScore(totalEvaluacionesRealizadas > 0 ? promedioScoreEvaluaciones : undefined)}`}>
            {totalEvaluacionesRealizadas > 0 ? `${promedioScoreEvaluaciones}%` : '—'}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Prom. evaluaciones</p>
        </div>
      </div>

      {/* Barra expandir / colapsar */}
      {totalAsignaciones > 0 && (
        <button
          type="button"
          className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-tkd-blue transition-colors border-t border-gray-100 dark:border-white/10"
          onClick={onToggleExpandido}
          aria-expanded={expandido}
        >
          {expandido ? '▲ Ocultar detalle' : `▼ Ver ${totalAsignaciones} asignaciones`}
        </button>
      )}

      {/* Detalle por asignación */}
      {expandido && avancePorAsignacion.length > 0 && (
        <div className="border-t border-gray-100 dark:border-white/10 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
            Actividad por material
          </p>
          <ul>
            {avancePorAsignacion.map((avance) => (
              <FilaAvance key={avance.asignacionId} avance={avance} />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
};

export default ProgresoEstudianteCard;
