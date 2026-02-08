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
    <div className="bg-[#1A2232] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
      <h3 className="text-[10px] font-black uppercase text-tkd-blue mb-8 tracking-[0.3em]">Filtros de Análisis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 items-end">
        <div className="space-y-3">
          <label htmlFor="sedeId" className="block text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">
            Sede / Dojang
          </label>
          <select
            name="sedeId"
            id="sedeId"
            value={filtros.sedeId}
            onChange={onFiltroChange}
            className="w-full bg-[#0D121F] border border-white/5 rounded-2xl px-6 py-4 text-white text-[11px] font-bold focus:border-tkd-blue outline-none transition-all cursor-pointer hover:bg-[#151b2b]"
          >
            <option value="todas">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <label htmlFor="grupo" className="block text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">
            Grupo de Edad
          </label>
          <select
            name="grupo"
            id="grupo"
            value={filtros.grupo}
            onChange={onFiltroChange}
            className="w-full bg-[#0D121F] border border-white/5 rounded-2xl px-6 py-4 text-white text-[11px] font-bold focus:border-tkd-blue outline-none transition-all cursor-pointer hover:bg-[#151b2b]"
          >
            <option value="todos">Todos los grupos</option>
            {Object.values(GrupoEdad).map(g => (
              g !== GrupoEdad.NoAsignado && <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <label htmlFor="fechaInicio" className="block text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">
            Ingreso Desde
          </label>
          <input
            type="date"
            name="fechaInicio"
            id="fechaInicio"
            value={filtros.fechaInicio}
            onChange={onFiltroChange}
            className="w-full bg-[#0D121F] border border-white/5 rounded-2xl px-6 py-4 text-white text-[11px] font-bold focus:border-tkd-blue outline-none transition-all h-[52px]"
          />
        </div>
        <div className="space-y-3">
          <label htmlFor="fechaFin" className="block text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">
            Ingreso Hasta
          </label>
          <input
            type="date"
            name="fechaFin"
            id="fechaFin"
            value={filtros.fechaFin}
            onChange={onFiltroChange}
            className="w-full bg-[#0D121F] border border-white/5 rounded-2xl px-6 py-4 text-white text-[11px] font-bold focus:border-tkd-blue outline-none transition-all h-[52px]"
          />
        </div>
        <div className="h-full flex items-end">
          <button
            onClick={onLimpiarFiltros}
            className="w-full bg-white/5 text-gray-400 border border-white/5 h-[52px] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all shadow-xl"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltrosDashboard;