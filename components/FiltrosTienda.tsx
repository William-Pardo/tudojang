// components/FiltrosTienda.tsx
import React from 'react';
import { CategoriaImplemento } from '../tipos';
import type { CategoriaImplemento as Categoria } from '../tipos';

interface Props {
  filtroCategoria: Categoria | 'todos';
  setFiltroCategoria: (value: Categoria | 'todos') => void;
  filtroPrecio: string;
  setFiltroPrecio: (value: string) => void;
  limpiarFiltros: () => void;
}

const RANGOS_PRECIO = [
  { value: 'todos', label: 'Cualquier precio' },
  { value: '0-50000', label: 'Menos de $50.000' },
  { value: '50001-100000', label: '$50.000 - $100.000' },
  { value: '100001-150000', label: '$100.001 - $150.000' },
  { value: '150001-9999999', label: 'Más de $150.000' },
];

const FiltrosTienda: React.FC<Props> = ({
  filtroCategoria,
  setFiltroCategoria,
  filtroPrecio,
  setFiltroPrecio,
  limpiarFiltros,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
      <div>
        <label htmlFor="filtro-categoria" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
        <select
          id="filtro-categoria"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value as any)}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:ring-tkd-blue focus:border-tkd-blue"
        >
          <option value="todos">Todas las categorías</option>
          {Object.values(CategoriaImplemento).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filtro-precio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rango de Precio</label>
        <select
          id="filtro-precio"
          value={filtroPrecio}
          onChange={(e) => setFiltroPrecio(e.target.value)}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm focus:ring-tkd-blue focus:border-tkd-blue"
        >
          {RANGOS_PRECIO.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:self-end">
        <button
          onClick={limpiarFiltros}
          className="w-full h-10 px-4 py-2 bg-gray-500 text-white rounded-md font-semibold hover:bg-gray-600 transition-colors shadow-sm"
        >
          Limpiar Filtros
        </button>
      </div>
    </div>
  );
};

export default FiltrosTienda;