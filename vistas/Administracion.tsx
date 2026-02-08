
// vistas/Administracion.tsx
import React, { useState } from 'react';
import VistaDashboard from './Dashboard';
import VistaFinanzas from './Finanzas';
import { IconoDashboard, IconoAprobar, IconoExportar } from '../components/Iconos';

type AdminTab = 'resumen' | 'tesoreria' | 'analisis';

const VistaAdministracion: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('resumen');

    const tabs = [
        { id: 'resumen', label: 'Resumen', icono: IconoDashboard },
        { id: 'tesoreria', label: 'Tesorería', icono: IconoAprobar },
        { id: 'analisis', label: 'Análisis', icono: IconoExportar },
    ];

    return (
        <div className="p-4 sm:p-12 space-y-12 bg-tkd-gray dark:bg-gray-950 min-h-screen animate-fade-in">
            <header className="mb-2">
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Centro de Administración</h1>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Monitoreo de salud financiera y operativa</p>
            </header>

            {/* BARRA DE PESTAÑAS: SEGMENTED CONTROL / NEUMORFISMO SUAVE */}
            <div className="bg-white dark:bg-gray-800 p-1 rounded-full md:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full md:w-fit overflow-hidden">
                <div className="flex flex-row overflow-x-auto no-scrollbar gap-1 p-0.5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`flex-shrink-0 flex items-center justify-center gap-4 px-8 py-3 rounded-full md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-tkd-dark text-white shadow-lg scale-[1.02] z-10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icono className={`w-5 h-5 md:w-4 md:h-4 transition-colors ${activeTab === tab.id ? 'text-tkd-red' : 'text-gray-400'}`} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO DINÁMICO */}
            <div className="min-h-[400px]">
                {activeTab === 'resumen' && <VistaDashboard isSubView={true} />}
                {activeTab === 'tesoreria' && <VistaFinanzas isSubView={true} initialView="diario" />}
                {activeTab === 'analisis' && <VistaFinanzas isSubView={true} initialView="analitica" />}
            </div>
        </div>
    );
};

export default VistaAdministracion;
