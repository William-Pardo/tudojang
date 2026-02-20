
// components/Pagos/PanelValidacionPagos.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerReportesPendientes, gestionarReportePago } from '../../servicios/pagosEstudiantesApi';
import { ReportePagoEstudiante, EstadoValidacion } from '../../tipos';
import { IconoAprobar, IconoRechazar, IconoUsuario, IconoInformacion, IconoLogoOficial } from '../Iconos';
import { formatearPrecio, formatearFecha } from '../../utils/formatters';

const PanelValidacionPagos: React.FC = () => {
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();
    const [reportes, setReportes] = useState<ReportePagoEstudiante[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState<string | null>(null);
    const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

    const cargarReportes = async () => {
        if (!usuario) return;
        try {
            const data = await obtenerReportesPendientes(usuario.tenantId);
            setReportes(data);
        } catch (e) {
            mostrarNotificacion("Error al cargar reportes de pago.", "error");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargarReportes(); }, [usuario]);

    const handleGestionar = async (reporte: ReportePagoEstudiante, aprobado: boolean) => {
        if (!usuario) return;
        setProcesando(reporte.id);
        try {
            const nuevoEstado = aprobado ? EstadoValidacion.Aprobado : EstadoValidacion.Rechazado;
            await gestionarReportePago(reporte, nuevoEstado, usuario.id);
            mostrarNotificacion(aprobado ? "Pago aprobado y saldo actualizado." : "Pago rechazado.", aprobado ? "success" : "info");
            setReportes(prev => prev.filter(r => r.id !== reporte.id));
        } catch (e) {
            mostrarNotificacion("Error al procesar el pago.", "error");
        } finally {
            setProcesando(null);
        }
    };

    if (cargando) return <div className="p-10 text-center text-gray-400 font-black uppercase text-xs animate-pulse">Analizando Transacciones...</div>;

    if (reportes.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-20 text-center space-y-4 border border-gray-100 dark:border-white/5 shadow-soft">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto opacity-40">
                    <IconoAprobar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Sin Reportes Pendientes</h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Todos los pagos informados por los alumnos han sido procesados.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AnimatePresence>
                    {reportes.map(reporte => (
                        <motion.div
                            key={reporte.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-soft overflow-hidden flex flex-col sm:flex-row group transition-all hover:shadow-2xl"
                        >
                            {/* Visual del Comprobante */}
                            <div className="w-full sm:w-48 h-64 sm:h-auto bg-gray-100 dark:bg-gray-900 relative cursor-zoom-in" onClick={() => setImagenAmpliada(reporte.comprobanteUrl)}>
                                <img src={reporte.comprobanteUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Recibo" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black text-[9px] uppercase tracking-widest transition-opacity">Ver Detalle</div>
                            </div>

                            {/* Información del Pago */}
                            <div className="flex-1 p-8 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white leading-none">{reporte.estudianteNombre}</h4>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-2">ID Reporte: {reporte.id.slice(-8)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-tkd-blue tracking-tighter">{formatearPrecio(reporte.montoInformado)}</p>
                                        <p className="text-[9px] font-black uppercase text-tkd-red tracking-widest mt-1">Monto Informado</p>
                                    </div>
                                </div>

                                {/* Resultados de la IA (Placeholder para el futuro) */}
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-white/5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <IconoLogoOficial className="w-4 h-4 text-tkd-blue animate-pulse" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Análisis Inteligente</p>
                                    </div>

                                    {reporte.datosIA ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase">Ref. Extraída</p>
                                                <p className="text-[11px] font-black dark:text-white font-mono">{reporte.datosIA.referencia || 'NO DETECTADA'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase">Monto por IA</p>
                                                <p className="text-[11px] font-black text-green-600">{reporte.datosIA.montoExtraido ? formatearPrecio(reporte.datosIA.montoExtraido) : '---'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] font-medium text-gray-400 italic">Esperando procesamiento de visión artificial...</p>
                                    )}
                                </div>

                                {/* Acciones */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleGestionar(reporte, false)}
                                        disabled={!!procesando}
                                        className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-tkd-red hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <IconoRechazar className="w-4 h-4" /> Rechazar
                                    </button>
                                    <button
                                        onClick={() => handleGestionar(reporte, true)}
                                        disabled={!!procesando}
                                        className="flex-[2] py-4 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {procesando === reporte.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-4 h-4" />}
                                        Validar & Emitir Recibo
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Modal Imagen Ampliada */}
            <AnimatePresence>
                {imagenAmpliada && (
                    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setImagenAmpliada(null)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-4xl w-full h-[80vh] bg-white rounded-[3rem] overflow-hidden shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <img src={imagenAmpliada} className="w-full h-full object-contain p-4" alt="Detalle Comprobante" />
                            <button onClick={() => setImagenAmpliada(null)} className="absolute top-6 right-6 p-4 bg-tkd-dark text-white rounded-full">X</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PanelValidacionPagos;
