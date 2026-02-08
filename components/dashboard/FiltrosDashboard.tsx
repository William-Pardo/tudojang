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
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border dark:border-gray-700">
      <h3 className="text-lg font-bold text-tkd-blue mb-4">Filtros de Análisis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div>
          <label htmlFor="sedeId" className="block text-xs font-black uppercase text-gray-500 mb-1">
            Sede / Dojang
          </label>
          <select
            name="sedeId"
            id="sedeId"
            value={filtros.sedeId}
            onChange={onFiltroChange}
            className="w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="grupo" className="block text-xs font-black uppercase text-gray-500 mb-1">
            Grupo de Edad
          </label>
          <select
            name="grupo"
            id="grupo"
            value={filtros.grupo}
            onChange={onFiltroChange}
            className="w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          >
            <option value="todos">Todos los grupos</option>
            {Object.values(GrupoEdad).map(g => (
              g !== GrupoEdad.NoAsignado && <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fechaInicio" className="block text-xs font-black uppercase text-gray-500 mb-1">
            Ingreso Desde
          </label>
          <input
            type="date"
            name="fechaInicio"
            id="fechaInicio"
            value={filtros.fechaInicio}
            onChange={onFiltroChange}
            className="w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
        </div>
        <div>
          <label htmlFor="fechaFin" className="block text-xs font-black uppercase text-gray-500 mb-1">
            Ingreso Hasta
          </label>
          <input
            type="date"
            name="fechaFin"
            id="fechaFin"
            value={filtros.fechaFin}
            onChange={onFiltroChange}
            className="w-full border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
          />
        </div>
        <div>
          <button
            onClick={onLimpiarFiltros}
            className="w-full bg-gray-500 text-white px-4 py-2 rounded-md font-bold text-sm hover:bg-gray-600 transition-colors shadow-sm"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltrosDashboard;