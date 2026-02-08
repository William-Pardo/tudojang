
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
    <div className="bg-[#1A2232] p-8 rounded-[1.8rem] border border-white/5 shadow-2xl h-full">
      <h2 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-8">Distribución de Cartera</h2>
      <ul className="space-y-8">
        {Object.entries(distribucionPagos).map(([estado, cantidad]) => {
          const colors = {
            'AL DÍA': 'bg-green-500',
            'PENDIENTE': 'bg-yellow-500',
            'VENCIDO': 'bg-gray-700',
          };
          const total = totalEstudiantes > 0 ? totalEstudiantes : 1;
          const percentage = (((cantidad as number) / total) * 100).toFixed(1);

          return (
            <li key={estado}>
              <div className="flex justify-between items-end mb-3 px-1">
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                  {estado} <span className="ml-1 text-tkd-blue">({cantidad})</span>
                </span>
                <span className="text-[10px] font-black text-white tracking-widest">
                  {percentage}%
                </span>
              </div>
              <div className="w-full bg-[#0D121F] rounded-full h-1.5 overflow-hidden">
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
