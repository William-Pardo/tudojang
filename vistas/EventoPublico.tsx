// vistas/EventoPublico.tsx
// Vista pública del detalle de un evento, optimizada para conversión.
// Accesible sin autenticación. Orientada a competidores de OTROS clubes.

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { formatearPrecio, formatearFecha } from '../utils/formatters';
import { IconoWhatsApp, IconoExitoAnimado, IconoEnviar, IconoEventos, IconoInformacion, IconoCampana, IconoCasa } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import type { Evento, ConfiguracionClub } from '../tipos';
import { registrarLeadPublico } from '../servicios/leadsEventosApi';

const EventoPublico: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [evento, setEvento] = useState<Evento | null>(null);
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [paso, setPaso] = useState<'detalle' | 'formulario' | 'exito'>('detalle');
    const [enviando, setEnviando] = useState(false);

    const [formData, setFormData] = useState({
        nombre: '',
        whatsapp: '',
        email: '',
        clubOrigen: '',
    });

    // --- Carga del evento y del tenant ---
    useEffect(() => {
        const cargarEvento = async () => {
            if (!id) { setError('No se proporcionó un ID de evento.'); setCargando(false); return; }
            if (!isFirebaseConfigured) {
                setEvento({
                    id, tenantId: 'escuela-gajog-001', nombre: 'Torneo Interdepartamental de Taekwondo',
                    descripcion: 'Competencia abierta a todas las academias de la región. Categorías desde infantil hasta senior.',
                    lugar: 'Coliseo Municipal, Cra 5 #10-20', fechaEvento: '2026-08-15',
                    fechaInicioInscripcion: '2026-07-01', fechaFinInscripcion: '2026-08-10',
                    valor: 80000, requisitos: 'Certificado médico vigente, seguro deportivo, dobok completo.',
                    imagenUrl: '', solicitudesPendientes: 0,
                });
                setCargando(false);
                return;
            }
            try {
                const eventoDoc = await getDoc(doc(db, 'eventos', id));
                if (!eventoDoc.exists()) { setError('Este evento no existe o fue eliminado.'); setCargando(false); return; }
                const eventoData = { id: eventoDoc.id, ...eventoDoc.data() } as Evento;
                setEvento(eventoData);

                if (eventoData.tenantId) {
                    const tenantDoc = await getDoc(doc(db, 'tenants', eventoData.tenantId));
                    if (tenantDoc.exists()) {
                        setTenant(tenantDoc.data() as ConfiguracionClub);
                    }
                }
            } catch (e) {
                console.error('[EventoPublico] Error al cargar evento:', e);
                setError('Ocurrió un error al cargar la información del evento.');
            } finally {
                setCargando(false);
            }
        };
        cargarEvento();
    }, [id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evento) return;
        setEnviando(true);
        try {
            await registrarLeadPublico(evento.tenantId, evento.id, {
                nombre: formData.nombre,
                whatsapp: formData.whatsapp,
                email: formData.email,
                clubOrigen: formData.clubOrigen,
            });
            setPaso('exito');
        } catch (err) {
            console.error('[EventoPublico] Error al guardar lead:', err);
            setError('No pudimos registrar tu interés. Intentá de nuevo.');
        } finally {
            setEnviando(false);
        }
    };

    const generarEnlaceWhatsApp = (): string => {
        const telefonoClub = tenant?.pagoNequi || tenant?.pagoDaviplata || '';
        const telefonoLimpio = telefonoClub.replace(/\D/g, '');
        const nombreEvento = evento?.nombre || 'el evento';
        const clubDelProspecto = formData.clubOrigen ? ` y asisto con el club ${formData.clubOrigen}` : '';
        const mensaje = `¡Hola! Quiero asegurar mi participación en *${nombreEvento}*. Mi nombre es ${formData.nombre}${clubDelProspecto}. ¿Me envían los detalles para el pago de la inscripción?`;
        return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    };

    const colorPrimario = tenant?.colorPrimario || 'var(--color-primario, #111111)';
    const colorSecundario = tenant?.colorSecundario || 'var(--color-acento, #CD2E3A)';

    if (cargando) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader />
        </div>
    );

    if (error || !evento) return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="text-center space-y-4">
                <IconoInformacion className="w-16 h-16 text-tkd-red mx-auto" />
                <h1 className="text-2xl font-black text-tkd-dark uppercase tracking-tighter">{error || 'Evento no encontrado'}</h1>
                <Link to="/" className="text-gray-400 hover:text-tkd-blue text-xs font-bold uppercase tracking-widest underline transition-colors">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );

    const inscripcionAbierta = new Date(evento.fechaFinInscripcion + 'T23:59:59') >= new Date();

    return (
        <div className="min-h-screen bg-gray-50 text-tkd-dark font-sans selection:bg-tkd-blue selection:text-white pb-20">
            {/* NAVBAR ESTRATÉGICO */}
            <nav className="fixed top-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 py-4 px-6 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    {tenant?.logoUrl ? (
                        <img src={tenant.logoUrl} alt={tenant.nombreClub} className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm bg-white" />
                    ) : (
                        <LogoDinamico className="h-10 w-auto" />
                    )}
                    <span className="font-black text-lg tracking-tighter uppercase italic" style={{ color: colorPrimario }}>
                        {tenant?.nombreClub || 'Tudojang'}
                    </span>
                </div>
                <Link to="/login" className="hidden sm:inline-block bg-white border border-gray-200 text-tkd-dark px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:border-tkd-blue hover:text-tkd-blue shadow-sm transition-all">
                    Portal Alumnos
                </Link>
            </nav>

            {/* HERO SECTION */}
            <section className="pt-32 pb-10 px-6 max-w-5xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 mb-12">
                    <div className="inline-block px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]" style={{ backgroundColor: `${colorSecundario}15`, color: colorSecundario }}>
                        Evento Oficial
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter leading-tight text-tkd-dark">
                        {evento.nombre}
                    </h1>
                </motion.div>

                {evento.imagenUrl ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full rounded-[3rem] overflow-hidden shadow-premium border border-gray-100 bg-white group">
                        <img src={evento.imagenUrl} alt={evento.nombre} className="w-full h-auto max-h-[60vh] object-cover transition-transform duration-700 group-hover:scale-105" />
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-64 rounded-[3rem] flex items-center justify-center shadow-premium border border-gray-100 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}>
                        <IconoEventos className="w-32 h-32 text-white/20" />
                        <div className="absolute inset-0 bg-black/10"></div>
                    </motion.div>
                )}
            </section>

            {/* MAIN CONTENT */}
            <section className="px-6 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 -mt-8">
                {/* Detalles (Izquierda) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tarjetas de Resumen */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-gray-100 flex items-start gap-5 hover:shadow-premium transition-shadow">
                            <div className="p-4 rounded-3xl bg-blue-50 text-tkd-blue"><IconoCampana className="w-7 h-7" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuándo</p>
                                <p className="text-xl font-black mt-1 text-tkd-dark">{formatearFecha(evento.fechaEvento)}</p>
                            </div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-gray-100 flex items-start gap-5 hover:shadow-premium transition-shadow">
                            <div className="p-4 rounded-3xl bg-red-50 text-tkd-red"><IconoCasa className="w-7 h-7" /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dónde</p>
                                <p className="text-xl font-black mt-1 text-tkd-dark">{evento.lugar}</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Descripción y Requisitos */}
                    <div className="bg-white p-10 sm:p-12 rounded-[3rem] shadow-soft border border-gray-100 space-y-12">
                        {evento.descripcion && (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-tkd-dark">
                                    <span className="w-3 h-8 rounded-full" style={{ backgroundColor: colorPrimario }}></span>
                                    Acerca del Evento
                                </h3>
                                <p className="text-gray-500 leading-loose font-medium text-lg">{evento.descripcion}</p>
                            </div>
                        )}
                        {evento.requisitos && (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-tkd-dark">
                                    <span className="w-3 h-8 rounded-full" style={{ backgroundColor: colorSecundario }}></span>
                                    Requisitos Oficiales
                                </h3>
                                <p className="text-gray-500 leading-loose font-medium text-lg whitespace-pre-line">{evento.requisitos}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Formulario/CTA (Derecha - Sticky) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-28 bg-white p-8 sm:p-10 rounded-[3rem] shadow-premium border border-gray-100">
                        {/* Info de Inscripción */}
                        <div className="text-center mb-8 pb-8 border-b border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inversión Total</p>
                            <p className="text-5xl font-black text-tkd-dark my-4 tracking-tighter" style={{ color: colorPrimario }}>{formatearPrecio(evento.valor)}</p>
                            <div className="inline-block bg-gray-50 px-4 py-2 rounded-xl">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    Cierre: {formatearFecha(evento.fechaFinInscripcion)}
                                </p>
                            </div>
                        </div>

                        {!inscripcionAbierta ? (
                            <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
                                <p className="text-tkd-red font-black uppercase tracking-widest text-xs">Inscripciones Cerradas</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="wait">
                                {paso === 'detalle' && (
                                    <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                        <button
                                            onClick={() => setPaso('formulario')}
                                            className="w-full py-5 rounded-full font-black uppercase text-xs tracking-[0.2em] text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                                            style={{ backgroundColor: colorPrimario }}
                                        >
                                            Inscribirme Ahora
                                        </button>
                                        <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest px-4 leading-relaxed">
                                            Asegurá tu lugar antes del cierre. Cupos estrictamente limitados.
                                        </p>
                                    </motion.div>
                                )}

                                {paso === 'formulario' && (
                                    <motion.div key="form" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div className="space-y-2">
                                                <label htmlFor="evento-publico-nombre" className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">Nombre Completo</label>
                                                <input id="evento-publico-nombre" required name="nombre" value={formData.nombre} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-tkd-dark focus:outline-none focus:border-tkd-blue focus:ring-2 focus:ring-tkd-blue/20 transition-all font-bold text-sm" placeholder="Ej. Juan Pérez" />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="evento-publico-whatsapp" className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">Celular / WhatsApp</label>
                                                <input id="evento-publico-whatsapp" required name="whatsapp" type="tel" value={formData.whatsapp} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-tkd-dark focus:outline-none focus:border-tkd-blue focus:ring-2 focus:ring-tkd-blue/20 transition-all font-bold text-sm" placeholder="Tu número principal" />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="evento-publico-email" className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">Email (Opcional)</label>
                                                <input id="evento-publico-email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-tkd-dark focus:outline-none focus:border-tkd-blue focus:ring-2 focus:ring-tkd-blue/20 transition-all font-bold text-sm" placeholder="correo@ejemplo.com" />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="evento-publico-club" className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">Academia (Opcional)</label>
                                                <input id="evento-publico-club" name="clubOrigen" value={formData.clubOrigen} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-tkd-dark focus:outline-none focus:border-tkd-blue focus:ring-2 focus:ring-tkd-blue/20 transition-all font-bold text-sm" placeholder="Club de origen" />
                                            </div>
                                            
                                            <div className="pt-6 space-y-4">
                                                <button type="submit" disabled={enviando} className="w-full py-5 rounded-full font-black uppercase text-xs tracking-[0.2em] text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-3 disabled:opacity-50" style={{ backgroundColor: colorPrimario }}>
                                                    {enviando ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IconoEnviar className="w-5 h-5" />}
                                                    {enviando ? 'Procesando...' : 'Confirmar Registro'}
                                                </button>
                                                <button type="button" onClick={() => setPaso('detalle')} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-tkd-dark transition-colors">
                                                    Cancelar
                                                </button>
                                            </div>
                                        </form>
                                    </motion.div>
                                )}

                                {paso === 'exito' && (
                                    <motion.div key="exito" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-6">
                                        <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center mx-auto border border-green-100 shadow-inner">
                                            <IconoExitoAnimado className="w-12 h-12 text-green-500" />
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-3xl font-black uppercase tracking-tighter text-tkd-dark">¡Registro Exitoso!</h3>
                                            <p className="text-sm font-medium text-gray-500 leading-relaxed max-w-[250px] mx-auto">
                                                Ya tenemos tus datos. Ahora escribinos por WhatsApp para finalizar tu inscripción.
                                            </p>
                                        </div>
                                        {(tenant?.pagoNequi || tenant?.pagoDaviplata) && (
                                            <a href={generarEnlaceWhatsApp()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-4 w-full py-5 rounded-full font-black uppercase text-xs tracking-widest text-white bg-[#25D366] hover:bg-[#1DA851] shadow-xl hover:scale-105 active:scale-95 transition-all mt-4">
                                                <IconoWhatsApp className="w-6 h-6" />
                                                Contactar al Club
                                            </a>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default EventoPublico;
