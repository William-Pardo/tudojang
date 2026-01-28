
// vistas/Carnetizacion.tsx
import React, { useState, useMemo } from 'react';
import { useEstudiantes, useSedes, useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { generarLoteCarnetsPdf } from '../utils/pdfBatchGenerator';
import { marcarCarnetsComoGenerados } from '../servicios/api';
import { IconoLogoOficial, IconoExportar, IconoHistorial, IconoEstudiantes } from '../components/Iconos';
import { formatearFecha } from '../utils/formatters';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const VistaCarnetizacion: React.FC = () => {
    const { estudiantes, cargando, cargarEstudiantes } = useEstudiantes();
    const { sedes } = useSedes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const [procesando, setProcesando] = useState(false);

    const pendientes = useMemo(() => 
        estudiantes.filter(e => !e.carnetGenerado),
    [estudiantes]);

    const handleGenerarLote = async () => {
        if (pendientes.length === 0) return;
        setProcesando(true);
        try {
            await generarLoteCarnetsPdf(pendientes, sedes, configClub, `Lote_Carnets_${new Date().toISOString().split('T')[0]}`);
            await marcarCarnetsComoGenerados(pendientes.map(p => p.id));
            mostrarNotificacion("Lote de carnets generado exitosamente. Descarga iniciada.", "success");
            await cargarEstudiantes();
        } catch (error) {
            mostrarNotificacion("Error al procesar el lote", "error");
        } finally {
            setProcesando(false);
        }
    };

    if (cargando) return <div className="p-8 flex justify-center"><Loader texto="Analizando registros..." /></div>;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-fade-in">
            <header>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Emisión de Carnets por Lote</h1>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">Gestiona la impresión masiva para nuevos integrantes</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Acción */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                        <h2 className="text-[10px] font-black mb-1 uppercase text-gray-400 tracking-[0.2em]">Próximo Lote</h2>
                        <div className="text-6xl font-black text-gray-900 dark:text-white mb-2">{pendientes.length}</div>
                        <p className="text-[10px] text-tkd-blue font-black uppercase mb-8 tracking-widest">Alumnos esperando carnet</p>
                        
                        <button 
                            onClick={handleGenerarLote}
                            disabled={pendientes.length === 0 || procesando}
                            className="w-full bg-tkd-red text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-gray-300 disabled:scale-100 flex items-center justify-center gap-3"
                        >
                            {procesando ? (
                                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <IconoExportar className="w-6 h-6" />
                            )}
                            {procesando ? 'Procesando...' : 'Generar Carnets'}
                        </button>
                        
                        <p className="mt-6 text-[9px] text-gray-400 text-center font-bold uppercase tracking-tighter leading-relaxed">
                            Formato estándar CR80 (85.6mm x 54mm)
                        </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <h3 className="text-xs font-black text-tkd-blue mb-2 flex items-center gap-2 uppercase tracking-wider">
                            <IconoLogoOficial className="w-4 h-4" /> Recomendación Sabonim
                        </h3>
                        <p className="text-[11px] text-blue-800 dark:text-blue-300 font-bold leading-relaxed uppercase">
                            Este proceso marcará a los alumnos como carnetizados automáticamente en su ficha técnica.
                        </p>
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
                                                    {sedes.find(s => s.id === p.sedeId)?.nombre || 'Sede Local'}
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
