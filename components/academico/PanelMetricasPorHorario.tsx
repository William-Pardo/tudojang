// components/academico/PanelMetricasPorHorario.tsx
// Dashboard "Por Horario": día y hora de mayor consulta, a partir de ActividadLog.registradoEn
// (timestamp real por evento). Ver boceto "Por Horario" (validado con el usuario) y
// patronHorarioService.ts para la agregación pura.

import React from 'react';
import type { ActividadLog } from '../../models/academico/actividad';
import { calcularPatronHorario, formatearHora } from '../../servicios/academico/patronHorarioService';
import type { ProgramaDeAsignacion } from '../../servicios/academico/analisisProgresoService';

// exports.recordatoriosEstudioDiarios (functions/index.js) corre a las 08:00 hora Bogotá --
// si el pico real de consumo está lejos de esa hora, vale la pena decírselo al maestro.
const HORA_CRON_RECORDATORIOS = 8;
const HORAS_DIFERENCIA_RELEVANTE = 4;

function distanciaCircular(a: number, b: number): number {
  const diferencia = Math.abs(a - b);
  return Math.min(diferencia, 24 - diferencia);
}

export interface PanelMetricasPorHorarioProps {
  logs: ActividadLog[];
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion>;
  filtroPrograma: string;
}

const PanelMetricasPorHorario: React.FC<PanelMetricasPorHorarioProps> = ({
  logs,
  mapaAsignacionPrograma,
  filtroPrograma,
}) => {
  const patron = React.useMemo(
    () => calcularPatronHorario(logs, mapaAsignacionPrograma, filtroPrograma),
    [logs, mapaAsignacionPrograma, filtroPrograma]
  );

  if (!patron) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-blue">
          Sin datos suficientes
        </p>
        <h3 className="mt-3 text-xl font-black uppercase text-tkd-dark dark:text-white">
          Todavía no hay actividad registrada
        </h3>
        <p className="mt-3 text-sm font-bold text-gray-400">
          Esta vista agrupa el consumo por día y hora una vez que los estudiantes empiecen a
          interactuar con el material.
        </p>
      </div>
    );
  }

  const maxDia = Math.max(...patron.porDia.map((d) => d.cantidad), 1);
  const maxHora = Math.max(...patron.porHora, 1);
  const cronLejosDelPico = distanciaCircular(patron.horaPico, HORA_CRON_RECORDATORIOS) >= HORAS_DIFERENCIA_RELEVANTE;

  return (
    <div className="max-w-[820px] space-y-5" aria-label="Métricas por horario">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Resumen de patrones de horario">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-tkd-blue">{patron.totalEventos}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Eventos analizados</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-tkd-blue">{patron.diaPico}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Día de mayor consulta</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-tkd-red">{formatearHora(patron.horaPico)}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Hora de mayor consulta</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-gray-700 dark:text-gray-200">{patron.pctFinDeSemana}%</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Actividad fin de semana</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-5">
        <h3 className="text-[13px] font-black uppercase text-tkd-dark dark:text-white mb-1">Día de la semana</h3>
        <p className="text-[11px] font-semibold text-gray-400 mb-4">
          Interacciones registradas (apertura, video, pdf, quiz) según el día en que ocurrieron.
        </p>
        <div className="flex items-end gap-2.5 h-36">
          {patron.porDia.map((d) => (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              <span
                className={`text-[11px] font-extrabold tabular-nums ${d.dia === patron.diaPico ? 'text-tkd-red' : 'text-gray-400'}`}
              >
                {d.cantidad}
              </span>
              <span className="w-full flex-1 flex items-end">
                <span
                  className={`w-full rounded-t-lg rounded-b-sm ${d.dia === patron.diaPico ? 'bg-tkd-red' : 'bg-tkd-blue/25'}`}
                  style={{ height: `${Math.max((d.cantidad / maxDia) * 100, 3)}%` }}
                />
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-wide ${d.dia === patron.diaPico ? 'text-tkd-dark dark:text-white' : 'text-gray-400'}`}
              >
                {d.dia.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-5">
        <h3 className="text-[13px] font-black uppercase text-tkd-dark dark:text-white mb-1">Hora del día</h3>
        <p className="text-[11px] font-semibold text-gray-400 mb-4">
          Mismo total de eventos, agrupado por la hora exacta (hora Bogotá) en que el estudiante abrió el material.
        </p>
        <div className="flex items-end gap-[3px] h-32">
          {patron.porHora.map((cantidad, hora) => (
            <div
              key={hora}
              className="flex-1 h-full flex items-end"
              title={`${formatearHora(hora)}: ${cantidad}`}
            >
              <span
                className={`w-full rounded-t-sm ${hora === patron.horaPico ? 'bg-tkd-red' : 'bg-tkd-blue/25'}`}
                style={{ height: `${cantidad > 0 ? Math.max((cantidad / maxHora) * 100, 4) : 0}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[9px] font-black text-gray-300 dark:text-gray-600">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>23h</span>
        </div>
      </div>

      <div className="flex gap-3.5 rounded-[1.5rem] bg-tkd-blue/5 dark:bg-tkd-blue/10 border border-tkd-blue/20 p-5">
        <span className="w-1 rounded-full bg-tkd-blue shrink-0" aria-hidden />
        <div>
          <h4 className="text-[11px] font-black uppercase text-tkd-blue mb-1">Lectura sugerida</h4>
          <p className="text-sm font-semibold text-tkd-dark dark:text-gray-200 leading-snug">
            El consumo real se concentra los <b>{patron.diaPico}</b>, con pico a las{' '}
            <b>{formatearHora(patron.horaPico)}</b>.
          </p>
          {cronLejosDelPico ? (
            <p className="mt-1.5 text-[13px] font-semibold text-tkd-dark dark:text-gray-200 leading-snug">
              Los recordatorios de estudio corren a las {formatearHora(HORA_CRON_RECORDATORIOS)}, bastante antes de
              ese pico -- podría valer la pena revisar el horario del envío.
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] font-semibold text-tkd-dark dark:text-gray-200 leading-snug">
              Los recordatorios de estudio ({formatearHora(HORA_CRON_RECORDATORIOS)}) corren cerca de ese pico.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelMetricasPorHorario;
