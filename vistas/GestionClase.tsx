
// vistas/GestionClase.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSedes } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { escucharAsistenciasActivasSede, actualizarEstadoEntrega } from '../servicios/asistenciaApi';
import { obtenerEstudiantePorId } from '../servicios/api';
import { EstadoEntrega, type Estudiante, RolUsuario } from '../tipos';
import { FRASES_SALIDA } from '../constantes';
import { IconoLogoOficial, IconoAprobar, IconoCerrar, IconoCasa } from '../components/Iconos';
import EscanerAsistencia from '../components/EscanerAsistencia';
import Loader from '../components/Loader';

const VistaGestionClase: React.FC = () => {
    const { usuario } = useAuth();
    const { sedes } = useSedes();
    const { mostrarNotificacion } = useNotificacion();
    
    const [sedeSeleccionadaId, setSedeSeleccionadaId] = useState<string>(usuario?.sedeId || '');
    const [asistencias, setAsistencias] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesandoId, setProcesandoId] = useState<string | null>(null);
    const [modalEntrega, setModalEntrega] = useState<{ asist: any, est: Estudiante } | null>(null);
    const [escanerAbierto, setEscanerAbierto] = useState(false);

    const esAdministrativo = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.Editor;

    useEffect(() => {
        if (!sedeSeleccionadaId) return;

        setCargando(true);
        const desSuscribir = escucharAsistenciasActivasSede(sedeSeleccionadaId, async (data) => {
            try {
                const dataConEstudiante = await Promise.all(data.map(async (a) => {
                    const est = await obtenerEstudiantePorId(a.estudianteId);
                    return { ...a, estudiante: est };
                }));
                setAsistencias(dataConEstudiante);
            } catch (err) {
                mostrarNotificacion("Error al vincular datos de estudiantes", "error");
            } finally {
                setCargando(false);
            }
        });

        return () => desSuscribir();
    }, [sedeSeleccionadaId, mostrarNotificacion]);

    useEffect(() => {
        if (esAdministrativo && !sedeSeleccionadaId && sedes.length > 0) {
            setSedeSeleccionadaId(sedes[0].id);
        }
    }, [esAdministrativo, sedes, sedeSeleccionadaId]);

    const handleMarcarListo = async (asist: any) => {
        setProcesandoId(asist.id);
        try {
            await actualizarEstadoEntrega(asist.id, EstadoEntrega.Listo);
            
            const index = Math.floor(Math.random() * FRASES_SALIDA.length);
            const mensaje = FRASES_SALIDA[index].replace("[ESTUDIANTE]", asist.estudiante.nombres);
            
            const tel = asist.estudiante.tutor?.telefono;
            if (tel) {
                window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
            }
            
            mostrarNotificacion(`${asist.estudiante.nombres} marcado como listo`, "success");
        } catch (error) {
            mostrarNotificacion("Error al actualizar estado", "error");
        } finally {
            setProcesandoId(null);
        }
    };

    const handleConfirmarEntrega = async (persona: string) => {
        if (!modalEntrega) return;
        setProcesandoId(modalEntrega.asist.id);
        try {
            await actualizarEstadoEntrega(modalEntrega.asist.id, EstadoEntrega.Entregado, persona);
            mostrarNotificacion("Entrega confirmada", "success");
            setModalEntrega(null);
        } catch (error) {
            mostrarNotificacion("Error al confirmar entrega", "error");
        } finally {
            setProcesandoId(null);
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-6 max-w-2xl mx-auto animate-fade-in">
            <header className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Clase en Vivo</h1>
                            <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" title="Sincronizado en tiempo real"></span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{asistencias.length} Alumnos presentes</p>
                    </div>
                    <button 
                        onClick={() => setEscanerAbierto(true)}
                        className="p-4 bg-tkd-blue text-white rounded-2xl shadow-lg hover:bg-blue-800 transition-all active:scale-95 group"
                        title="Abrir Cámara para Escaneo"
                    >
                        <IconoLogoOficial className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>

                {esAdministrativo && sedes.length > 0 && (
                    <div className="pt-6 border-t dark:border-gray-700">
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Sede en Monitoreo:</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tkd-blue">
                                <IconoCasa className="w-5 h-5" />
                            </div>
                            <select 
                                value={sedeSeleccionadaId}
                                onChange={(e) => setSedeSeleccionadaId(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl pl-12 pr-10 py-4 text-sm font-black text-gray-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer transition-all"
                            >
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.ciudad})</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 transition-transform group-hover:translate-y-[-40%]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <div className="grid gap-5">
                {cargando ? (
                    <div className="py-12 flex justify-center"><Loader texto="Conectando al dojang..." /></div>
                ) : asistencias.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-[3rem] border-4 border-dashed border-gray-100 dark:border-gray-700">
                        <p className="text-gray-400 font-black uppercase text-xs tracking-widest">No hay alumnos registrados <br/> en esta sede hoy.</p>
                        <button 
                            onClick={() => setEscanerAbierto(true)}
                            className="mt-6 text-tkd-blue font-black uppercase text-[10px] tracking-widest hover:underline"
                        >
                            + Registrar Primera Entrada
                        </button>
                    </div>
                ) : asistencias.map((a) => (
                    <div key={a.id} className={`bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border-2 transition-all duration-300 ${a.estadoEntrega === EstadoEntrega.Listo ? 'border-green-400 shadow-lg shadow-green-400/5' : 'border-transparent hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase leading-tight tracking-tight">{a.estudiante.nombres} {a.estudiante.apellidos}</h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <p className="text-[10px] text-tkd-blue font-black uppercase tracking-tighter">{a.estudiante.grado}</p>
                                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">ID: {a.estudiante.numeroIdentificacion}</p>
                                </div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                a.estadoEntrega === EstadoEntrega.Listo 
                                ? 'bg-green-500 text-white border-green-500 shadow-md shadow-green-500/20' 
                                : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                            }`}>
                                {a.estadoEntrega}
                            </span>
                        </div>

                        <div className="flex gap-3">
                            {a.estadoEntrega === EstadoEntrega.EnClase ? (
                                <button 
                                    onClick={() => handleMarcarListo(a)}
                                    disabled={procesandoId === a.id}
                                    className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-300"
                                >
                                    {procesandoId === a.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-4 h-4" />}
                                    Notificar Salida
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setModalEntrega({ asist: a, est: a.estudiante })}
                                    disabled={procesandoId === a.id}
                                    className="flex-1 bg-tkd-blue text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:bg-gray-300"
                                >
                                    {procesandoId === a.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-4 h-4" />}
                                    Entregar Alumno
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {escanerAbierto && (
                <EscanerAsistencia 
                    sedeId={sedeSeleccionadaId} 
                    onClose={() => setEscanerAbierto(false)} 
                />
            )}

            {modalEntrega && (
                <div className="fixed inset-0 z-[110] bg-tkd-dark/95 flex items-end sm:items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-slide-in-right border border-gray-100 dark:border-white/5">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black uppercase dark:text-white tracking-tight">Verificación de Entrega</h2>
                            <button onClick={() => setModalEntrega(null)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors"><IconoCerrar className="w-6 h-6 text-gray-400" /></button>
                        </div>

                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-6">Confirme que la persona que recoge a <span className="font-black text-tkd-blue">{modalEntrega.est.nombres}</span> está autorizada:</p>
                        
                        <div className="space-y-4 mb-10">
                            <p className="text-[10px] font-black text-tkd-red uppercase tracking-widest ml-1">Personas Autorizadas:</p>
                            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-[1.5rem] border border-gray-100 dark:border-gray-700 shadow-inner">
                                <p className="font-black text-sm text-gray-900 dark:text-gray-200 uppercase leading-relaxed">{modalEntrega.est.personasAutorizadas || "No hay una lista específica registrada. Proceder con el acudiente oficial."}</p>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <button onClick={() => handleConfirmarEntrega("Padre/Tutor Autorizado")} className="w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:bg-blue-800 transition-all active:scale-95">Legalizar Entrega</button>
                            <button onClick={() => setModalEntrega(null)} className="w-full text-gray-400 font-black uppercase text-[10px] tracking-widest py-2 hover:text-gray-600 transition-colors">Cancelar Operación</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VistaGestionClase;
