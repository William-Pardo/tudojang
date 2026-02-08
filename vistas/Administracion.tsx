
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
        <div className="p-4 sm:p-8 space-y-8 animate-fade-in">
            <header className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Centro de Administración</h1>
                    <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-[0.2em]">Monitoreo de salud financiera y operativa</p>
                </div>
            </header>

            {/* BARRA DE PESTAÑAS: ICONOS EN MÓVIL (H/V), ICONO+TEXTO EN PC */}
            <div className="flex flex-row overflow-x-auto no-scrollbar items-center p-1 bg-white dark:bg-gray-800 rounded-full md:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-fit justify-around md:justify-start">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as AdminTab)}
                        className={`flex-shrink-0 flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-2.5 rounded-full md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white text-tkd-dark shadow-xl scale-[1.02] border border-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        title={tab.label}
                    >
                        <tab.icono className={`w-5 h-5 md:w-4 md:h-4 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                        <span className="hidden md:inline">{tab.label}</span>
                    </button>
                ))}
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
