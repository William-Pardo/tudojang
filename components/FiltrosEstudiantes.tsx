// components/FiltrosEstudiantes.tsx
import React from 'react';
import { GrupoEdad, EstadoPago } from '../tipos';

interface Props {
  filtroNombre: string;
  setFiltroNombre: (value: string) => void;
  filtroGrupo: GrupoEdad | 'todos';
  setFiltroGrupo: (value: GrupoEdad | 'todos') => void;
  filtroEstado: EstadoPago | 'todos';
  setFiltroEstado: (value: EstadoPago | 'todos') => void;
}

const FiltrosEstudiantes: React.FC<Props> = ({
  filtroNombre,
  setFiltroNombre,
  filtroGrupo,
  setFiltroGrupo,
  filtroEstado,
  setFiltroEstado,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <input
        type="text"
        placeholder="Buscar por nombre..."
        value={filtroNombre}
        onChange={e => setFiltroNombre(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 shadow-sm"
      />
      <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm">
        <option value="todos">Todos los grupos</option>
        {Object.values(GrupoEdad).map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm">
        <option value="todos">Todos los estados de pago</option>
        {Object.values(EstadoPago).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
};

export default FiltrosEstudiantes;