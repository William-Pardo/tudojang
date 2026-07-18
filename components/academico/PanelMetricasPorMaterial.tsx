// components/academico/PanelMetricasPorMaterial.tsx
// Dashboard "Por Material": agrupa los materiales por patrón de consumo (velocidad de
// reacción × finalización) en vez de un ranking por un solo número. Ver conversación de
// diseño (boceto "ux progreso estudio" / integración): cruzar dos ejes explica el "por
// qué" y sugiere una acción distinta por categoría, algo que un índice compuesto o un
// ranking simple no logran.

import React from 'react';
import type { MetricasEstudiante } from '../../models/academico/actividad';
import {
  calcularMetricasPorMaterial,
  formatearTiempoReaccion,
  type MetricaMaterial,
  type CategoriaMaterial,
  type ProgramaDeAsignacion,
} from '../../servicios/academico/analisisProgresoService';
import { IconoPorTipo } from './ProgresoEstudianteCard';

// ---------------------------------------------------------------------------
// Definición de las 4 categorías: orden (peor primero, para que lo urgente se vea sin
// scrollear), copy y clase visual. Mismo orden y textos validados en el boceto.
// ---------------------------------------------------------------------------

const DEFINICION_CATEGORIAS: Record<CategoriaMaterial, {
  titulo: string;
  descripcion: string;
  accion: string;
  railClass: string;
  countBgClass: string;
  countTextClass: string;
  tituloTextClass: string;
  barClass: string;
}> = {
  no_funciona: {
    titulo: 'No está funcionando',
    descripcion: 'Tardan en abrirlo y, cuando lo hacen, lo abandonan. Ni genera interés ni retiene.',
    accion: 'Reemplazar o rediseñar el material',
    railClass: 'border-l-tkd-red',
    countBgClass: 'bg-red-100 dark:bg-red-900/30',
    countTextClass: 'text-tkd-red',
    tituloTextClass: 'text-tkd-red',
    barClass: 'bg-tkd-red',
  },
  engancha_decepciona: {
    titulo: 'Engancha, pero decepciona',
    descripcion: 'Lo abren casi de inmediato -- el tema interesa -- pero lo abandonan antes de terminar.',
    accion: 'Revisar duración o calidad del contenido',
    railClass: 'border-l-amber-500',
    countBgClass: 'bg-amber-100 dark:bg-amber-900/30',
    countTextClass: 'text-amber-700 dark:text-amber-400',
    tituloTextClass: 'text-amber-700 dark:text-amber-400',
    barClass: 'bg-amber-500',
  },
  cuesta_arrancar: {
    titulo: 'Cuesta arrancar, pero vale',
    descripcion: 'Tardan en decidirse a abrirlo, pero una vez que empiezan, lo terminan.',
    accion: 'Reforzar el aviso de la asignación, no el material',
    railClass: 'border-l-tkd-blue',
    countBgClass: 'bg-blue-100 dark:bg-blue-900/30',
    countTextClass: 'text-tkd-blue',
    tituloTextClass: 'text-tkd-blue',
    barClass: 'bg-tkd-blue',
  },
  funciona: {
    titulo: 'Funciona',
    descripcion: 'Lo abren casi de inmediato y lo terminan. El estándar a replicar en otros materiales.',
    accion: 'Usar de modelo para el resto',
    railClass: 'border-l-green-600',
    countBgClass: 'bg-green-100 dark:bg-green-900/30',
    countTextClass: 'text-green-700 dark:text-green-400',
    tituloTextClass: 'text-green-700 dark:text-green-400',
    barClass: 'bg-green-600',
  },
};

const ORDEN_CATEGORIAS: CategoriaMaterial[] = ['no_funciona', 'engancha_decepciona', 'cuesta_arrancar', 'funciona'];

// ---------------------------------------------------------------------------
// Fila de un material dentro de una categoría
// ---------------------------------------------------------------------------

