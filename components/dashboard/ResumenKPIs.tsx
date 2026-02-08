
// components/dashboard/ResumenKPIs.tsx
import React, { useMemo } from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';
import { IconoEstudiantes, IconoAprobar, IconoTienda } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';

const CardKPI: React.FC<{ titulo: string; valor: string | number; icono: React.ReactNode; colorIcono: string; colorBgIcono: string; tendencia?: string }> = ({ titulo, valor, icono, colorIcono, colorBgIcono, tendencia }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
    <div className={`w-14 h-14 rounded-full ${colorBgIcono} flex items-center justify-center transition-transform hover:scale-110`}>
      {React.isValidElement(icono) ? React.cloneElement(icono as React.ReactElement<any>, { className: `w-6 h-6 ${colorIcono}` }) : icono}
    </div>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wider font-poppins">{titulo}</span>
      </div>
      <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{valor}</div>
      {tendencia && (
        <div className="mt-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">{tendencia}</span>
        </div>
      )}
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
        icono={<IconoEstudiantes />}
        colorIcono="text-blue-500"
        colorBgIcono="bg-blue-50 dark:bg-blue-900/20"
        tendencia={`${statsEstudiantes.activos} AL DÍA`}
      />
      <CardKPI
        titulo="Ingresos"
        valor={formatearPrecio(finanzas.ingresos)}
        icono={<IconoAprobar />}
        colorIcono="text-green-500"
        colorBgIcono="bg-green-50 dark:bg-green-900/20"
      />
      <CardKPI
        titulo="Egresos"
        valor={formatearPrecio(finanzas.egresos)}
        icono={<IconoTienda />}
        colorIcono="text-red-500"
        colorBgIcono="bg-red-50 dark:bg-red-900/20"
      />
      <CardKPI
        titulo="Cuentas por cobrar"
        valor={formatearPrecio(statsEstudiantes.deudaTotal)}
        icono={<span className="text-xl font-black text-orange-500">$</span>}
        colorIcono="text-orange-500"
        colorBgIcono="bg-orange-50 dark:bg-orange-900/20"
      />
    </div>
  );
};

export default ResumenKPIs;
