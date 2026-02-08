
// components/AsistenteVirtual.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconoLogoOficial, IconoCerrar, IconoEnviar, IconoAprobar, IconoInformacion, IconoWhatsApp } from './Iconos';
import { consultarSabonimVirtual, getRemainingQueries } from '../servicios/soporteService';
import { crearTicketSoporte, escucharMiTicketActivo } from '../servicios/soporteApi';
import { useAuth } from '../context/AuthContext';
import { TicketSoporte, EtapaSoporte } from '../tipos';

const AsistenteVirtual: React.FC = () => {
    const { usuario } = useAuth();
    const [abierto, setAbierto] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [historial, setHistorial] = useState<{ texto: string; soyYo: boolean }[]>([]);
    const [cargando, setCargando] = useState(false);
    const [mostrarBtnEscalar, setMostrarBtnEscalar] = useState(false);
    const [miTicket, setMiTicket] = useState<TicketSoporte | null>(null);
    const [restantes, setRestantes] = useState(getRemainingQueries());
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (abierto && historial.length === 0) {
            setHistorial([{ texto: "Kyeong-rye Sabonim. ¿En qué módulo técnico puedo orientarte hoy?", soyYo: false }]);
        }
        setRestantes(getRemainingQueries());
    }, [abierto]);

    useEffect(() => {
        if (usuario) {
            const desSuscribir = escucharMiTicketActivo(usuario.id, setMiTicket);
            return () => desSuscribir();
        }
    }, [usuario]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [historial, cargando]);

    const manejarEnviar = async () => {
        if (!mensaje.trim() || cargando || restantes <= 0) return;

        const miPregunta = mensaje;
        setMensaje('');
        setHistorial(prev => [...prev, { texto: miPregunta, soyYo: true }]);
        setCargando(true);
        setMostrarBtnEscalar(false);

        const contextoPrevio = historial.slice(-3).map(h => h.texto).join(' | ');
        const respuestaRaw = await consultarSabonimVirtual(miPregunta, contextoPrevio);
        
        let respuestaLimpia = respuestaRaw;
        if (respuestaRaw.includes('[ESCALAR_SOPORTE_MASTER]')) {
            respuestaLimpia = respuestaRaw.replace('[ESCALAR_SOPORTE_MASTER]', '').trim();
            setMostrarBtnEscalar(true);
        }

        setHistorial(prev => [...prev, { texto: respuestaLimpia || "Entendido. ¿Deseas escalar a soporte humano?", soyYo: false }]);
        setCargando(false);
        setRestantes(getRemainingQueries());
    };

    const solicitarEscalado = async () => {
        if (!usuario) return;
        setCargando(true);
        try {
            await crearTicketSoporte({
                tenantId: usuario.tenantId,
                userId: usuario.id,
                userNombre: usuario.nombreUsuario,
                userEmail: usuario.email,
                asunto: "Escalado desde Asistente Virtual",
                resumenIA: historial.map(h => h.texto).join('\n')
            });
            setHistorial(prev => [...prev, { texto: "Su solicitud ha sido elevada al Soporte Master. He abierto un canal de seguimiento prioritario para usted.", soyYo: false }]);
            setMostrarBtnEscalar(false);
        } catch (e) {
            console.error(e);
        } finally {
            setCargando(false);
        }
    };

    const EtapasVisuales = () => {
        if (!miTicket) return null;
        const etapas = [
            { id: 1, label: 'Recibido' },
            { id: 2, label: 'Diagnóstico' },
            { id: 3, label: 'Resolución' },
            { id: 4, label: 'Verificado' }
        ];

        return (
            <div className="p-5 bg-tkd-blue/5 dark:bg-tkd-blue/10 border-b dark:border-gray-800">
                <p className="text-[9px] font-black uppercase text-tkd-blue mb-4 tracking-widest text-center">Estatus Soporte Premium</p>
                <div className="flex justify-between relative">
                    <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
                    {etapas.map(e => {
                        const activo = miTicket.etapa >= e.id;
                        return (
                            <div key={e.id} className="flex flex-col items-center gap-1">
                                <div className={`w-4 h-4 rounded-full border-2 transition-all duration-500 ${activo ? 'bg-tkd-blue border-tkd-blue shadow-lg scale-110' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                    {activo && <IconoAprobar className="w-2.5 h-2.5 text-white m-auto" />}
                                </div>
                                <span className={`text-[7px] font-black uppercase tracking-tighter ${activo ? 'text-tkd-blue' : 'text-gray-400'}`}>{e.label}</span>
                            </div>
                        );
                    })}
                </div>
                {miTicket.salaVideoUrl && (
                    <div className="mt-4 animate-bounce">
                        <a 
                            href={miTicket.salaVideoUrl} 
                            target="_blank" 
                            className="w-full bg-tkd-red text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl"
                        >
                            <IconoWhatsApp className="w-3.5 h-3.5" /> Entrar a Sala de Video
                        </a>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            <AnimatePresence>
                {abierto && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="mb-4 w-72 sm:w-80 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col"
                    >
                        {/* Header Premium */}
                        <div className="bg-tkd-dark p-6 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <IconoLogoOficial className="w-6 h-6 text-tkd-red" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Aliant Master Support</p>
                                    {miTicket ? (
                                        <p className="text-[8px] font-bold text-green-400 uppercase mt-1">Caso: #{miTicket.id.slice(-4)}</p>
                                    ) : (
                                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Consultas IA: {restantes}/15</p>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setAbierto(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <IconoCerrar className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Seguimiento de Etapas si hay ticket */}
                        <EtapasVisuales />

                        {/* Chat */}
                        <div ref={scrollRef} className="h-72 overflow-y-auto p-5 space-y-4 no-scrollbar bg-gray-50/50 dark:bg-gray-950/50">
                            {historial.map((h, i) => (
                                <div key={i} className={`flex ${h.soyYo ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed ${h.soyYo ? 'bg-tkd-blue text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none shadow-sm'}`}>
                                        {h.texto}
                                    </div>
                                </div>
                            ))}
                            {mostrarBtnEscalar && (
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="pt-2">
                                    <button 
                                        onClick={solicitarEscalado}
                                        className="w-full bg-tkd-dark text-white p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 hover:bg-blue-900 transition-all shadow-xl flex items-center justify-center gap-2"
                                    >
                                        <IconoInformacion className="w-4 h-4 text-tkd-red" /> Solicitar Asesor Master
                                    </button>
                                </motion.div>
                            )}
                            {cargando && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 bg-tkd-red rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-tkd-red rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-2 h-2 bg-tkd-red rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t dark:border-gray-800 bg-white dark:bg-gray-900">
                            <div className="relative">
                                <input 
                                    value={mensaje}
                                    onChange={(e) => setMensaje(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && manejarEnviar()}
                                    placeholder={restantes > 0 ? "Describa su inquietud..." : "Límite IA excedido"}
                                    disabled={restantes <= 0 || cargando}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 pl-5 pr-14 text-[11px] font-bold dark:text-white outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner"
                                />
                                <button 
                                    onClick={manejarEnviar}
                                    disabled={!mensaje.trim() || cargando || restantes <= 0}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-tkd-blue hover:scale-110 transition-transform disabled:opacity-30"
                                >
                                    <IconoEnviar className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAbierto(!abierto)}
                className="w-16 h-16 bg-tkd-dark text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white dark:border-gray-800 relative group"
            >
                <IconoLogoOficial className={`w-10 h-10 transition-transform duration-500 ${abierto ? 'rotate-180' : ''}`} />
                {miTicket && !abierto && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 animate-pulse">
                        !
                    </div>
                )}
                {!miTicket && !abierto && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-tkd-red text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                        {restantes}
                    </div>
                )}
            </motion.button>
        </div>
    );
};

export default AsistenteVirtual;
