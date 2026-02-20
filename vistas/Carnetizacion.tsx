
// vistas/Carnetizacion.tsx
import React, { useState, useMemo } from 'react';
import { useEstudiantes, useSedes, useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { generarLoteCarnetsPdf, FormatoPapel } from '../utils/pdfBatchGenerator';
import { marcarCarnetsComoGenerados } from '../servicios/api';
import { IconoExportar, IconoHistorial, IconoEstudiantes, IconoCasa, IconoAprobar } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import { formatearFecha } from '../utils/formatters';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const VistaCarnetizacion: React.FC = () => {
    const { estudiantes, cargando, cargarEstudiantes } = useEstudiantes();
    const { sedesVisibles } = useSedes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const [procesando, setProcesando] = useState(false);
    const [formato, setFormato] = useState<FormatoPapel>(FormatoPapel.Carta);

    const pendientes = useMemo(() =>
        estudiantes.filter(e => !e.carnetGenerado),
        [estudiantes]);

    const handleGenerarLote = async () => {
        if (pendientes.length === 0) return;
        setProcesando(true);
        try {
            await generarLoteCarnetsPdf(
                pendientes,
                sedesVisibles,
                configClub,
                `Lote_Carnets_${new Date().toISOString().split('T')[0]}`,
                formato
            );
            await marcarCarnetsComoGenerados(pendientes.map(p => p.id));
            mostrarNotificacion("Lote de carnets generado exitosamente. Descarga iniciada.", "success");
            await cargarEstudiantes();
        } catch (error) {
            console.error(error);
            mostrarNotificacion("Error al procesar el lote", "error");
        } finally {
            setProcesando(false);
        }
    };

    if (cargando) return <div className="p-8 flex justify-center"><Loader texto="Analizando registros..." /></div>;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">Emisión Técnica de Carnets</h1>
                    <p className="text-[10px] font-black text-gray-400 mt-3 uppercase tracking-[0.3em]">Gestión de producción gráfica y control de identidad</p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="p-3 bg-tkd-blue/10 rounded-xl"><IconoCasa className="w-5 h-5 text-tkd-blue" /></div>
                    <div className="pr-4">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sede Actual</p>
                        <p className="text-xs font-black dark:text-white uppercase tracking-tight">{sedesVisibles[0]?.nombre || 'Global'}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Acción */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-tkd-dark p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
                        <div className="relative z-10">
                            <h2 className="text-[10px] font-black mb-6 uppercase text-tkd-red tracking-[0.3em]">Cola de Impresión</h2>
                            <div className="flex items-baseline gap-2">
                                <span className="text-7xl font-black tracking-tighter">{pendientes.length}</span>
                                <span className="text-xs font-bold opacity-60 uppercase">Registros</span>
                            </div>

                            <div className="mt-10 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Mesa de Salida (Formato)</label>
                                    <select
                                        value={formato}
                                        onChange={(e) => setFormato(e.target.value as FormatoPapel)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black uppercase tracking-widest outline-none focus:border-tkd-blue transition-all"
                                    >
                                        {Object.values(FormatoPapel).map(f => <option key={f} value={f} className="text-black">{f}</option>)}
                                    </select>
                                </div>

                                <button
                                    onClick={handleGenerarLote}
                                    disabled={pendientes.length === 0 || procesando}
                                    className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-gray-600 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 mt-4"
                                >
                                    {procesando ? (
                                        <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <IconoExportar className="w-5 h-5" />
                                    )}
                                    {procesando ? 'Procesando Lote...' : 'Procesar Impresión'}
                                </button>

                                <button
                                    onClick={async () => {
                                        if (pendientes.length === 0) return;
                                        if (window.confirm(`¿Solicitar a Aliant la fabricación física de ${pendientes.length} carnets?`)) {
                                            setProcesando(true);
                                            try {
                                                const { addDoc, collection } = await import('firebase/firestore');
                                                const { db } = await import('../firebase/config');
                                                await addDoc(collection(db, 'solicitudes_carnets'), {
                                                    tenantId: configClub.tenantId,
                                                    nombreClub: configClub.nombreClub,
                                                    cantidad: pendientes.length,
                                                    sedeNombre: sedesVisibles[0]?.nombre || 'Principal',
                                                    fechaSolicitud: new Date().toISOString()
                                                });
                                                mostrarNotificacion("Solicitud enviada a producción. Aliant recibirá la notificación.", "success");
                                            } catch (e) {
                                                mostrarNotificacion("Error al enviar solicitud", "error");
                                            } finally {
                                                setProcesando(false);
                                            }
                                        }
                                    }}
                                    disabled={pendientes.length === 0 || procesando}
                                    className="w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3 border-b-4 border-blue-900"
                                >
                                    <IconoAprobar className="w-5 h-5" />
                                    Solicitar Fabricación
                                </button>
                            </div>
                        </div>

                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-tkd-blue/20 rounded-full blur-3xl"></div>
                    </div>

                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                        <div className="flex items-center gap-3">
                            <LogoDinamico className="w-6 h-6" />
                            <h3 className="text-[10px] font-black text-tkd-blue uppercase tracking-widest">Estándares de Producción</h3>
                        </div>
                        <ul className="space-y-3">
                            <li className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase leading-relaxed flex gap-2">
                                <span className="text-tkd-blue">•</span> Calidad de inyección: 300 DPI
                            </li>
                            <li className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase leading-relaxed flex gap-2">
                                <span className="text-tkd-blue">•</span> Regla de legibilidad WCAG activa
                            </li>
                            <li className="text-[9px] font-bold text-blue-800 dark:text-blue-300 uppercase leading-relaxed flex gap-2">
                                <span className="text-tkd-blue">•</span> Inclusión de marcas de corte
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Lista de Alumnos en el Lote */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Alumnos en Cola de Impresión</h2>
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-[9px] font-black uppercase tracking-tighter">Pendientes</span>
                        </div>

                        {pendientes.length === 0 ? (
                            <div className="p-12">
                                <EmptyState Icono={IconoHistorial} titulo="Todo al día" mensaje="No hay nuevos alumnos esperando carnet en este momento." />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Estudiante</th>
                                            <th className="px-6 py-4">Grado actual</th>
                                            <th className="px-6 py-4">Sede</th>
                                            <th className="px-6 py-4">Ingreso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {pendientes.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black text-gray-900 dark:text-white uppercase leading-tight">{p.nombres} {p.apellidos}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">ID: {p.numeroIdentificacion}</div>
                                                </td>
                                                <td className="px-6 py-4 text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase">{p.grado}</td>
                                                <td className="px-6 py-4 text-[11px] font-black text-tkd-blue uppercase tracking-tighter">
                                                    {sedesVisibles.find(s => s.id === p.sedeId)?.nombre || 'Sede Local'}
                                                </td>
                                                <td className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase">{p.fechaIngreso}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VistaCarnetizacion;
