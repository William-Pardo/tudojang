
// vistas/MisionKicho.tsx
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { obtenerMisionActivaTenant, obtenerRegistrosMision, validarRegistroTemporal, legalizarLoteKicho, crearMisionKicho } from '../servicios/censoApi';
import { useEstudiantes } from '../context/DataContext';
import { MisionKicho, RegistroTemporal, RolUsuario } from '../tipos';
import {
    IconoLogoOficial, IconoWhatsApp, IconoCopiar, IconoAprobar,
    IconoRechazar, IconoUsuario, IconoFirma, IconoInformacion,
    IconoCampana, IconoCerrar, IconoExitoAnimado, IconoAgregar, IconoTienda
} from '../components/Iconos';
import { dispararLegalizacionPrivada } from '../servicios/notificacionesApi';
import { generarUrlAbsoluta } from '../utils/formatters';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

// Componente Interno: Reloj de Conteo Regresivo
const CountdownTimer: React.FC<{ fechaExpiracion: string }> = ({ fechaExpiracion }) => {
    const [tiempo, setTiempo] = useState('');
    const [urgencia, setUrgencia] = useState<'normal' | 'media' | 'critica'>('normal');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(fechaExpiracion).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTiempo("EXPIRADO");
                clearInterval(interval);
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            if (h < 6) setUrgencia('critica');
            else if (h < 24) setUrgencia('media');
            else setUrgencia('normal');

            setTiempo(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [fechaExpiracion]);

    const colors = {
        normal: 'text-tkd-blue bg-tkd-blue/10 border-tkd-blue/20',
        media: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        critica: 'text-tkd-red bg-tkd-red/10 border-tkd-red/20 animate-pulse'
    };

    return (
        <div className={`px-4 py-2 rounded-xl border font-black text-sm tracking-widest flex items-center gap-2 ${colors[urgencia]}`}>
            <span className="text-[10px] opacity-60">CIERRE EN:</span> {tiempo}
        </div>
    );
};

