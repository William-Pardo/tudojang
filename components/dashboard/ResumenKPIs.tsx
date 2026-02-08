import React from 'react';
import type { Estudiante } from '../../tipos';
import { EstadoPago } from '../../tipos';
import { IconoEstudiantes, IconoAprobar, IconoTienda } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';

const CardKPI: React.FC<{ 
    titulo: string; 
    valor: string | number; 
    icono: React.ReactNode; 
    color: string; 
    tendencia?: string 
}> = ({ titulo, valor, icono, color, tendencia }) => (
    <div className="bg-white dark:bg-white/5 p-8 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 flex items-center space-x-6 hover:shadow-premium transition-all duration-500 group">
        <div className={`p-4 rounded-2xl ${color} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm`}>
            {icono}
        </div>
        <div className="flex-grow">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.2em] mb-1">{titulo}</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{valor}</p>
            {tendencia && (
                <p className="text-[10px] font-black mt-2 text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-current animate-pulse"></span>
                    {tendencia}
                </p>
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
  const stats = React.useMemo(() => ({
    total: estudiantes.length,
    activos: estudiantes.filter(e => e.estadoPago === EstadoPago.AlDia).length,
    deuda: estudiantes.reduce((acc, e) => acc + e.saldoDeudor, 0)
  }), [estudiantes]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <CardKPI
        titulo="Alumnos Totales"
        valor={stats.total}
        icono={<IconoEstudiantes className="w-7 h-7 text-tkd-blue" />}
        color="bg-tkd-blue/10 dark:bg-tkd-blue/20"
        tendencia={`${stats.activos} AL DÍA`}
      />
      <CardKPI
        titulo="Recaudo Mes"
        valor={formatearPrecio(finanzas.ingresos)}
        icono={<IconoAprobar className="w-7 h-7 text-green-600" />}
        color="bg-green-50 dark:bg-green-900/20"
        tendencia="FLUJO POSITIVO"
      />
      <CardKPI
        titulo="Egresos Operativos"
        valor={formatearPrecio(finanzas.egresos)}
        icono={<IconoTienda className="w-7 h-7 text-tkd-red" />}
        color="bg-red-50 dark:bg-red-900/20"
      />
      <CardKPI
        titulo="Cartera Técnica"
        valor={formatearPrecio(stats.deuda)}
        icono={<span className="text-2xl font-black text-orange-600">$</span>}
        color="bg-orange-50 dark:bg-orange-900/20"
        tendencia="POR COBRAR"
      />
    </div>
  );
};

export default ResumenKPIs;