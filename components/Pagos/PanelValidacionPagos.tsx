
// components/Pagos/PanelValidacionPagos.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerReportesPendientes, gestionarReportePago, aprobarReportesEnLote } from '../../servicios/pagosEstudiantesApi';
import { ReportePagoEstudiante, EstadoValidacion } from '../../tipos';
import { IconoAprobar, IconoRechazar, IconoUsuario, IconoInformacion, IconoLogoOficial, IconoAlertaTriangulo } from '../Iconos';
import { formatearPrecio, formatearFecha } from '../../utils/formatters';

const tieneAdvertencias = (reporte: ReportePagoEstudiante) => (reporte.datosIA?.advertencias?.length ?? 0) > 0;

const PanelValidacionPagos: React.FC = () => {
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();
    const [reportes, setReportes] = useState<ReportePagoEstudiante[]>([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState<string | null>(null);
    const [procesandoLote, setProcesandoLote] = useState(false);
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
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
            setSeleccionados(prev => {
                const next = new Set(prev);
                next.delete(reporte.id);
                return next;
            });
        } catch (e) {
            mostrarNotificacion("Error al procesar el pago.", "error");
        } finally {
            setProcesando(null);
        }
    };

    const toggleSeleccion = (id: string) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // "Seleccionar todos" NUNCA arrastra reportes con advertencias -- esos requieren que el
    // admin los revise y los marque a mano, para no aprobar en lote una discrepancia sin ver.
    const reportesSeleccionablesEnLote = reportes.filter(r => !tieneAdvertencias(r));
    const todosSeleccionados = reportesSeleccionablesEnLote.length > 0
        && reportesSeleccionablesEnLote.every(r => seleccionados.has(r.id));

    const toggleSeleccionarTodos = () => {
        setSeleccionados(prev => {
            if (todosSeleccionados) {
                const next = new Set(prev);
                reportesSeleccionablesEnLote.forEach(r => next.delete(r.id));
                return next;
            }
            const next = new Set(prev);
            reportesSeleccionablesEnLote.forEach(r => next.add(r.id));
            return next;
        });
    };

    const handleAprobarSeleccionados = async () => {
        if (!usuario || seleccionados.size === 0) return;
        setProcesandoLote(true);
        try {
            const reportesAAprobar = reportes.filter(r => seleccionados.has(r.id));
            const resultado = await aprobarReportesEnLote(reportesAAprobar, usuario.id);
            if (resultado.exitosos.length > 0) {
                mostrarNotificacion(`${resultado.exitosos.length} pago(s) aprobado(s) y saldo actualizado.`, "success");
            }
            if (resultado.fallidos.length > 0) {
                mostrarNotificacion(
                    `${resultado.fallidos.length} reporte(s) no se pudieron aprobar: ${resultado.fallidos.map(f => f.error).join(' | ')}`,
                    "error"
                );
            }
            setReportes(prev => prev.filter(r => !resultado.exitosos.includes(r.id)));
            setSeleccionados(prev => {
                const next = new Set(prev);
                resultado.exitosos.forEach(id => next.delete(id));
                return next;
            });
        } catch (e) {
            mostrarNotificacion("Error al procesar la aprobación en lote.", "error");
        } finally {
            setProcesandoLote(false);
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
            {/* Barra de acción en lote */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-soft p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        disabled={reportesSeleccionablesEnLote.length === 0}
                        onChange={toggleSeleccionarTodos}
                        className="w-5 h-5 rounded-md accent-tkd-blue"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">
                        Seleccionar todos ({reportesSeleccionablesEnLote.length} sin advertencias)
                    </span>
                </label>
                <button
                    onClick={handleAprobarSeleccionados}
                    disabled={seleccionados.size === 0 || procesandoLote}
                    className="py-3 px-6 bg-tkd-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                    {procesandoLote ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <IconoAprobar className="w-4 h-4" />}
                    Aprobar seleccionados ({seleccionados.size})
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AnimatePresence>
                    {reportes.map(reporte => {
                        const advertencias = reporte.datosIA?.advertencias ?? [];
                        return (
                        <motion.div
                            key={reporte.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-soft overflow-hidden flex flex-col sm:flex-row group transition-all hover:shadow-2xl"
                        >
                            {/* Selección + Visual del Comprobante */}
                            <div className="w-full sm:w-48 h-64 sm:h-auto bg-gray-100 dark:bg-gray-900 relative cursor-zoom-in" onClick={() => setImagenAmpliada(reporte.comprobanteUrl)}>
                                <img src={reporte.comprobanteUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Recibo" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black text-[9px] uppercase tracking-widest transition-opacity">Ver Detalle</div>
                                <input
                                    type="checkbox"
                                    checked={seleccionados.has(reporte.id)}
                                    onClick={e => e.stopPropagation()}
                                    onChange={() => toggleSeleccion(reporte.id)}
                                    className="absolute top-4 left-4 w-6 h-6 rounded-lg accent-tkd-blue shadow-lg"
                                />
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

                                {/* Resultados de la IA */}
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

                                {/* Advertencias de la IA (discrepancia de monto, referencia duplicada, etc) */}
                                {advertencias.length > 0 && (
                                    <div className="bg-tkd-red/10 border border-tkd-red/30 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-tkd-red">
                                            <IconoAlertaTriangulo className="w-4 h-4" />
                                            <p className="text-[9px] font-black uppercase tracking-widest">Advertencias -- revisar antes de aprobar</p>
                                        </div>
                                        <ul className="space-y-1 list-disc list-inside">
                                            {advertencias.map((adv, i) => (
                                                <li key={i} className="text-[10px] font-bold text-tkd-red/90 leading-snug">{adv}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

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
                        );
                    })}
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
