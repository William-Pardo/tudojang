import React from 'react';
import { IconoAprobar } from '../Iconos';

export interface MetricasProgresoAcademico {
  total: number;
  completadas: number;
  enProgreso: number;
  vencidas: number;
  proximasAVencer: number;
}

export function calcularPorcentajeGeneral(metricas: MetricasProgresoAcademico): number {
  if (metricas.total <= 0) return 0;
  return Math.round((metricas.completadas / metricas.total) * 100);
}

interface ProgresoResumenCardProps {
  metricas: MetricasProgresoAcademico;
  estado?: string;
}

const ProgresoResumenCard: React.FC<ProgresoResumenCardProps> = ({ metricas, estado = 'Piloto listo' }) => {
  const progresoGeneral = calcularPorcentajeGeneral(metricas);

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Asignaciones</p>
        <p className="mt-2 text-4xl font-black text-tkd-blue">{metricas.total}</p>
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {metricas.enProgreso} en progreso · {metricas.proximasAVencer} próximas
        </p>
      </div>
      <div className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Progreso general</p>
        <p className="mt-2 text-4xl font-black text-tkd-blue">{progresoGeneral}%</p>
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {metricas.completadas} completadas · {metricas.vencidas} vencidas
        </p>
      </div>
      <div className="rounded-[2rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center">
          <IconoAprobar className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</p>
          <p className="mt-1 text-xl font-black text-tkd-dark dark:text-white">{estado}</p>
        </div>
      </div>
    </section>
  );
};

export default ProgresoResumenCard;
