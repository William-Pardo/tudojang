
// components/dashboard/ResumenPagos.tsx

import React, { useMemo } from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';

interface Props {
  estudiantes: Estudiante[];
}

const ResumenPagos: React.FC<Props> = ({ estudiantes }) => {

  const distribucionPagos = useMemo(() => ({
    'Al día': estudiantes.filter(e => e.estadoPago === EstadoPago.AlDia).length,
    'Pendiente': estudiantes.filter(e => e.estadoPago === EstadoPago.Pendiente).length,
    'Vencido': estudiantes.filter(e => e.estadoPago === EstadoPago.Vencido).length,
  }), [estudiantes]);
  
  const totalEstudiantes = estudiantes.length;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
      <h2 className="text-lg font-black text-tkd-dark dark:text-white uppercase tracking-tight mb-6">Distribución de Cartera</h2>
      <ul className="space-y-5">
        {Object.entries(distribucionPagos).map(([estado, cantidad]) => {
          const colors = {
            'Al día': 'bg-green-500',
            'Pendiente': 'bg-yellow-500',
            'Vencido': 'bg-red-500',
          };
          const total = totalEstudiantes > 0 ? totalEstudiantes : 1;
          const percentage = (((cantidad as number) / total) * 100).toFixed(1);
          
          return (
            <li key={estado}>
              <div className="flex justify-between items-end mb-2 px-1">
                <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-400 tracking-wider">
                  {estado} <span className="ml-1 text-tkd-blue">({cantidad})</span>
                </span>
                <span className="text-xs font-black text-tkd-dark dark:text-white">
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