const FilaMaterial: React.FC<{ material: MetricaMaterial; barClass: string }> = ({ material, barClass }) => (
  <div className="flex items-center gap-3 py-2.5 px-5 border-t border-gray-100 dark:border-white/10 first:border-t-0">
    <span className="w-6 h-6 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center shrink-0 text-gray-400">
      <IconoPorTipo tipo={material.tipoRecurso} className="w-3 h-3" />
    </span>
    <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-gray-700 dark:text-gray-200">
      {material.tituloRecurso}
    </span>
    <span className="w-20 shrink-0 text-right">
      <span className="block text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap">
        {formatearTiempoReaccion(material.tiempoReaccionPromedioHoras)}
      </span>
      <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-400">reacción</span>
    </span>
    <span className="w-16 shrink-0">
      <span className="block h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <span
          className={`block h-full rounded-full ${barClass}`}
          style={{ width: `${material.porcentajeFinalizacion}%` }}
        />
      </span>
      <span className="block mt-0.5 text-[9px] font-bold text-gray-400 text-right">
        {material.porcentajeFinalizacion}%
      </span>
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export interface PanelMetricasPorMaterialProps {
  metricas: MetricasEstudiante[];
  fechaAperturaPorAsignacion: Map<string, string>;
  mapaAsignacionPrograma: Map<string, ProgramaDeAsignacion>;
  filtroPrograma: string;
}

const PanelMetricasPorMaterial: React.FC<PanelMetricasPorMaterialProps> = ({
  metricas,
  fechaAperturaPorAsignacion,
  mapaAsignacionPrograma,
  filtroPrograma,
}) => {
  const materiales = React.useMemo(() => {
    const todos = calcularMetricasPorMaterial(metricas, fechaAperturaPorAsignacion, mapaAsignacionPrograma);
    if (filtroPrograma === 'todos') return todos;
    return todos.filter((m) => m.programaId === filtroPrograma);
  }, [metricas, fechaAperturaPorAsignacion, mapaAsignacionPrograma, filtroPrograma]);

  const porCategoria = React.useMemo(() => {
    const grupos: Record<CategoriaMaterial, MetricaMaterial[]> = {
      no_funciona: [],
      engancha_decepciona: [],
      cuesta_arrancar: [],
      funciona: [],
    };
    for (const m of materiales) grupos[m.categoria].push(m);
    return grupos;
  }, [materiales]);

  const resumen = React.useMemo(() => {
    const total = materiales.length;
    const reaccionPromedio = total > 0
      ? materiales.reduce((s, m) => s + m.tiempoReaccionPromedioHoras, 0) / total
      : 0;
    const finalizacionPromedio = total > 0
      ? Math.round(materiales.reduce((s, m) => s + m.porcentajeFinalizacion, 0) / total)
      : 0;
    return { total, reaccionPromedio, finalizacionPromedio, enZonaRoja: porCategoria.no_funciona.length };
  }, [materiales, porCategoria]);

  if (materiales.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-blue">
          Sin datos suficientes
        </p>
        <h3 className="mt-3 text-xl font-black uppercase text-tkd-dark dark:text-white">
          Ningún material tiene actividad todavía
        </h3>
        <p className="mt-3 text-sm font-bold text-gray-400">
          Esta vista agrupa los materiales por velocidad de reacción y finalización una
          vez que los estudiantes empiecen a consumirlos.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[820px] space-y-5" aria-label="Métricas por material">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Resumen de métricas por material">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-tkd-blue">{resumen.total}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Materiales activos</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-gray-700 dark:text-gray-200">
            {formatearTiempoReaccion(resumen.reaccionPromedio)}
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Reacción promedio</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-gray-700 dark:text-gray-200">{resumen.finalizacionPromedio}%</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Finalización promedio</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-black text-tkd-red">{resumen.enZonaRoja}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">En zona roja</p>
        </div>
      </div>

      <p className="text-[10.5px] font-semibold text-gray-400">
        Rápido = <b className="text-gray-600 dark:text-gray-300">menos de 24h</b> desde que el material se
        volvió accesible · Finalización alta = <b className="text-gray-600 dark:text-gray-300">80% o más</b>
      </p>

      {ORDEN_CATEGORIAS.map((categoria) => {
        const lista = porCategoria[categoria];
        if (lista.length === 0) return null;
        const def = DEFINICION_CATEGORIAS[categoria];

        return (
          <div
            key={categoria}
            className={`rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 border-l-4 ${def.railClass} overflow-hidden`}
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-white/10">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${def.countBgClass} ${def.countTextClass}`}>
                {lista.length}
              </span>
              <div className="min-w-0">
                <h3 className={`text-[13px] font-black uppercase ${def.tituloTextClass}`}>{def.titulo}</h3>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 leading-snug">
                  {def.descripcion}
                </p>
              </div>
              <span className="ml-auto shrink-0 text-right text-[9px] font-black uppercase tracking-wider text-gray-400 max-w-[130px] leading-snug">
                {def.accion}
              </span>
            </div>
            {lista.map((material) => (
              <FilaMaterial key={material.asignacionId} material={material} barClass={def.barClass} />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default PanelMetricasPorMaterial;
