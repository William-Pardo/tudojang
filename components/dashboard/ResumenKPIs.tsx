
// components/dashboard/ResumenKPIs.tsx
import React, { useMemo } from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';
import { IconoEstudiantes, IconoAprobar, IconoTienda } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';

const CardKPI: React.FC<{ titulo: string; valor: string | number; icono: React.ReactNode; colorIcono: string; colorBgIcono: string; tendencia?: string }> = ({ titulo, valor, icono, colorIcono, colorBgIcono, tendencia }) => (
  <div className="bg-[#1A2232] p-8 rounded-[1.8rem] flex items-center gap-6 border border-white/5 shadow-2xl hover:scale-[1.02] transition-all">
    <div className={`w-16 h-16 rounded-full ${colorBgIcono} flex items-center justify-center shadow-lg`}>
      {React.isValidElement(icono) ? React.cloneElement(icono as React.ReactElement<any>, { className: `w-7 h-7 ${colorIcono}` }) : icono}
    </div>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">{titulo}</span>
      </div>
      <div className="text-3xl font-black text-white mt-1">{valor}</div>
      {tendencia && (
        <div className="mt-1 flex items-center gap-1">
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
        colorIcono="text-blue-400"
        colorBgIcono="bg-blue-500/10"
        tendencia={`${statsEstudiantes.activos} al día`}
      />
      <CardKPI
        titulo="Ingresos"
        valor={formatearPrecio(finanzas.ingresos)}
        icono={<IconoAprobar />}
        colorIcono="text-green-400"
        colorBgIcono="bg-green-500/10"
      />
      <CardKPI
        titulo="Egresos"
        valor={formatearPrecio(finanzas.egresos)}
        icono={<IconoTienda />}
        colorIcono="text-red-400"
        colorBgIcono="bg-red-500/10"
      />
      <CardKPI
        titulo="Cuentas por Cobrar"
        valor={formatearPrecio(statsEstudiantes.deudaTotal)}
        icono={<span className="text-2xl font-black">$</span>}
        colorIcono="text-orange-400"
        colorBgIcono="bg-orange-500/10"
      />
    </div>
  );
};

export default ResumenKPIs;
