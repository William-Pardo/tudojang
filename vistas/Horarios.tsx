
// vistas/Horarios.tsx
import React, { useState } from 'react';
import { useProgramas, useSedes, useConfiguracion } from '../context/DataContext';
// Added fix: Imported IconoInformacion from Icons module.
import { IconoCasa, IconoUsuario, IconoCampana, IconoAgregar, IconoInformacion } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const VistaHorarios: React.FC = () => {
    const { programas } = useProgramas();
    const { sedes } = useSedes();
    const { configClub } = useConfiguracion();
    const [filtroSede, setFiltroSede] = useState('todas');

    return (
        <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Agenda Técnica</h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Planificación de Clases y Uso de Sedes</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <select
                        value={filtroSede}
                        onChange={(e) => setFiltroSede(e.target.value)}
                        className="bg-white dark:bg-gray-800 border-none rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest shadow-sm focus:ring-2 focus:ring-tkd-blue outline-none"
                    >
                        <option value="todas">Todas las Sedes</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                </div>
            </header>

            {/* REJILLA MARCIAL PREMIUM */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {DIAS.map(dia => (
                    <div key={dia} className="space-y-4">
                        <div className="bg-tkd-dark text-white p-4 rounded-2xl text-center shadow-lg border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{dia}</p>
                        </div>

                        <div className="space-y-3">
                            {programas
                                .filter(p => p.horario.includes(dia)) // Simulación basada en texto legacy
                                .map(p => (
                                    <div key={p.id} className="bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-soft hover:shadow-premium transition-all group overflow-hidden relative">
                                        <div className="relative z-10 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="p-2 bg-tkd-blue/10 rounded-xl text-tkd-blue">
                                                    <LogoDinamico className="w-4 h-4" />
                                                </div>
                                                <span className="text-[8px] font-black text-tkd-red uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">PM</span>
                                            </div>
                                            <div>
                                                <h4 className="text-[11px] font-black uppercase text-gray-900 dark:text-white leading-tight">{p.nombre}</h4>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Sede Principal</p>
                                            </div>
                                            <div className="pt-2 border-t dark:border-white/5">
                                                <p className="text-[9px] font-black text-tkd-blue uppercase">{p.horario.split(dia)[1] || '6:00 PM'}</p>
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                                            <LogoDinamico className="w-16 h-16" />
                                        </div>
                                    </div>
                                ))}

                            <button className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center text-gray-300 hover:border-tkd-blue hover:text-tkd-blue transition-all">
                                <IconoAgregar className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-md">
                        <IconoInformacion className="w-8 h-8 text-tkd-blue" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase text-tkd-blue tracking-tight">Capacidad Operativa</h3>
                        <p className="text-[10px] font-bold text-blue-600/60 uppercase">Monitoreo de ocupación por metros cuadrados en sedes activas.</p>
                    </div>
                </div>
                <div className="flex gap-8">
                    <div className="text-center">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">85%</p>
                        <p className="text-[8px] font-black text-gray-400 uppercase">Ocupación Promedio</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-black text-tkd-red">12</p>
                        <p className="text-[8px] font-black text-gray-400 uppercase">Clases / Semana</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VistaHorarios;
