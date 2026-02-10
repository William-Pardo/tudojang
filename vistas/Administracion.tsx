
// vistas/Administracion.tsx
import React, { useState } from 'react';
import VistaDashboard from './Dashboard';
import VistaFinanzas from './Finanzas';
import VistaHorarios from './Horarios';
import { IconoDashboard, IconoAprobar, IconoExportar, IconoCampana, IconoLogoOficial } from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { useEstudiantes, useConfiguracion } from '../context/DataContext';
import { EstadoPago } from '../tipos';

type AdminTab = 'resumen' | 'tesoreria' | 'horarios' | 'analisis';

const VistaAdministracion: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('resumen');
    const { estudiantes, actualizarEstudiante } = useEstudiantes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const [procesandoMora, setProcesandoMora] = useState(false);

    const tabs = [
        { id: 'resumen', label: 'Resumen', icono: IconoDashboard },
        { id: 'tesoreria', label: 'Tesorería', icono: IconoAprobar },
        { id: 'horarios', label: 'Agenda', icono: IconoCampana },
        { id: 'analisis', label: 'Análisis', icono: IconoExportar },
    ];

    const aplicarRecargosMora = async () => {
        const vencidos = estudiantes.filter(e => e.estadoPago === EstadoPago.Vencido && e.saldoDeudor > 0);
        if (vencidos.length === 0) {
            mostrarNotificacion("No hay estudiantes con cartera vencida hoy.", "info");
            return;
        }

        setProcesandoMora(true);
        try {
            const porcentaje = configClub?.moraPorcentaje || 5; // Fallback 5%
            for (const est of vencidos) {
                const recargo = Math.round(est.saldoDeudor * (porcentaje / 100));
                await actualizarEstudiante({
                    ...est,
                    saldoDeudor: est.saldoDeudor + recargo,
                    // Se podría inyectar una nota en el historial aquí
                });
            }
            mostrarNotificacion(`Recargos del ${porcentaje}% aplicados a ${vencidos.length} alumnos.`, "success");
        } catch (e) {
            mostrarNotificacion("Fallo al procesar sobrecargos masivos.", "error");
        } finally {
            setProcesandoMora(false);
        }
    };

    return (
        <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
            <header className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">Administración</h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Monitoreo de Salud Institucional</p>
                </div>

                {/* ACCIÓN DE MORA ESTRATÉGICA */}
                <button
                    onClick={aplicarRecargosMora}
                    disabled={procesandoMora}
                    className="bg-white dark:bg-gray-800 border-2 border-tkd-red/20 hover:border-tkd-red px-8 py-4 rounded-2xl font-black uppercase text-[10px] text-tkd-red tracking-widest shadow-soft transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                >
                    {procesandoMora ? <div className="w-4 h-4 border-2 border-tkd-red border-t-transparent rounded-full animate-spin"></div> : <IconoLogoOficial className="w-4 h-4" />}
                    Ejecutar Sobrecargos Mora ({configClub?.moraPorcentaje || 5}%)
                </button>
            </header>

            {/* SUBMENÚ PREMIUM: Estilo Hardware Segmented Control */}
            <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 w-full md:w-fit">
                <div className="flex flex-row overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`flex-shrink-0 flex items-center justify-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? 'bg-tkd-dark text-white shadow-xl scale-[1.03] z-10'
                                : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            <tab.icono className={`w-4 h-4 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO DINÁMICO */}
            <div className="min-h-[500px]">
                {activeTab === 'resumen' && <VistaDashboard isSubView={true} />}
                {activeTab === 'tesoreria' && <VistaFinanzas isSubView={true} initialView="diario" />}
                {activeTab === 'horarios' && <VistaHorarios />}
                {activeTab === 'analisis' && <VistaFinanzas isSubView={true} initialView="analitica" />}
            </div>
        </div>
    );
};

export default VistaAdministracion;
