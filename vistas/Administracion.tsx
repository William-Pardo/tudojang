
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
        <div className="p-4 sm:p-12 space-y-12 bg-[#0D121F] min-h-screen text-white animate-fade-in">
            <header className="mb-2">
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Centro de Administración</h1>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Monitoreo de salud financiera y operativa</p>
            </header>

            {/* BARRA DE PESTAÑAS: ICONOS EN MÓVIL (H/V), ICONO+TEXTO EN PC */}
            <div className="bg-[#1A2232] p-2 rounded-[2.2rem] shadow-2xl border border-white/5 w-full md:w-fit overflow-hidden">
                <div className="flex flex-row overflow-x-auto no-scrollbar gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as AdminTab)}
                            className={`flex-shrink-0 flex items-center justify-center gap-4 px-8 py-4 md:py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab.id ? 'bg-tkd-blue text-white shadow-2xl scale-[1.02] z-10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            title={tab.label}
                        >
                            <tab.icono className={`w-5 h-5 md:w-4 md:h-4 ${activeTab === tab.id ? 'text-tkd-red' : ''}`} />
                            <span className="hidden md:inline">{tab.label}</span>
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
