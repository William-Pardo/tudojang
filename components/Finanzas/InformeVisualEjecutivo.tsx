
// components/Finanzas/InformeVisualEjecutivo.tsx
import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell 
} from 'recharts';
import type { MovimientoFinanciero, Estudiante, Sede } from '../../tipos';
import { TipoMovimiento } from '../../tipos';
import { formatearPrecio } from '../../utils/formatters';
import { useConfiguracion } from '../../context/DataContext';

interface Props {
    movimientos: MovimientoFinanciero[];
    estudiantes: Estudiante[];
    sedes: Sede[];
}

const InformeVisualEjecutivo: React.FC<Props> = ({ movimientos, estudiantes, sedes }) => {
    const { configClub } = useConfiguracion();
    
    const analiticas = useMemo(() => {
        const ingresos = movimientos.filter(m => m.tipo === TipoMovimiento.Ingreso).reduce((a, b) => a + b.monto, 0);
        const egresos = movimientos.filter(m => m.tipo === TipoMovimiento.Egreso).reduce((a, b) => a + b.monto, 0);
        const cartera = estudiantes.reduce((acc, e) => acc + e.saldoDeudor, 0);
        
        // Obtener categorías únicas dinámicamente
        const categoriasUnicas = Array.from(new Set(movimientos.map(m => m.categoria)));

        // Datos para gráfico de barras por categoría
        const categoriasData = categoriasUnicas.map(cat => ({
            name: cat,
            valor: movimientos.filter(m => m.categoria === cat).reduce((a, b) => a + b.monto, 0),
            tipo: movimientos.find(m => m.categoria === cat)?.tipo || 'N/A'
        })).filter(c => c.valor > 0)
           .sort((a, b) => b.valor - a.valor);

        // Datos para carteras por sede
        const carteraSedes = sedes.map(s => ({
            name: s.nombre,
            deuda: estudiantes.filter(e => e.sedeId === s.id).reduce((a, b) => a + b.saldoDeudor, 0)
        }));

        const margen = ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0;

        return { ingresos, egresos, balance: ingresos - egresos, cartera, margen, categoriasData, carteraSedes };
    }, [movimientos, estudiantes, sedes]);

    // Paleta de colores dinámica basada en el branding
    const COLORS = [
        configClub.colorPrimario, 
        configClub.colorSecundario, 
        configClub.colorAcento, 
        '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#06b6d4'
    ];

    return (
        <div className="space-y-8 animate-slide-in-right">
            {/* Fila de KPIs Analíticos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-t-4" style={{ borderColor: configClub.colorPrimario }}>
                    <p className="text-xs font-bold text-gray-500 uppercase">Recaudo Neto (Cash)</p>
                    <p className="text-2xl font-black text-tkd-dark dark:text-white">{formatearPrecio(analiticas.ingresos)}</p>
                    <p className="text-[10px] text-green-600 font-bold">Cobrado este periodo</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-t-4 border-orange-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Cartera Pendiente</p>
                    <p className="text-2xl font-black text-orange-600">{formatearPrecio(analiticas.cartera)}</p>
                    <p className="text-[10px] text-orange-400 font-bold">Por cobrar a estudiantes</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-t-4" style={{ borderColor: configClub.colorSecundario }}>
                    <p className="text-xs font-bold text-gray-500 uppercase">Egresos Totales</p>
                    <p className="text-2xl font-black text-tkd-red">{formatearPrecio(analiticas.egresos)}</p>
                    <p className="text-[10px] text-gray-400 font-bold">Operación del club</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-t-4" style={{ borderColor: configClub.colorAcento }}>
                    <p className="text-xs font-bold text-gray-500 uppercase">Margen Operativo</p>
                    <p className="text-2xl font-black text-green-600">{analiticas.margen.toFixed(1)}%</p>
                    <p className="text-[10px] text-green-400 font-bold">Salud financiera actual</p>
                </div>
            </div>

            {/* Gráficos Principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-6" style={{ color: configClub.colorPrimario }}>Balance: Ingresos vs Egresos</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Finanzas', Ingresos: analiticas.ingresos, Egresos: analiticas.egresos }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" hide />
                                <YAxis tickFormatter={(val) => `$${val/1000}k`} />
                                <Tooltip formatter={(val) => formatearPrecio(val as number)} />
                                <Legend />
                                <Bar dataKey="Ingresos" fill={configClub.colorPrimario} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Egresos" fill={configClub.colorSecundario} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-6" style={{ color: configClub.colorPrimario }}>Desglose de Gastos</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analiticas.categoriasData.filter(c => c.tipo === TipoMovimiento.Egreso)}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="valor"
                                >
                                    {analiticas.categoriasData.filter(c => c.tipo === TipoMovimiento.Egreso).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => formatearPrecio(val as number)} />
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InformeVisualEjecutivo;
