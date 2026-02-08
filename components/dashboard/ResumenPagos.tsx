
// components/dashboard/ResumenPagos.tsx

import React, { useMemo } from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';

interface Props {
  estudiantes: Estudiante[];
}

const ResumenPagos: React.FC<Props> = ({ estudiantes }) => {

  const distribucionPagos = useMemo(() => ({
    'AL DÍA': estudiantes.filter(e => e.estadoPago === EstadoPago.AlDia).length,
    'PENDIENTE': estudiantes.filter(e => e.estadoPago === EstadoPago.Pendiente).length,
    'VENCIDO': estudiantes.filter(e => e.estadoPago === EstadoPago.Vencido).length,
  }), [estudiantes]);

  const totalEstudiantes = estudiantes.length;

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm h-full">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-8">Distribución de Cartera</h2>
      <ul className="space-y-8">
        {Object.entries(distribucionPagos).map(([estado, cantidad]) => {
          const colors = {
            'AL DÍA': 'bg-green-500',
            'PENDIENTE': 'bg-yellow-500',
            'VENCIDO': 'bg-red-500',
          };
          const total = totalEstudiantes > 0 ? totalEstudiantes : 1;
          const percentage = (((cantidad as number) / total) * 100).toFixed(1);

          return (
            <li key={estado}>
              <div className="flex justify-between items-end mb-2 px-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                  {estado} <span className="text-tkd-blue ml-1">({cantidad})</span>
                </span>
                <span className="text-xs font-black text-gray-900 dark:text-white">
                  {percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${colors[estado as keyof typeof colors]}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ResumenPagos;