const VistaMisionKicho: React.FC = () => {
    const { usuario } = useAuth();
    const { estudiantes } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();

    const [mision, setMision] = useState<MisionKicho | null>(null);
    const [registros, setRegistros] = useState<RegistroTemporal[]>([]);
    const [cargando, setCargando] = useState(true);
    const [activando, setActivando] = useState(false);
    const [showExitoModal, setShowExitoModal] = useState(false);

    const [mostrarFirma, setMostrarFirma] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dibujando, setDibujando] = useState(false);

    const cargarDatos = async () => {
        if (!usuario) return;
        try {
            const m = await obtenerMisionActivaTenant(usuario.tenantId);
            if (m) {
                setMision(m);
                const r = await obtenerRegistrosMision(m.id);
                setRegistros(r);
            }
        } catch (e: any) {
            mostrarNotificacion("Error al sincronizar Misión KICHO", "error");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargarDatos(); }, []);

    const linkPublico = mision ? generarUrlAbsoluta(`/censo/${mision.id}`) : '';

    const handleActivarKichoAuto = async () => {
        if (!usuario) return;
        setActivando(true);
        try {
            const expDate = new Date();
            expDate.setHours(expDate.getHours() + 72);

            await crearMisionKicho({
                tenantId: usuario.tenantId,
                nombreMision: "PROTOCOLO DE CARGA INICIAL (72H)",
                fechaExpiracion: expDate.toISOString(),
            });

            setShowExitoModal(true);
            await cargarDatos();
        } catch (e: any) {
            mostrarNotificacion("No se pudo activar el protocolo automático.", "error");
        } finally {
            setActivando(false);
        }
    };

    const handleCopiar = () => {
        navigator.clipboard.writeText(linkPublico);
        mostrarNotificacion("Link copiado. ¡Pégalo en WhatsApp!", "success");
    };

    const handleValidar = async (regId: string, estado: RegistroTemporal['estado']) => {
        try {
            await validarRegistroTemporal(regId, estado);
            setRegistros(prev => prev.map(r => r.id === regId ? { ...r, estado } : r));
            mostrarNotificacion(`Registro ${estado.replace('_', ' ')}`, "success");

            const reg = registros.find(r => r.id === regId);
            if (estado === 'verificado' && reg && reg.misionId === 'inscripcion_premium') {
                await dispararLegalizacionPrivada(reg.datos.telefono, reg.datos.nombres, reg.id);
            }
        } catch (e: any) { mostrarNotificacion("Error al procesar", "error"); }
    };

    const iniciarLegalizacion = () => {
        const todosProcesados = registros.every(r => r.estado !== 'pendiente' && r.estado !== 'por_verificar');
        if (!todosProcesados) {
            mostrarNotificacion("Revisa todos los registros antes de legalizar el lote.", "warning");
            return;
        }
        setMostrarFirma(true);
    };

    const finalizarLegalizacion = async () => {
        if (!canvasRef.current || !mision) return;
        const firma = canvasRef.current.toDataURL();
        try {
            await legalizarLoteKicho(mision.id, firma);
            mostrarNotificacion("¡Lote Legalizado! Datos en cola de inyección.", "success");
            setMision(null);
            setMostrarFirma(false);
        } catch (e: any) { mostrarNotificacion("Error en firma", "error"); }
    };

    if (cargando) return <Loader texto="Escaneando Protocolos..." />;

    if (!mision) {
        const esNuevo = estudiantes.length < 10;
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
                {esNuevo ? (
                    <div className="bg-gradient-to-br from-tkd-blue to-blue-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden border border-white/10">
                        <div className="relative z-10 space-y-8 max-w-2xl">
                            <div className="bg-white/20 w-20 h-20 rounded-3xl flex items-center justify-center backdrop-blur-md">
                                <IconoLogoOficial className="w-12 h-12 text-white" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">¿Tienes muchos alumnos por registrar?</h2>
                                <p className="text-blue-100 text-lg font-medium leading-relaxed">
                                    Activa el **Protocolo KICHO** y ahorra horas de digitación. Genera un link único para que tus alumnos ingresen sus datos. Tú solo revisas y apruebas.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button
                                    onClick={handleActivarKichoAuto}
                                    disabled={activando}
                                    className="bg-white text-tkd-blue px-10 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {activando ? <div className="w-5 h-5 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div> : <IconoAgregar className="w-6 h-6" />}
                                    Activar Misión (72h)
                                </button>
                                <div className="flex items-center gap-3 px-6 py-4 bg-black/20 rounded-2xl border border-white/10">
                                    <IconoInformacion className="w-5 h-5 text-blue-300" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Servicio de Onboarding Gratuito</span>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-tkd-red/20 rounded-full blur-[100px]"></div>
                        <div className="absolute top-10 right-10 opacity-10 rotate-12">
                            <IconoCampana className="w-64 h-64" />
                        </div>
                    </div>
                ) : (
                    <EmptyState
                        Icono={IconoLogoOficial}
                        titulo="Sin Misiones Activas"
                        mensaje="No tienes un protocolo de captura de datos activo. Si necesitas realizar un censo masivo, contacta con Aliant Master Control."
                    />
                )}

                <AnimatePresence>
                    {showExitoModal && (
                        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                                className="bg-white dark:bg-gray-900 rounded-[4rem] p-12 text-center max-w-md shadow-[0_0_100px_rgba(31,62,144,0.3)] border border-white/10"
                            >
                                <IconoExitoAnimado className="mx-auto text-tkd-blue w-32 h-32" />
                                <h2 className="text-3xl font-black uppercase text-gray-900 dark:text-white mt-6 tracking-tighter">¡Protocolo Iniciado!</h2>
                                <p className="text-gray-500 mt-4 font-bold uppercase text-xs tracking-widest leading-relaxed">
                                    Tienes **72 horas** para completar la captura. <br /> El QR de registro ya está disponible.
                                </p>
                                <button
                                    onClick={() => setShowExitoModal(false)}
                                    className="mt-10 w-full bg-tkd-blue text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all"
                                >
                                    Ir al Centro de Comando
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PANEL IZQUIERDO: COMPARTICIÓN Y TIEMPO */}
                <div className="lg:col-span-1 space-y-6">
                    <section className="bg-tkd-dark text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/10">
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tighter">KICHO ACTIVE</h2>
                                    <p className="text-[10px] font-black text-tkd-red uppercase tracking-[0.2em]">{mision.nombreMision}</p>
                                </div>
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center animate-pulse"><IconoCampana className="w-6 h-6 text-tkd-red" /></div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mx-auto w-fit border-4 border-tkd-blue/20">
                                <QRCodeSVG value={linkPublico} size={180} />
                            </div>

                            <div className="space-y-3">
                                <button onClick={handleCopiar} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                                    <IconoCopiar className="w-4 h-4" /> Copiar Enlace Público
                                </button>
                                <a href={`https://wa.me/?text=🥋%20*PROTOCOLO%20DE%20REGISTRO%20TUDOJANG*%0A%0AHola!%20Por%20favor%20ingresa%20tus%20datos%20aquí%20para%20formalizar%20tu%20ingreso%20a%20la%20academia:%20${encodeURIComponent(linkPublico)}`} target="_blank" className="w-full py-4 bg-green-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-green-700 transition-all">
                                    <IconoWhatsApp className="w-5 h-5" /> Compartir en WhatsApp
                                </a>
                            </div>

                            <div className="pt-6 border-t border-white/10 flex justify-center">
                                <CountdownTimer fechaExpiracion={mision.fechaExpiracion} />
                            </div>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-tkd-red/10 rounded-full blur-3xl"></div>
                    </section>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-800 flex gap-4">
                        <IconoInformacion className="w-6 h-6 text-tkd-blue flex-shrink-0" />
                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase leading-relaxed">
                            Muestra este QR en la entrada de tu dojang o envíalo por el grupo de padres. Los datos aparecerán a la derecha en tiempo real.
                        </p>
                    </div>

                    <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-[2rem] border border-purple-100 dark:border-purple-800 flex gap-4">
                        <IconoTienda className="w-6 h-6 text-purple-500 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-purple-800 dark:text-purple-200 uppercase leading-relaxed">
                            <span className="font-black">MODO PREMIUM:</span> Los alumnos que usen el link de pago aparecerán aquí como <span className="text-purple-600">Pendiente de Pago</span>. Una vez apruebes su soporte, se les habilitará su formulario.
                        </p>
                    </div>
                </div>

                {/* PANEL DERECHO: LISTADO DE CAPTURA */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-10 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight dark:text-white">Aspirantes Detectados</h2>
                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Validando {registros.length} registros capturados</p>
                            </div>
                            {usuario?.rol === RolUsuario.Admin && (
                                <button
                                    onClick={iniciarLegalizacion}
                                    className="px-8 py-4 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <IconoFirma className="w-4 h-4" /> Legalizar Lote Final
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 dark:bg-gray-900 text-[9px] font-black uppercase text-gray-400 tracking-[0.2em]">
                                    <tr>
                                        <th className="px-10 py-5">Identidad Alumno</th>
                                        <th className="px-6 py-5">Información Tutor</th>
                                        <th className="px-6 py-5">Estado</th>
                                        <th className="px-10 py-5 text-right">Acción Técnica</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {registros.map(reg => (
                                        <tr key={reg.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${reg.estado === 'rechazado' ? 'opacity-30 grayscale' : ''}`}>
                                            <td className="px-10 py-6">
                                                <div className="flex items-center gap-4">
                                                    {reg.pago?.soporteUrl && (
                                                        <a href={reg.pago.soporteUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 group relative">
                                                            <img src={reg.pago.soporteUrl} alt="Soporte" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <IconoInformacion className="w-4 h-4 text-white" />
                                                            </div>
                                                        </a>
                                                    )}
                                                    <div>
                                                        <div className="font-black text-sm uppercase text-gray-900 dark:text-white">{reg.datos.nombres || 'PAGANDO...'} {reg.datos.apellidos || ''}</div>
                                                        <div className="text-[9px] text-gray-400 font-bold uppercase mt-1">F. REG: {reg.fechaRegistro.split('T')[0]}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="text-[10px] font-black uppercase text-tkd-blue">{reg.datos.tutorNombre || 'ALUMNO NUEVO'}</div>
                                                <div className="text-[9px] text-gray-400 uppercase font-bold">{reg.datos.telefono}</div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${reg.estado === 'verificado' || reg.estado === 'pago_validado' ? 'bg-green-100 text-green-700 border-green-200' :
                                                    reg.estado === 'rechazado' ? 'bg-red-100 text-red-700 border-red-200' :
                                                        reg.estado === 'pendiente_pago' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                            reg.estado === 'por_verificar' ? 'bg-orange-100 text-orange-700 border-orange-200 animate-pulse' :
                                                                'bg-gray-100 text-gray-500 border-gray-200'
                                                    }`}>
                                                    {reg.estado.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <div className="flex justify-end gap-3">
                                                    {reg.estado === 'por_verificar' && (
                                                        <button
                                                            onClick={() => handleValidar(reg.id, 'pago_validado')}
                                                            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-md font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
                                                        >
                                                            <IconoAprobar className="w-4 h-4" /> Aprobar Pago
                                                        </button>
                                                    )}
                                                    {(reg.estado === 'pendiente' || reg.estado === 'verificado') && (
                                                        <>
                                                            <button onClick={() => handleValidar(reg.id, 'verificado')} className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Aprobar para Inyección"><IconoAprobar className="w-5 h-5" /></button>
                                                            <button onClick={() => handleValidar(reg.id, 'rechazado')} className="p-3 bg-red-50 text-tkd-red rounded-xl hover:bg-tkd-red hover:text-white transition-all shadow-sm" title="Rechazar Registro"><IconoRechazar className="w-5 h-5" /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {registros.length === 0 && (
                                        <tr><td colSpan={4} className="px-10 py-32 text-center text-gray-400 font-black uppercase text-xs tracking-widest">Esperando que tus alumnos escaneen el QR...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE FIRMA LEGALIZACIÓN */}
            <AnimatePresence>
                {mostrarFirma && (
                    <div className="fixed inset-0 z-[200] bg-tkd-dark/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-gray-900 rounded-[3.5rem] p-12 max-w-md w-full shadow-2xl border border-white/5 space-y-8"
                        >
                            <div className="flex justify-between items-start">
                                <div className="p-4 bg-tkd-blue/10 rounded-2xl"><IconoFirma className="w-8 h-8 text-tkd-blue" /></div>
                                <button onClick={() => setMostrarFirma(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all"><IconoCerrar className="w-6 h-6" /></button>
                            </div>

                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">Legalizar Protocolo</h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 leading-relaxed">
                                    Yo, <span className="text-tkd-blue">{usuario?.nombreUsuario}</span>, certifico que los registros validados son auténticos y solicito su inyección a la base técnica oficial.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">Firma del Director</label>
                                <div className="relative">
                                    <canvas
                                        ref={canvasRef}
                                        width={400} height={200}
                                        onMouseDown={() => setDibujando(true)}
                                        onMouseUp={() => setDibujando(false)}
                                        onMouseMove={(e: React.MouseEvent<HTMLCanvasElement>) => {
                                            if (!dibujando || !canvasRef.current) return;
                                            const ctx = canvasRef.current.getContext('2d');
                                            const rect = canvasRef.current.getBoundingClientRect();
                                            if (ctx) {
                                                ctx.lineWidth = 4;
                                                ctx.lineCap = 'round';
                                                ctx.strokeStyle = '#111111';
                                                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                                                ctx.stroke();
                                            }
                                        }}
                                        className="w-full h-44 bg-gray-50 dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-crosshair shadow-inner"
                                    />
                                    <button
                                        onClick={() => {
                                            const ctx = canvasRef.current?.getContext('2d');
                                            if (ctx) { ctx.clearRect(0, 0, 400, 200); ctx.beginPath(); }
                                        }}
                                        className="absolute bottom-4 right-4 text-[8px] font-black uppercase bg-white/80 dark:bg-black/50 px-3 py-1 rounded-full text-gray-500"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <button onClick={finalizarLegalizacion} className="w-full bg-tkd-red text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl hover:bg-red-700 active:scale-95 transition-all">
                                Firmar y Enviar a Aliant
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VistaMisionKicho;
