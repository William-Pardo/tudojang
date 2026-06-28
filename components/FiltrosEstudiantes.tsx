// components/FiltrosEstudiantes.tsx
import React from 'react';
import type { Sede } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD } from '../tipos';

interface Props {
  filtroNombre: string;
  setFiltroNombre: (value: string) => void;
  filtroGrupo: GrupoEdad | 'todos';
  setFiltroGrupo: (value: GrupoEdad | 'todos') => void;
  filtroEstado: EstadoPago | 'todos';
  setFiltroEstado: (value: EstadoPago | 'todos') => void;
  filtroGrado: GradoTKD | 'todos';
  setFiltroGrado: (value: GradoTKD | 'todos') => void;
  filtroSede: string;
  setFiltroSede: (value: string) => void;
  sedes: Sede[];
}

const FiltrosEstudiantes: React.FC<Props> = ({
  filtroNombre,
  setFiltroNombre,
  filtroGrupo,
  setFiltroGrupo,
  filtroEstado,
  setFiltroEstado,
  filtroGrado,
  setFiltroGrado,
  filtroSede,
  setFiltroSede,
  sedes,
}) => {
  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm";
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <input
        type="text"
        placeholder="Buscar por nombre..."
        value={filtroNombre}
        onChange={e => setFiltroNombre(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 shadow-sm"
      />
      <select aria-label="Grupo" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value as GrupoEdad | 'todos')} className={selectClass}>
        <option value="todos">Todos los grupos</option>
        {Object.values(GrupoEdad).map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select aria-label="Estado de pago" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoPago | 'todos')} className={selectClass}>
        <option value="todos">Todos los estados de pago</option>
        {Object.values(EstadoPago).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select aria-label="Grado" value={filtroGrado} onChange={e => setFiltroGrado(e.target.value as GradoTKD | 'todos')} className={selectClass}>
        <option value="todos">Todos los grados</option>
        {Object.values(GradoTKD).map(grado => <option key={grado} value={grado}>{grado}</option>)}
      </select>
      <select aria-label="Sede" value={filtroSede} onChange={e => setFiltroSede(e.target.value)} className={selectClass}>
        <option value="todos">Todas las sedes</option>
        {sedes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
      </select>
    </div>
  );
};

export default FiltrosEstudiantes;
