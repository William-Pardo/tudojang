
// components/Pagos/ReportarPagoTutor.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../BrandingProvider';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerEstudiantesDelTutor, reportarPagoEstudiante } from '../../servicios/pagosEstudiantesApi';
import MediosPagoResumen from '../MediosPagoResumen';
import { IconoExitoAnimado, IconoEnviar, IconoUsuario, IconoInformacion, IconoAprobar, IconoLogoOficial, IconoBillete } from '../Iconos';
import { formatearPrecio } from '../../utils/formatters';
import type { Estudiante } from '../../tipos';

// Flujo autenticado equivalente a vistas/ReportarPagoPublico.tsx (link público sin login),
// pero resolviendo el/los estudiante(s) desde la cuenta real del tutor en vez de un id en la
// URL -- cierra el hueco de que cualquiera con el link público podía reportar a nombre de
// cualquier estudiante. El link público sigue intacto y funcionando en paralelo.
const ReportarPagoTutor: React.FC = () => {
    const { usuario } = useAuth();
    const { tenant } = useTenant();
    const { mostrarNotificacion } = useNotificacion();

    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [cargando, setCargando] = useState(true);
    const [estudianteId, setEstudianteId] = useState<string | null>(null);
    const [monto, setMonto] = useState<string>('');
    const [imagen, setImagen] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [exito, setExito] = useState(false);

    useEffect(() => {
        const cargar = async () => {
            if (!usuario) return;
            setCargando(true);
            try {
                const propios = await obtenerEstudiantesDelTutor(usuario.tenantId, usuario.email);
                setEstudiantes(propios);
                if (propios.length === 1) {
                    setEstudianteId(propios[0].id);
                    setMonto(propios[0].saldoDeudor > 0 ? propios[0].saldoDeudor.toString() : '');
                }
            } catch (e) {
                mostrarNotificacion("Error al cargar tus estudiantes vinculados.", "error");
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [usuario]);

    const estudiante = estudiantes.find(e => e.id === estudianteId) || null;

    const seleccionarEstudiante = (e: Estudiante) => {
        setEstudianteId(e.id);
        setMonto(e.saldoDeudor > 0 ? e.saldoDeudor.toString() : '');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImagen(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleEnviarReporte = async () => {
        if (!estudiante || !imagen || !monto || !usuario) return;
        setEnviando(true);
        try {
            await reportarPagoEstudiante(
                usuario.tenantId,
                estudiante.id,
                `${estudiante.nombres} ${estudiante.apellidos}`,
                parseInt(monto),
                imagen,
                usuario.id
            );
            setExito(true);
        } catch (err) {
            mostrarNotificacion("No se pudo enviar el reporte. Intenta de nuevo.", "error");
        } finally {
            setEnviando(false);
        }
    };

    if (cargando) {
        return <div className="p-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse">Buscando tus estudiantes...</div>;
    }

    if (estudiantes.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-20 text-center space-y-4 border border-gray-100 dark:border-white/5 shadow-soft">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto opacity-40">
                    <IconoUsuario className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Sin Estudiantes Vinculados</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Tu cuenta no está asociada a ningún estudiante activo. Contacta a tu academia.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-white/10">
            <AnimatePresence mode="wait">
                {exito ? (
                    <motion.div
                        key="exito" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="p-10 text-center space-y-6"
                    >
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                            <IconoExitoAnimado className="text-green-600 w-12 h-12" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-tkd-dark dark:text-white">¡Reporte Enviado!</h2>
                        <p className="text-gray-500 font-bold uppercase text-[9px] tracking-widest leading-relaxed">
                            El Sabonim verificará tu pago. <br />
                            <span className="text-tkd-blue">Recibirás tu recibo oficial por WhatsApp en breve.</span>
                        </p>
                        <button
                            onClick={() => { setExito(false); setImagen(null); }}
                            className="text-[10px] font-black uppercase tracking-widest text-tkd-blue hover:underline"
                        >
                            Reportar otro pago
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="reporte" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="p-6 space-y-6"
                    >
                        {estudiantes.length > 1 && !estudiante && (
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-2">Selecciona el estudiante</p>
                                {estudiantes.map(e => (
                                    <button
                                        key={e.id}
                                        onClick={() => seleccionarEstudiante(e)}
                                        className="w-full flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-transparent hover:border-tkd-blue transition-all text-left"
                                    >
                                        <span className="text-sm font-black uppercase text-tkd-dark dark:text-white">{e.nombres} {e.apellidos}</span>
                                        <span className="text-[10px] font-bold text-gray-400">{formatearPrecio(e.saldoDeudor)}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {estudiante && (
                            <div className="space-y-6">
                                <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-xl flex items-center gap-4 border-b-4 border-blue-800">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                        <IconoUsuario className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-black uppercase leading-none">{estudiante.nombres} {estudiante.apellidos}</h3>
                                        <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mt-1">Saldo a pagar: {formatearPrecio(estudiante.saldoDeudor)}</p>
                                    </div>
                                    {estudiantes.length > 1 && (
                                        <button onClick={() => setEstudianteId(null)} className="text-[8px] font-black uppercase underline opacity-80 flex-shrink-0">Cambiar</button>
                                    )}
                                </div>

                                {/* Campo de Monto (Pre-llenado) */}
                                <div>
                                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Monto Transferido ($)</label>
                                    <input
                                        type="number"
                                        value={monto}
                                        onChange={(e) => setMonto(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent rounded-2xl py-4 px-6 font-black text-2xl text-tkd-blue focus:border-tkd-blue transition-all dark:text-white"
                                    />
                                </div>

                                {/* Link de Pago en Línea (Opcional, lo configura la academia) */}
                                {tenant?.linkPagoMensualidad && (
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => window.open(tenant.linkPagoMensualidad, '_blank', 'noopener,noreferrer')}
                                            className="w-full py-6 bg-tkd-blue text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                            <IconoBillete className="w-5 h-5" />
                                            <span>Pagar en Línea</span>
                                        </button>
                                        <p className="text-[9px] font-bold text-gray-400 text-center flex items-center justify-center gap-1">
                                            <IconoInformacion className="w-3 h-3 flex-shrink-0" />
                                            Después de pagar, subí tu comprobante abajo para que se registre tu pago
                                        </p>
                                    </div>
                                )}

                                {/* Medios de pago manual (Nequi, Daviplata, Bre-B, Banco) */}
                                {(tenant?.pagoNequi || tenant?.pagoDaviplata || tenant?.pagoBreB || tenant?.pagoBanco) && (
                                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 space-y-3">
                                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Medios de Pago Directo</p>
                                        <MediosPagoResumen
                                            pagoNequi={tenant?.pagoNequi}
                                            pagoDaviplata={tenant?.pagoDaviplata}
                                            pagoBreB={tenant?.pagoBreB}
                                            pagoBanco={tenant?.pagoBanco}
                                        />
                                    </div>
                                )}

                                {/* Zona de adjuntar SCREENSHOT */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Adjuntar Comprobante (Screenshot)</label>
                                    <div className={`relative h-56 border-3 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all ${imagen ? 'border-green-500 bg-green-50/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 hover:border-tkd-blue'}`}>
                                        {imagen ? (
                                            <div className="relative w-full h-full p-4 group">
                                                <img src={imagen} alt="Pago" className="w-full h-full object-contain rounded-xl" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setImagen(null)} className="bg-white text-tkd-red py-2 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest">Cambiar Imagen</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="bg-tkd-blue text-white p-4 rounded-full shadow-lg mb-3 animate-pulse">
                                                    <IconoEnviar className="w-6 h-6 -rotate-45" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-tighter text-tkd-dark dark:text-white">Toca aquí para subir Screenshot</p>
                                                <p className="text-[8px] font-bold text-gray-400 mt-1">Nequi, Daviplata o Banco</p>
                                                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Único Botón de Acción */}
                                <button
                                    onClick={handleEnviarReporte}
                                    disabled={enviando || !imagen || !monto}
                                    className="w-full py-6 bg-tkd-dark dark:bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {enviando ? (
                                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <IconoAprobar className="w-5 h-5" />
                                            <span>REPORTAR PAGO AHORA</span>
                                        </>
                                    )}
                                </button>

                                <div className="flex items-center justify-center gap-2 opacity-40">
                                    <IconoLogoOficial className="w-3 h-3" />
                                    <p className="text-[7px] font-black uppercase tracking-widest">Procesado por Inteligencia Artificial Tudojang</p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportarPagoTutor;
