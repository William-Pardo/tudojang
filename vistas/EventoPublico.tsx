
// vistas/EventoPublico.tsx
// Vista pública del detalle de un evento, optimizada para conversión.
// Accesible sin autenticación. Orientada a competidores de OTROS clubes.

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { formatearPrecio, formatearFecha } from '../utils/formatters';
import { IconoWhatsApp, IconoExitoAnimado, IconoEnviar, IconoEventos, IconoInformacion } from '../components/Iconos';
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

                // Cargar la configuración del tenant para branding y contacto
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

    // --- Manejo del formulario ---
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

    // --- Generar enlace de WhatsApp precalentado ---
    const generarEnlaceWhatsApp = (): string => {
        const telefonoClub = tenant?.pagoNequi || tenant?.pagoDaviplata || '';
        const telefonoLimpio = telefonoClub.replace(/\D/g, '');
        const nombreEvento = evento?.nombre || 'el evento';
        const clubDelProspecto = formData.clubOrigen ? ` y asisto con el club ${formData.clubOrigen}` : '';
        const mensaje = `¡Hola! Quiero asegurar mi participación en *${nombreEvento}*. Mi nombre es ${formData.nombre}${clubDelProspecto}. ¿Me envían los detalles para el pago de la inscripción?`;
        return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    };

    // --- Estados de carga y error ---
    const colorPrimario = tenant?.colorPrimario || '#1E3A5F';
    const colorSecundario = tenant?.colorSecundario || '#F97316';

    if (cargando) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
            <Loader />
        </div>
    );

    if (error || !evento) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-6">
            <div className="text-center space-y-4">
                <IconoInformacion className="w-16 h-16 text-red-400 mx-auto" />
                <h1 className="text-2xl font-black text-white uppercase tracking-wider">{error || 'Evento no encontrado'}</h1>
                <Link to="/" className="text-white/50 hover:text-white text-xs font-bold uppercase tracking-widest underline">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );

    const inscripcionAbierta = new Date(evento.fechaFinInscripcion + 'T23:59:59') >= new Date();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">

            {/* --- HEADER con Branding --- */}
            <header className="relative py-6 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {tenant?.logoUrl ? (
                        <img src={tenant.logoUrl} alt={tenant.nombreClub} className="h-10 w-10 rounded-full object-cover border-2 border-white/20" />
                    ) : (
                        <LogoDinamico className="h-10 w-auto" />
                    )}
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">{tenant?.nombreClub || 'Tudojang'}</span>
                </div>
                <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                    ¿Sos de la academia? Iniciá sesión
                </Link>
            </header>

            {/* --- HERO: Flyer del Evento --- */}
            <section className="relative overflow-hidden">
                {evento.imagenUrl && (
                    <div className="relative w-full max-w-3xl mx-auto px-4">
                        <motion.img
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            src={evento.imagenUrl}
                            alt={evento.nombre}
                            className="w-full rounded-3xl shadow-2xl shadow-black/50 object-cover"
                        />
                    </div>
                )}
                {!evento.imagenUrl && (
                    <div className="relative w-full max-w-3xl mx-auto px-4">
                        <div className="w-full h-48 rounded-3xl flex items-center justify-center"
                             style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}>
                            <IconoEventos className="w-20 h-20 text-white/30" />
                        </div>
                    </div>
                )}
            </section>

            {/* --- DETALLE DEL EVENTO --- */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-3xl mx-auto px-6 py-10 space-y-8"
            >
                <div className="text-center space-y-3">
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight">{evento.nombre}</h1>
                    <p className="text-white/50 text-sm font-bold uppercase tracking-widest">{tenant?.nombreClub || 'Organiza'}</p>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Fecha</p>
                        <p className="text-lg font-black">{formatearFecha(evento.fechaEvento)}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Lugar</p>
                        <p className="text-lg font-black">{evento.lugar}</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Inscripción</p>
                        <p className="text-lg font-black" style={{ color: colorSecundario }}>{formatearPrecio(evento.valor)}</p>
                    </div>
                </div>

                {/* Descripción completa */}
                {evento.descripcion && (
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Acerca del Evento</h2>
                        <p className="text-white/80 leading-relaxed whitespace-pre-line">{evento.descripcion}</p>
                    </div>
                )}

                {/* Requisitos */}
                {evento.requisitos && (
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Requisitos</h2>
                        <p className="text-white/80 leading-relaxed whitespace-pre-line">{evento.requisitos}</p>
                    </div>
                )}

                {/* Fechas de inscripción */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Periodo de Inscripción</p>
                    <p className="text-white/70 font-bold text-sm">
                        {formatearFecha(evento.fechaInicioInscripcion)} — {formatearFecha(evento.fechaFinInscripcion)}
                    </p>
                    {!inscripcionAbierta && (
                        <p className="text-red-400 font-black text-xs uppercase tracking-widest mt-2">Inscripciones cerradas</p>
                    )}
                </div>

                {/* --- LEAD MAGNET --- */}
                {inscripcionAbierta && (
                    <AnimatePresence mode="wait">
                        {paso === 'detalle' && (
                            <motion.div
                                key="cta"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4 text-center"
                            >
                                <div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/10 rounded-2xl p-8 space-y-4">
                                    <p className="text-white/60 font-bold text-sm uppercase tracking-wider">
                                        🏆 Asegurá tu lugar y recibí el cronograma oficial antes que nadie
                                    </p>
                                    <button
                                        onClick={() => setPaso('formulario')}
                                        className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black uppercase text-sm tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.03] active:scale-95"
                                        style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
                                    >
                                        Quiero Participar
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {paso === 'formulario' && (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
                                    <h2 className="text-center text-lg font-black uppercase tracking-wider">Registrá tu Interés</h2>
                                    <p className="text-center text-white/50 text-xs font-bold uppercase tracking-widest">
                                        Completá tus datos para coordinar la inscripción
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-white/40 mb-1 block tracking-widest">Nombre Completo *</label>
                                            <input name="nombre" type="text" required value={formData.nombre} onChange={handleInputChange}
                                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                                                placeholder="Tu nombre completo" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-white/40 mb-1 block tracking-widest">WhatsApp *</label>
                                            <input name="whatsapp" type="tel" required value={formData.whatsapp} onChange={handleInputChange}
                                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                                                placeholder="300 123 4567" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-white/40 mb-1 block tracking-widest">Email</label>
                                            <input name="email" type="email" value={formData.email} onChange={handleInputChange}
                                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                                                placeholder="correo@ejemplo.com" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black uppercase text-white/40 mb-1 block tracking-widest">Club / Academia</label>
                                            <input name="clubOrigen" type="text" value={formData.clubOrigen} onChange={handleInputChange}
                                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-sm"
                                                placeholder="Nombre de tu academia" />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={enviando}
                                        className="w-full py-4 rounded-2xl font-black uppercase text-sm tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                        style={{ background: `linear-gradient(135deg, ${colorPrimario}, ${colorSecundario})` }}
                                    >
                                        {enviando ? (
                                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <IconoEnviar className="w-5 h-5" />
                                        )}
                                        {enviando ? 'Registrando...' : 'Confirmar Interés'}
                                    </button>
                                    <button type="button" onClick={() => setPaso('detalle')} className="w-full text-center text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white/60 transition-colors">
                                        ← Volver a los detalles
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {paso === 'exito' && (
                            <motion.div
                                key="exito"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-6 py-8"
                            >
                                <IconoExitoAnimado className="mx-auto w-24 h-24 text-green-400" />
                                <h2 className="text-2xl font-black uppercase tracking-tight">¡Registro Exitoso!</h2>
                                <p className="text-white/60 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-md mx-auto">
                                    Tu interés ha sido registrado. <br />
                                    Para agilizar tu inscripción, contactá directamente a la organización por WhatsApp.
                                </p>
                                {(tenant?.pagoNequi || tenant?.pagoDaviplata) && (
                                    <a
                                        href={generarEnlaceWhatsApp()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-[0.15em] text-white bg-green-600 hover:bg-green-500 shadow-2xl shadow-green-900/50 transition-all hover:scale-[1.03] active:scale-95"
                                    >
                                        <IconoWhatsApp className="w-6 h-6" />
                                        Contactar por WhatsApp
                                    </a>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </motion.section>

            {/* --- FOOTER --- */}
            <footer className="py-8 text-center">
                <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">
                    Tudojang • Gestión Deportiva Inteligente
                </p>
            </footer>
        </div>
    );
};

export default EventoPublico;
