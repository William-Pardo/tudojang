// components/dashboard/FiltrosDashboard.tsx

import React from 'react';
import { GrupoEdad, Sede } from '../../tipos';
import type { GrupoEdad as GrupoEdadType } from '../../tipos';

interface Props {
  filtros: {
    fechaInicio: string;
    fechaFin: string;
    grupo: GrupoEdadType | 'todos';
    sedeId: string;
  };
  sedes: Sede[];
  onFiltroChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onLimpiarFiltros: () => void;
}

const FiltrosDashboard: React.FC<Props> = ({ filtros, sedes, onFiltroChange, onLimpiarFiltros }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
      <h3 className="text-xs font-bold uppercase text-tkd-blue mb-6 tracking-wider">Filtros de Análisis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div className="space-y-2">
          <label htmlFor="sedeId" className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
            Sede / Dojang
          </label>
          <select
            name="sedeId"
            id="sedeId"
            value={filtros.sedeId}
            onChange={onFiltroChange}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-tkd-blue outline-none transition-all"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="grupo" className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
            Grupo de Edad
          </label>
          <select
            name="grupo"
            id="grupo"
            value={filtros.grupo}
            onChange={onFiltroChange}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-tkd-blue outline-none transition-all"
          >
            <option value="todos">Todos los grupos</option>
            {Object.values(GrupoEdad).map(g => (
              g !== GrupoEdad.NoAsignado && <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="fechaInicio" className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
            Ingreso Desde
          </label>
          <input
            type="date"
            name="fechaInicio"
            id="fechaInicio"
            value={filtros.fechaInicio}
            onChange={onFiltroChange}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-tkd-blue outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="fechaFin" className="block text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
            Ingreso Hasta
          </label>
          <input
            type="date"
            name="fechaFin"
            id="fechaFin"
            value={filtros.fechaFin}
            onChange={onFiltroChange}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-tkd-blue outline-none transition-all"
          />
        </div>
        <div>
          <button
            onClick={onLimpiarFiltros}
            className="w-full bg-gray-500 text-white py-2 rounded-md font-bold text-sm hover:bg-gray-600 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltrosDashboard;