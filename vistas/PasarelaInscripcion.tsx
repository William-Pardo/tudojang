
// vistas/PasarelaInscripcion.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../components/BrandingProvider';
import { registrarAspirantePublico } from '../servicios/censoApi';
import { IconoAprobar, IconoEnviar, IconoExitoAnimado, IconoUsuario, IconoInformacion, IconoCandado } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import { formatearPrecio } from '../utils/formatters';
import { CONFIGURACION_WOMPI } from '../constantes';

const PasarelaInscripcion: React.FC = () => {
    const { tenant, estaCargado } = useTenant();
    const [paso, setPaso] = useState<'pago' | 'verificando' | 'formulario' | 'finalizado'>('pago');
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'verificando') {
            setPaso('formulario');
        }
    }, []);

    const [formData, setFormData] = useState({
        nombres: '', apellidos: '', email: '', telefono: '',
        fechaNacimiento: '', tutorNombre: '', tutorEmail: '',
        tutorTelefono: '', parentesco: 'Padre'
    });

    const valorTotal = (tenant?.valorInscripcion || 0) + (tenant?.valorMensualidad || 0);

    const handleNotificarPago = () => {
        setPaso('formulario');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleSubmitRegistro = async (e: React.FormEvent) => {
        e.preventDefault();
        setCargando(true);
        try {
            await registrarAspirantePublico('inscripcion_directa', tenant?.tenantId || 'anon', formData);
            setPaso('finalizado');
        } catch (err) {
            console.error(err);
        } finally {
            setCargando(false);
        }
    };

    if (!estaCargado) return <div className="h-screen bg-tkd-dark flex items-center justify-center"><Loader texto="Preparando Pasarela..." /></div>;

    return (
        <div className="min-h-screen py-12 px-6 flex flex-col items-center transition-colors" style={{ backgroundColor: tenant?.colorPrimario }}>
            <div className="mb-10 text-center">
                <div className="bg-white p-5 rounded-[2rem] shadow-xl inline-block mb-4 border-b-4" style={{ borderBottomColor: tenant?.colorAcento }}>
                    <LogoDinamico className="w-20 h-20" />
                </div>
                <h1 className="text-white text-4xl font-black uppercase tracking-tighter drop-shadow-lg">Inscripción Oficial</h1>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.4em] mt-2">{tenant?.nombreClub}</p>
            </div>

            {tenant?.activarFormularioInscripcion === false ? (
                <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 p-16 text-center space-y-6">
                    <div className="w-20 h-20 bg-tkd-red/10 text-tkd-red rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <IconoCandado className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-tkd-dark dark:text-white">Portal Cerrado</h2>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest leading-relaxed">
                        Este club ha desactivado el formulario de inscripción pública temporalmente. <br /> Si deseas inscribirte, por favor contacta directamente con el Sabonim.
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10">
                    <AnimatePresence mode="wait">

                        {/* FASE 1: PAGO INICIAL (MANUAL) */}
                        {paso === 'pago' && (
                            <motion.div
                                key="pago" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                className="p-10 space-y-8"
                            >
                                <div className="text-center space-y-2">
                                    <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white tracking-tight">Paso 1: Legalización de Cupo</h2>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Realiza el pago a través de los medios oficiales de la academia.</p>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 space-y-6">
                                    <div className="space-y-4">
                                        {tenant?.pagoNequi && (
                                            <div className="flex justify-between items-center text-gray-500">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#E71D73]">Nequi</span>
                                                <span className="font-bold text-tkd-dark dark:text-white">{tenant.pagoNequi}</span>
                                            </div>
                                        )}
                                        {tenant?.pagoBanco && (
                                            <div className="flex flex-col gap-1 text-gray-500">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Banco / Transferencia</span>
                                                <span className="font-bold text-tkd-dark dark:text-white text-xs leading-relaxed">{tenant.pagoBanco}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-4"></div>

                                    {/* Costos Principales */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-gray-400">
                                            <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                Matrícula / Formulario
                                                {tenant?.activarMatriculaAnual && <span className="bg-tkd-red/10 text-tkd-red px-2 py-0.5 rounded text-[8px] font-black">ANUAL</span>}
                                            </span>
                                            <span className="font-black text-xs text-tkd-dark dark:text-gray-200">{formatearPrecio(tenant?.valorMatricula || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-400">
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Inversión Mensual Base</span>
                                            <span className="font-black text-xs text-tkd-dark dark:text-gray-200">{formatearPrecio(tenant?.valorMensualidad || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <span className="text-xs font-black uppercase text-tkd-blue tracking-widest">Total a Pagar</span>
                                        <span className="text-3xl font-black text-tkd-dark dark:text-white tracking-tighter">{formatearPrecio(valorTotal)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleNotificarPago}
                                    className="w-full py-6 bg-tkd-dark text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4"
                                >
                                    <IconoAprobar className="w-6 h-6" /> Ya realicé el pago
                                </button>

                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                        Una vez notificado el pago, podrás completar los datos <br /> del registro técnico del alumno.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* FASE 2: FORMULARIO TÉCNICO */}
                        {paso === 'formulario' && (
                            <motion.div
                                key="formulario" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
                                className="p-10 space-y-8"
                            >
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-4">
                                    <div className="bg-tkd-blue text-white p-2 rounded-lg shadow-lg"><IconoInformacion className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-black text-tkd-blue dark:text-blue-400 uppercase tracking-widest">Información de Registro</p>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase text-left">Por favor ingresa los datos oficiales del alumno. <br /> El administrador verificará tu pago posteriormente.</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmitRegistro} className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <input name="nombres" type="text" required placeholder="NOMBRES ALUMNO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue" onChange={handleInputChange} />
                                        <input name="apellidos" type="text" required placeholder="APELLIDOS" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue" onChange={handleInputChange} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <input name="email" type="email" required placeholder="EMAIL DE CONTACTO" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue" onChange={handleInputChange} />
                                        <input name="telefono" type="tel" required placeholder="WHATSAPP" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-5 text-sm font-black dark:text-white focus:ring-2 focus:ring-tkd-blue" onChange={handleInputChange} />
                                    </div>
                                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                                        <label className="text-[9px] font-black uppercase text-tkd-blue mb-2 block tracking-widest">Fecha de Nacimiento Alumno</label>
                                        <input name="fechaNacimiento" type="date" required className="w-full bg-white dark:bg-gray-900 border-none rounded-xl p-3 text-sm font-black dark:text-white" onChange={handleInputChange} />
                                    </div>

                                    <button type="submit" disabled={cargando} className="w-full py-6 bg-tkd-blue text-white rounded-2xl font-black uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-4">
                                        {cargando ? <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoEnviar className="w-6 h-6" />}
                                        Finalizar Registro Técnico
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {/* FASE 3: FINALIZADO */}
                        {paso === 'finalizado' && (
                            <motion.div
                                key="finalizado" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                className="p-16 text-center space-y-6"
                            >
                                <IconoExitoAnimado className="mx-auto text-tkd-blue w-32 h-32" />
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-tkd-dark dark:text-white">¡Registro Solicitado!</h2>
                                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest leading-relaxed">
                                    Tus datos han sido enviados a la academia. <br /> Una vez que el Sabonim verifique tu pago, <br /> recibirás una notificación oficial por WhatsApp.
                                </p>
                                <button onClick={() => window.location.reload()} className="mt-8 text-tkd-blue font-black uppercase text-[10px] tracking-widest hover:underline">Registrar otro alumno</button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            )}

            <footer className="mt-12 text-center">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tudojang Core v4.4 • Registro Técnico Protegido</p>
            </footer>
        </div>
    );
};

export default PasarelaInscripcion;
