
// components/dashboard/ResumenKPIs.tsx
import React, { useMemo } from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';
import { IconoEstudiantes, IconoAprobar, IconoTienda } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';

const CardKPI: React.FC<{ titulo: string; valor: string | number; icono: React.ReactNode; color: string; tendencia?: string }> = ({ titulo, valor, icono, color, tendencia }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm flex items-center space-x-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
        <div className={`p-3 rounded-full ${color}`}>
            {icono}
        </div>
        <div className="flex-grow">
            <p className="text-xs text-gray-700 dark:text-gray-400 font-bold uppercase tracking-wider">{titulo}</p>
            <p className="text-2xl font-black text-tkd-dark dark:text-white">{valor}</p>
            {tendencia && <p className="text-xs font-bold mt-1 text-green-700 dark:text-green-500">{tendencia}</p>}
        </div>
    </div>
);

interface Props {
  estudiantes: Estudiante[];
  finanzas: {
      ingresos: number;
      egresos: number;
      balance: number;
  };
}

const ResumenKPIs: React.FC<Props> = ({ estudiantes, finanzas }) => {
  const statsEstudiantes = useMemo(() => {
    const totalEstudiantes = estudiantes.length;
    const activos = estudiantes.filter(e => e.estadoPago === EstadoPago.AlDia).length;
    const deudaTotal = estudiantes.reduce((acc, e) => acc + e.saldoDeudor, 0);

    return { totalEstudiantes, activos, deudaTotal };
  }, [estudiantes]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <CardKPI
        titulo="Estudiantes"
        valor={statsEstudiantes.totalEstudiantes}
        icono={<IconoEstudiantes className="w-6 h-6 text-blue-600" />}
        color="bg-blue-100 dark:bg-blue-900/50"
        tendencia={`${statsEstudiantes.activos} al día`}
      />
      <CardKPI
        titulo="Ingresos"
        valor={formatearPrecio(finanzas.ingresos)}
        icono={<IconoAprobar className="w-6 h-6 text-green-600" />}
        color="bg-green-100 dark:bg-green-900/50"
      />
      <CardKPI
        titulo="Egresos"
        valor={formatearPrecio(finanzas.egresos)}
        icono={<IconoTienda className="w-6 h-6 text-red-600" />}
        color="bg-red-100 dark:bg-red-900/50"
      />
      <CardKPI
        titulo="Cuentas por Cobrar"
        valor={formatearPrecio(statsEstudiantes.deudaTotal)}
        icono={<span className="text-2xl font-bold text-orange-600">$</span>}
        color="bg-orange-100 dark:bg-orange-900/50"
      />
    </div>
  );
};

export default ResumenKPIs;
