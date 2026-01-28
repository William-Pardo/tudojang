
// vistas/Certificaciones.tsx
import React, { useState, useMemo } from 'react';
import { useEstudiantes, useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { GradoTKD, GrupoEdad, type Estudiante } from '../tipos';
import { IconoCertificado, IconoBuscar, IconoExportar, IconoInformacion, IconoAprobar, IconoUsuario, IconoHistorial, IconoLogoOficial } from '../components/Iconos';
import { generarCertificadoPdf } from '../utils/certificateGenerator';
import Loader from '../components/Loader';

const PERIODOS = [
    { label: 'Últimos 15 días', dias: 15 },
    { label: 'Últimos 30 días', dias: 30 },
    { label: 'Últimos 60 días', dias: 60 },
    { label: 'Últimos 90 días', dias: 90 },
    { label: 'Últimos 120 días', dias: 120 },
];

const VistaCertificaciones: React.FC = () => {
    const { estudiantes } = useEstudiantes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();

    const [modo, setModo] = useState<'individual' | 'grupal'>('individual');
    const [dirigidoA, setDirigidoA] = useState('A quien interese');
    const [periodo, setPeriodo] = useState(30);
    const [filtroGrado, setFiltroGrado] = useState<GradoTKD | 'todos'>('todos');
    const [filtroGrupo, setFiltroGrupo] = useState<GrupoEdad | 'todos'>('todos');
    const [busqueda, setBusqueda] = useState('');
    const [procesando, setProcesando] = useState(false);

    const estudiantesFiltrados = useMemo(() => {
        return estudiantes.filter(e => {
            const matchGrado = filtroGrado === 'todos' || e.grado === filtroGrado;
            const matchGrupo = filtroGrupo === 'todos' || e.grupo === filtroGrupo;
            const matchBusqueda = !busqueda || `${e.nombres} ${e.apellidos}`.toLowerCase().includes(busqueda.toLowerCase());
            return matchGrado && matchGrupo && matchBusqueda;
        });
    }, [estudiantes, filtroGrado, filtroGrupo, busqueda]);

    const calcularHorasSimuladas = (estudiantesList: Estudiante[]) => {
        const map: Record<string, number> = {};
        estudiantesList.forEach(e => {
            const baseHoras = e.grado.includes('Blanco') ? 10 : 30;
            map[e.id] = Math.floor(Math.random() * 20) + baseHoras;
        });
        return map;
    };

    const handleGenerar = async (estudianteIndividual?: Estudiante) => {
        setProcesando(true);
        mostrarNotificacion("Calculando intensidad horaria...", "info");

        const hoy = new Date();
        const fechaFin = hoy.toISOString().split('T')[0];
        const fechaInicio = new Date(hoy.setDate(hoy.getDate() - periodo)).toISOString().split('T')[0];

        try {
            if (modo === 'individual' && estudianteIndividual) {
                const horasMap = calcularHorasSimuladas([estudianteIndividual]);
                await generarCertificadoPdf({
                    tipo: 'individual',
                    estudiante: estudianteIndividual,
                    horasMap,
                    dirigidoA,
                    fechaInicio,
                    fechaFin
                }, configClub);
            } else {
                if (estudiantesFiltrados.length === 0) {
                    mostrarNotificacion("No hay alumnos que coincidan con los filtros grupales.", "warning");
                    setProcesando(false);
                    return;
                }
                const horasMap = calcularHorasSimuladas(estudiantesFiltrados);
                await generarCertificadoPdf({
                    tipo: 'grupal',
                    estudiantes: estudiantesFiltrados,
                    horasMap,
                    dirigidoA,
                    fechaInicio,
                    fechaFin
                }, configClub);
            }
            mostrarNotificacion("Certificado generado exitosamente.", "success");
        } catch (e) {
            mostrarNotificacion("Error al generar el documento.", "error");
        } finally {
            setProcesando(false);
        }
    };

    const inputClasses = "w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner transition-all placeholder:text-gray-300";
    const selectClasses = "w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl pl-12 pr-10 py-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer transition-all";

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* PANEL DE CONFIGURACIÓN - ESTILO SEDE EN MONITOREO */}
                <div className="lg:col-span-1 space-y-6">
                    <section className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-8 border-b dark:border-gray-700 pb-4">
                            <IconoCertificado className="w-5 h-5 text-tkd-blue" />
                            <h2 className="text-sm font-black uppercase tracking-widest dark:text-white">Emisión Oficial</h2>
                        </div>

                        <div className="space-y-6">
                            {/* Selector de Modo */}
                            <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl flex gap-1 shadow-inner">
                                <button 
                                    onClick={() => setModo('individual')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modo === 'individual' ? 'bg-white dark:bg-gray-800 shadow-md text-tkd-blue scale-[1.02]' : 'text-gray-400'}`}
                                >
                                    Individual
                                </button>
                                <button 
                                    onClick={() => setModo('grupal')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${modo === 'grupal' ? 'bg-white dark:bg-gray-800 shadow-md text-tkd-blue scale-[1.02]' : 'text-gray-400'}`}
                                >
                                    Grupal / Lista
                                </button>
                            </div>

                            {/* Campo Dirigido A */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 block ml-1 tracking-widest">Dirigido a:</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-blue">
                                        <IconoUsuario className="w-5 h-5" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={dirigidoA} 
                                        onChange={e => setDirigidoA(e.target.value)} 
                                        className={inputClasses} 
                                        placeholder="EJ: A QUIEN INTERESE"
                                    />
                                </div>
                            </div>

                            {/* Campo Periodo */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 block ml-1 tracking-widest">Periodo:</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-blue">
                                        <IconoHistorial className="w-5 h-5" />
                                    </div>
                                    <select 
                                        value={periodo} 
                                        onChange={e => setPeriodo(Number(e.target.value))} 
                                        className={selectClasses}
                                    >
                                        {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-transform group-hover:translate-y-[-40%]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Campo Cinturón */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 block ml-1 tracking-widest">Cinturón:</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-blue">
                                        <IconoLogoOficial className="w-5 h-5" />
                                    </div>
                                    <select 
                                        value={filtroGrado} 
                                        onChange={e => setFiltroGrado(e.target.value as any)} 
                                        className={selectClasses}
                                    >
                                        <option value="todos">Todos los Grados</option>
                                        {Object.values(GradoTKD).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-transform group-hover:translate-y-[-40%]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                </div>
                            </div>

                            {modo === 'grupal' && (
                                <button 
                                    onClick={() => handleGenerar()}
                                    disabled={procesando || estudiantesFiltrados.length === 0}
                                    className="w-full bg-tkd-red text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-lg flex items-center justify-center gap-3 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {procesando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoExportar className="w-5 h-5" />}
                                    <span>Emitir Listado Grupal</span>
                                </button>
                            )}
                        </div>
                    </section>

                    <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-800 flex gap-4">
                        <IconoInformacion className="w-5 h-5 text-tkd-blue flex-shrink-0" />
                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase leading-relaxed tracking-tight">
                            Documentación oficial con branding del club y firma autorizada.
                        </p>
                    </div>
                </div>

                {/* LISTADO DE SELECCIÓN / PREVISUALIZACIÓN */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="text-sm font-black uppercase tracking-widest dark:text-white">
                                {modo === 'individual' ? 'Seleccionar Estudiante' : 'Alumnos Incluidos en Grupo'}
                            </h2>
                            <div className="relative w-full sm:w-64">
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR POR NOMBRE..." 
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 rounded-xl text-[10px] font-black uppercase border-none focus:ring-2 focus:ring-tkd-blue transition-all shadow-sm"
                                />
                                <IconoBuscar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] no-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 dark:bg-gray-900 text-[9px] font-black uppercase text-gray-400 tracking-[0.2em] sticky top-0 z-10">
                                    <tr>
                                        <th className="px-8 py-4">Estudiante</th>
                                        <th className="px-6 py-4">Grado & Grupo</th>
                                        <th className="px-8 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {estudiantesFiltrados.map(e => (
                                        <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{e.nombres} {e.apellidos}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase">ID: {e.numeroIdentificacion}</div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-[10px] font-black text-tkd-blue uppercase">{e.grado}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">{e.grupo}</p>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {modo === 'individual' ? (
                                                    <button 
                                                        onClick={() => handleGenerar(e)}
                                                        disabled={procesando}
                                                        className="bg-tkd-dark text-white p-3 rounded-xl hover:bg-tkd-blue transition-all active:scale-95 shadow-md"
                                                        title="Generar Certificado Individual"
                                                    >
                                                        <IconoCertificado className="w-5 h-5" />
                                                    </button>
                                                ) : (
                                                    <div className="p-2.5 text-green-500"><IconoAprobar className="w-5 h-5" /></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {estudiantesFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-20 text-center text-gray-400 font-black uppercase text-xs tracking-widest">
                                                No se encontraron resultados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VistaCertificaciones;
