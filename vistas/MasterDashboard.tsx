
// vistas/MasterDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { obtenerTodosLosTenants, cambiarEstadoSuscripcionTenant } from '../servicios/configuracionApi';
import { obtenerMisiones, crearMisionKicho, inyectarEstudiantesKicho, obtenerRegistrosMision } from '../servicios/censoApi';
import { escucharTicketsActivos, actualizarTicket } from '../servicios/soporteApi';
import { enviarNotificacion } from '../servicios/api';
import { ConfiguracionClub, MisionKicho, RegistroTemporal, TicketSoporte, EtapaSoporte } from '../tipos';
import {
    IconoLogoOficial, IconoAprobar, IconoRechazar, IconoDashboard,
    IconoInformacion, IconoCasa, IconoEstudiantes, IconoUsuario,
    IconoCampana, IconoEnviar, IconoFirma, IconoAgregar, IconoCerrar, IconoGuardar,
    IconoWhatsApp
} from '../components/Iconos';
import { useNotificacion } from '../context/NotificacionContext';
import { useAnalytics } from '../context/AnalyticsContext';
import Loader from '../components/Loader';
import ToggleSwitch from '../components/ToggleSwitch';

const VistaMasterDashboard: React.FC = () => {
    const [tenants, setTenants] = useState<ConfiguracionClub[]>([]);
    const [misiones, setMisiones] = useState<MisionKicho[]>([]);
    const [tickets, setTickets] = useState<TicketSoporte[]>([]);
    const [cargando, setCargando] = useState(true);
    const [tabActiva, setTabActiva] = useState<'ecosistema' | 'kicho-central' | 'soporte-premium' | 'ux-analytics'>('soporte-premium');

    // UI States
    const [modalNuevaMision, setModalNuevaMision] = useState(false);
    const [misionAProcesar, setMisionAProcesar] = useState<MisionKicho | null>(null);
    const [registrosAProcesar, setRegistrosAProcesar] = useState<RegistroTemporal[]>([]);
    const [procesandoInyeccion, setProcesandoInyeccion] = useState(false);

    // Form State para nueva misión
    const [nuevaMision, setNuevaMision] = useState({
        tenantId: '',
        nombre: 'CENSO ESTUDIANTIL 2024',
        fechaVencimiento: '',
        horaVencimiento: '23:59'
    });

    const { mostrarNotificacion } = useNotificacion();
    const { heatmapActivo, setHeatmapActivo, puntos, limpiarDatos } = useAnalytics();

    const cargarDatos = async () => {
        setCargando(true);
        try {
            const [dataT, dataM] = await Promise.all([obtenerTodosLosTenants(), obtenerMisiones()]);
            setTenants(dataT);
            setMisiones(dataM);
        } catch (e: any) {
            mostrarNotificacion("Error al cargar ecosistema global", "error");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatos();
        const desSuscribirTickets = escucharTicketsActivos(setTickets);
        return () => desSuscribirTickets();
    }, []);

    const handleCrearMision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevaMision.tenantId || !nuevaMision.fechaVencimiento) {
            mostrarNotificacion("Completa todos los campos del protocolo", "warning");
            return;
        }

        try {
            const fechaExp = `${nuevaMision.fechaVencimiento}T${nuevaMision.horaVencimiento}:00`;
            await crearMisionKicho({
                tenantId: nuevaMision.tenantId,
                nombreMision: nuevaMision.nombre.toUpperCase(),
                fechaExpiracion: fechaExp,
            });

            const club = tenants.find(t => t.tenantId === nuevaMision.tenantId);
            if (club?.emailClub) {
                await enviarNotificacion('Email', club.emailClub, `Maestro ${club.representanteLegal}, se ha habilitado el Protocolo KICHO para su dojang.`);
            }

            mostrarNotificacion("Misión enviada exitosamente al dojang", "success");
            setModalNuevaMision(false);
            cargarDatos();
        } catch (e: any) {
            mostrarNotificacion("Fallo en la creación del formulario", "error");
        }
    };

    const handleCambiarEstadoTenant = async (id: string, actual: ConfiguracionClub['estadoSuscripcion']) => {
        const nuevo = actual === 'activo' ? 'suspendido' : 'activo';
        try {
            await cambiarEstadoSuscripcionTenant(id, nuevo);
            setTenants(prev => prev.map(t => t.tenantId === id ? { ...t, estadoSuscripcion: nuevo } : t));
            mostrarNotificacion(`Estado de academia actualizado a ${nuevo}`, "success");
        } catch (e: any) { mostrarNotificacion("Error al cambiar estado", "error"); }
    };

    const abrirHomologador = async (mision: MisionKicho) => {
        const regs = await obtenerRegistrosMision(mision.id);
        const verificados = regs.filter(r => r.estado === 'verificado');
        setRegistrosAProcesar(verificados);
        setMisionAProcesar(mision);
    };

    const ejecutarInyeccionAliant = async () => {
        if (!misionAProcesar) return;
        setProcesandoInyeccion(true);
        try {
            await inyectarEstudiantesKicho(misionAProcesar.id, registrosAProcesar);
            mostrarNotificacion("Protocolo finalizado. Datos inyectados al núcleo oficial.", "success");
            setMisionAProcesar(null);
            cargarDatos();
        } catch (e: any) { mostrarNotificacion("Error en proceso de inyección", "error"); }
        finally { setProcesandoInyeccion(false); }
    };

    const avanzarEtapaSoporte = async (t: TicketSoporte) => {
        if (t.etapa >= EtapaSoporte.Verificado) return;
        const nuevaEtapa = t.etapa + 1;
        await actualizarTicket(t.id, { etapa: nuevaEtapa, estado: 'proceso' });
        mostrarNotificacion(`Ticket avanzado a etapa: ${EtapaSoporte[nuevaEtapa]}`, "success");
    };

    const activarSalaVideo = async (t: TicketSoporte) => {
        const salaUrl = `https://meet.jit.si/TudojangSupport_${t.id.slice(-6)}`;
        await actualizarTicket(t.id, { salaVideoUrl: salaUrl, etapa: EtapaSoporte.Resolucion });
        window.open(salaUrl, '_blank');
        mostrarNotificacion("Sala de video activada e inyectada al tenant", "info");
    };

    const cerrarTicket = async (t: TicketSoporte) => {
        await actualizarTicket(t.id, { estado: 'resuelto', etapa: EtapaSoporte.Verificado });
        mostrarNotificacion("Ticket cerrado exitosamente", "success");
    };

    if (cargando) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader texto="Accediendo a la Consola Maestra..." /></div>;

    const selectClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-tkd-blue focus:border-tkd-blue transition-all outline-none text-sm font-bold uppercase";
    const inputClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-tkd-blue focus:border-tkd-blue transition-all outline-none text-sm font-bold";

    return (
        <div className="p-4 sm:p-10 space-y-12 bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-900 dark:text-white animate-fade-in pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-tkd-blue/10 rounded-xl border border-tkd-blue/20 dark:bg-tkd-blue/20 dark:border-tkd-blue/30"><IconoDashboard className="w-8 h-8 text-tkd-blue" /></div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter">Aliant <span className="text-tkd-blue">Control Tower</span></h1>
                    </div>
                </div>

                <div className="flex items-center bg-white dark:bg-white/5 p-1 rounded-2xl border border-gray-200 dark:border-white/10 overflow-x-auto no-scrollbar shadow-sm">
                    {[
                        { id: 'soporte-premium', label: 'Soporte Master' },
                        { id: 'kicho-central', label: 'Kicho Central' },
                        { id: 'ecosistema', label: 'Ecosistema' },
                        { id: 'ux-analytics', label: 'UX Analytics' }
                    ].map((t) => (
                        <button key={t.id} onClick={() => setTabActiva(t.id as any)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${tabActiva === t.id ? 'bg-tkd-blue text-white shadow-lg' : 'text-gray-400 dark:text-gray-500 hover:text-tkd-blue dark:hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* SECCIÓN: SOPORTE PREMIUM MASTER */}
            {tabActiva === 'soporte-premium' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-1 bg-white dark:bg-white/5 p-8 rounded-[3rem] border border-gray-200 dark:border-white/10 shadow-sm space-y-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-tkd-blue border-b pb-4">Consola de Mando</h3>
                            <div className="space-y-4">
                                <div className="bg-gray-50 dark:bg-black/30 p-5 rounded-3xl text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Tickets Pendientes</p>
                                    <p className="text-4xl font-black text-tkd-red">{tickets.length}</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-3xl text-center border border-green-100 dark:border-green-900/30">
                                    <p className="text-[10px] font-black text-green-600 uppercase mb-1">Tu Estatus</p>
                                    <p className="text-xs font-black text-green-700 uppercase">Online Advisor</p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-3 bg-white dark:bg-white/5 rounded-[3rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-xl">
                            <div className="p-8 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Bandeja de Incidentes Técnicos</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                {tickets.map(t => (
                                    <div key={t.id} className="p-8 bg-white dark:bg-white/[0.03] rounded-[2.5rem] border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col md:flex-row justify-between gap-8">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter border ${t.estado === 'abierto' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                        {t.estado} - Etapa {t.etapa}
                                                    </span>
                                                    <span className="text-[9px] font-black text-tkd-blue uppercase tracking-widest">{t.userNombre} (@{t.tenantId})</span>
                                                </div>
                                                <h4 className="text-lg font-black uppercase tracking-tight">{t.asunto}</h4>
                                                <div className="p-4 bg-gray-50 dark:bg-black/40 rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Resumen Contextual IA:</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium italic">"{t.resumenIA.split('\n').slice(-2).join(' ')}"</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row md:flex-col gap-3 justify-center min-w-[180px]">
                                                <button
                                                    onClick={() => avanzarEtapaSoporte(t)}
                                                    className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <IconoAprobar className="w-4 h-4" /> Avanzar Etapa
                                                </button>
                                                <button
                                                    onClick={() => activarSalaVideo(t)}
                                                    className="bg-tkd-dark text-white dark:bg-white/10 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-tkd-red transition-all flex items-center justify-center gap-2"
                                                >
                                                    <IconoWhatsApp className="w-4 h-4 text-tkd-red" /> Iniciar Video
                                                </button>
                                                <button
                                                    onClick={() => cerrarTicket(t)}
                                                    className="text-gray-400 hover:text-green-500 font-black uppercase text-[9px] tracking-widest pt-2 transition-colors"
                                                >
                                                    Marcar como Resuelto
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {tickets.length === 0 && (
                                    <div className="py-20 text-center opacity-30 grayscale">
                                        <IconoCampana className="w-16 h-16 mx-auto mb-4" />
                                        <p className="text-xs font-black uppercase tracking-widest">Sin solicitudes pendientes en el servidor</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN: ECOSISTEMA TUDOJANG */}
            {tabActiva === 'ecosistema' && (
                <section className="bg-white dark:bg-white/5 rounded-[3rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-xl animate-fade-in">
                    <div className="p-8 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-black/20">
                        <div className="flex items-center gap-3">
                            <IconoCasa className="w-5 h-5 text-gray-400" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Ecosistema Académico</h2>
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase">{tenants.length} Dojangs Registrados</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-black/40 text-[9px] font-black uppercase text-gray-500 tracking-widest">
                                <tr>
                                    <th className="px-8 py-5">Dojang / Identidad</th>
                                    <th className="px-6 py-5">Plan de Licencia</th>
                                    <th className="px-6 py-5">Vencimiento</th>
                                    <th className="px-8 py-5 text-right">Status / Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {tenants.map(t => (
                                    <tr key={t.tenantId} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6">
                                            <p className="font-black text-sm uppercase group-hover:text-tkd-blue transition-colors">{t.nombreClub}</p>
                                            <p className="text-[9px] font-black text-gray-500 uppercase mt-1">{t.slug}.tudojang.com</p>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full text-[9px] font-black uppercase border border-gray-200 dark:border-white/5">{t.plan}</span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <p className="text-xs font-bold text-gray-400">{t.fechaVencimiento}</p>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-4">
                                                <span className={`text-[10px] font-black uppercase ${t.estadoSuscripcion === 'activo' ? 'text-green-600 dark:text-green-400' : 'text-tkd-red'}`}>{t.estadoSuscripcion}</span>
                                                <button
                                                    onClick={() => handleCambiarEstadoTenant(t.tenantId, t.estadoSuscripcion)}
                                                    className={`w-12 h-6 rounded-full relative transition-colors ${t.estadoSuscripcion === 'activo' ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${t.estadoSuscripcion === 'activo' ? 'right-1' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* SECCIÓN: KICHO CENTRAL (FORM ADMIN) */}
            {tabActiva === 'kicho-central' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-tkd-blue/5 dark:bg-tkd-blue/10 border border-tkd-blue/20 p-8 rounded-[3rem] gap-6 shadow-sm">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-tkd-blue/10 dark:bg-tkd-blue/20 rounded-2xl flex items-center justify-center"><IconoCampana className="w-8 h-8 text-tkd-blue" /></div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter">Administrador de Formularios KICHO</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Gestión Global de Captura de Datos</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setModalNuevaMision(true)}
                            className="bg-tkd-blue text-white dark:bg-white dark:text-tkd-blue px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                        >
                            <IconoAgregar className="w-5 h-5" /> Iniciar Nuevo Protocolo
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-white/5 rounded-[3rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                            <div className="p-8 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Forms en Proceso de Captura</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                {misiones.filter(m => m.estadoLote === 'captura').map(m => (
                                    <div key={m.id} className="p-6 bg-gray-50 dark:bg-white/[0.03] rounded-3xl border border-gray-100 dark:border-white/5 flex justify-between items-center hover:shadow-md transition-all">
                                        <div>
                                            <p className="text-[9px] font-black text-tkd-blue uppercase tracking-widest mb-1">{tenants.find(t => t.tenantId === m.tenantId)?.nombreClub}</p>
                                            <h4 className="font-black uppercase text-sm">{m.nombreMision}</h4>
                                            <p className="text-[8px] text-gray-500 uppercase mt-2">Cierra: {new Date(m.fechaExpiracion).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-tkd-blue dark:text-white">{m.registrosRecibidos}</div>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase">Recibidos</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-white/5 rounded-[3rem] border border-tkd-red/10 dark:border-tkd-red/20 overflow-hidden shadow-[0_0_50px_rgba(205,46,58,0.05)] dark:shadow-[0_0_50px_rgba(205,46,58,0.1)]">
                            <div className="p-8 border-b border-tkd-red/5 dark:border-tkd-red/10 bg-tkd-red/[0.02] dark:bg-tkd-red/5">
                                <h3 className="text-xs font-black uppercase tracking-widest text-tkd-red">Lotes Listos para Inyectar</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                {misiones.filter(m => m.estadoLote === 'legalizado').map(m => (
                                    <div key={m.id} className="p-6 bg-white dark:bg-white/[0.05] rounded-3xl border border-gray-100 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-tkd-red/10 dark:bg-tkd-red/20 rounded-xl flex items-center justify-center text-tkd-red"><IconoFirma className="w-5 h-5" /></div>
                                            <div>
                                                <p className="text-[9px] font-black text-tkd-blue uppercase tracking-widest mb-1">{tenants.find(t => t.tenantId === m.tenantId)?.nombreClub}</p>
                                                <h4 className="font-black uppercase text-sm">{m.nombreMision}</h4>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => abrirHomologador(m)}
                                            className="bg-tkd-blue text-white px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:bg-blue-800 transition-all"
                                        >
                                            Homologar Datos
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN: UX ANALYTICS (HEATMAPS) */}
            {tabActiva === 'ux-analytics' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white dark:bg-white/5 p-10 rounded-[3rem] border border-gray-200 dark:border-white/10 space-y-10 shadow-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Motor de Analítica Visual</h2>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Supervisión de Interacción en Tiempo Real</p>
                            </div>
                            <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/40 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activar Capa de Calor</span>
                                <ToggleSwitch checked={heatmapActivo} onChange={setHeatmapActivo} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-50 dark:bg-black/30 p-6 rounded-3xl border border-gray-100 dark:border-white/5 text-center">
                                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Eventos Capturados</p>
                                <p className="text-4xl font-black text-tkd-blue">{puntos.length}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-black/30 p-6 rounded-3xl border border-gray-100 dark:border-white/5 text-center">
                                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Puntos Calientes (Clics)</p>
                                <p className="text-4xl font-black text-tkd-red">{puntos.filter(p => p.tipo === 'click').length}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-black/30 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col justify-center px-8">
                                <button onClick={limpiarDatos} className="w-full py-3 bg-white dark:bg-white/5 text-gray-400 rounded-xl font-black uppercase text-[10px] hover:text-tkd-red transition-colors border border-gray-200 dark:border-none shadow-sm">Limpiar Base Analítica</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ... modales existentes (misión, homologador) ... */}
            <AnimatePresence>
                {modalNuevaMision && (
                    <div className="fixed inset-0 z-[200] bg-tkd-dark/90 dark:bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-white/10"
                        >
                            <header className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Generador de Formulario KICHO</h3>
                                <button onClick={() => setModalNuevaMision(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all">
                                    <IconoCerrar className="w-6 h-6 text-gray-400" />
                                </button>
                            </header>

                            <form onSubmit={handleCrearMision} className="p-10 space-y-8 overflow-y-auto">
                                <fieldset className="border border-tkd-blue/20 p-6 rounded-2xl bg-blue-50/20 dark:bg-blue-900/5 space-y-6">
                                    <legend className="text-sm font-black uppercase text-tkd-blue px-3 bg-white dark:bg-gray-900 ml-4">Configuración del Protocolo</legend>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Dojang Destino</label>
                                        <select
                                            required
                                            value={nuevaMision.tenantId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNuevaMision({ ...nuevaMision, tenantId: e.target.value })}
                                            className={selectClasses}
                                        >
                                            <option value="">Elegir Dojang...</option>
                                            {tenants.map(t => <option key={t.tenantId} value={t.tenantId}>{t.nombreClub}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Título de Campaña</label>
                                        <input
                                            type="text" required
                                            value={nuevaMision.nombre}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaMision({ ...nuevaMision, nombre: e.target.value })}
                                            className={inputClasses}
                                            placeholder="EJ: CENSO DE APERTURA JUNIO 2024"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Fecha Cierre</label>
                                            <input
                                                type="date" required
                                                value={nuevaMision.fechaVencimiento}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaMision({ ...nuevaMision, fechaVencimiento: e.target.value })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 ml-1 tracking-widest">Hora Cierre</label>
                                            <input
                                                type="time" required
                                                value={nuevaMision.horaVencimiento}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNuevaMision({ ...nuevaMision, horaVencimiento: e.target.value })}
                                                className={inputClasses}
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-5 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 flex gap-4">
                                    <IconoInformacion className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                    <p className="text-[10px] font-bold text-yellow-800 dark:text-yellow-400 uppercase leading-relaxed">
                                        Al enviar este protocolo, el sistema notificará al director de la sede y activará el QR de recepción en su panel de administración.
                                    </p>
                                </div>
                            </form>

                            <footer className="p-8 border-t border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-gray-800/30">
                                <button type="button" onClick={() => setModalNuevaMision(false)} className="px-6 py-2 text-xs font-black uppercase text-gray-400 hover:text-tkd-red transition-all">Cancelar</button>
                                <button
                                    onClick={handleCrearMision}
                                    className="bg-tkd-blue text-white px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-800 active:scale-95 transition-all flex items-center gap-3"
                                >
                                    <IconoEnviar className="w-5 h-5" /> Iniciar Misión
                                </button>
                            </footer>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {misionAProcesar && (
                    <div className="fixed inset-0 z-[200] bg-tkd-dark/95 dark:bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in overflow-hidden">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-6xl h-full max-h-[90vh] rounded-[4rem] border border-gray-100 dark:border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.3)] flex flex-col">
                            <header className="p-10 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">Laboratorio de Homologación KICHO</h2>
                                    <p className="text-[10px] font-black text-tkd-red uppercase tracking-[0.4em] mt-2">Dojang: {tenants.find(t => t.tenantId === misionAProcesar.tenantId)?.nombreClub}</p>
                                </div>
                                <button onClick={() => setMisionAProcesar(null)} className="p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><IconoCerrar className="w-8 h-8 text-gray-400" /></button>
                            </header>

                            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-3xl border border-gray-100 dark:border-white/5 space-y-4 text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Firma de Origen:</p>
                                        <img src={misionAProcesar.firmaLegalizacion} className="h-24 bg-white dark:bg-white/10 rounded-xl p-2 mx-auto dark:invert" alt="Firma legalización" />
                                        <p className="text-[8px] font-bold text-tkd-blue uppercase">Certificado por el Sabonim</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-3xl border border-gray-100 dark:border-white/5 flex flex-col justify-center text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Registros a Inyectar:</p>
                                        <p className="text-5xl font-black text-tkd-blue">{registrosAProcesar.length}</p>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase mt-2">Expedientes Limpios</p>
                                    </div>
                                    <div className="bg-blue-500/5 p-8 rounded-3xl border border-blue-500/10 flex flex-col justify-center">
                                        <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-4">Protocolos Aliant:</p>
                                        <ul className="text-[9px] font-bold text-gray-500 dark:text-gray-400 space-y-2 uppercase">
                                            <li className="flex items-center gap-2"><IconoAprobar className="w-3 h-3 text-green-500" /> Normalización UPPERCASE</li>
                                            <li className="flex items-center gap-2"><IconoAprobar className="w-3 h-3 text-green-500" /> Limpieza de Whitespace</li>
                                            <li className="flex items-center gap-2"><IconoAprobar className="w-3 h-3 text-green-500" /> Validación de ID Único</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-black/30 rounded-[2.5rem] border border-gray-200 dark:border-white/5 overflow-hidden shadow-inner">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-white/5 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                                            <tr>
                                                <th className="px-8 py-5">Nombre Original</th>
                                                <th className="px-6 py-5">Normalización Aliant</th>
                                                <th className="px-6 py-5">Doc Identidad</th>
                                                <th className="px-6 py-5">Resultado Auditoría</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {registrosAProcesar.map(r => (
                                                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-8 py-5 text-[11px] text-gray-400">{r.datos.nombres} {r.datos.apellidos}</td>
                                                    <td className="px-6 py-5 text-xs font-black text-tkd-blue uppercase tracking-tight">{r.datos.nombres.trim()} {r.datos.apellidos.trim()}</td>
                                                    <td className="px-6 py-5 font-black text-xs text-gray-700 dark:text-white">{r.datos.telefono}</td>
                                                    <td className="px-6 py-5"><span className="bg-green-500/10 text-green-600 dark:text-green-500 px-3 py-1 rounded-full text-[8px] font-black border border-green-500/20 uppercase">ÓPTIMO</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <footer className="p-10 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <IconoInformacion className="w-6 h-6 text-tkd-blue" />
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest max-w-sm">La inyección masiva crea automáticamente los contratos iniciales y perfiles técnicos.</p>
                                </div>
                                <button
                                    onClick={ejecutarInyeccionAliant}
                                    disabled={procesandoInyeccion || registrosAProcesar.length === 0}
                                    className="bg-tkd-red text-white px-12 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl hover:bg-red-700 transition-all flex items-center gap-4 active:scale-95 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400"
                                >
                                    {procesandoInyeccion ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-6 h-6" />}
                                    Ejecutar Inyección Maestra
                                </button>
                            </footer>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VistaMasterDashboard;
