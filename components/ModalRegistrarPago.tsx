import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Estudiante, TransaccionPago } from '../tipos';
import { RolUsuario } from '../tipos';
import { useAuth } from '../context/AuthContext';
import { obtenerDeudasEstudiante, procesarPagoEfectivo, obtenerUltimoPagoEfectivo, anularUltimoPagoEfectivo } from '../servicios/pagosApi';
import type { DeudaPendiente, PagoProcesado, ItemAPagar } from '../servicios/pagosApi';
import { useGeneradorComprobante } from './ComprobantesPago';
import type { DatosComprobante } from './ComprobantesPago';
import { obtenerConfiguracionClub } from '../servicios/configuracionApi';
import type { ConfiguracionClub } from '../tipos';
import { useNotificacion } from '../context/NotificacionContext';
import ModalConfirmacion from './ModalConfirmacion';
import {
    IconoCerrar,
    IconoTienda,
    IconoEventos,
    IconoBillete,
    IconoExitoAnimado,
    IconoAlertaTriangulo,
    IconoExportar,
    IconoWhatsApp,
    IconoDeshacer
} from './Iconos';

interface Props {
    estudiante: Estudiante | null;
    abierto: boolean;
    onCerrar: () => void;
    onPagoExitoso?: () => void;
}

type TabVista = 'cobrar' | 'ultimo_pago';

const ModalRegistrarPago: React.FC<Props> = ({ estudiante, abierto, onCerrar, onPagoExitoso }) => {
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();
    const esAdmin = usuario?.rol === RolUsuario.Admin;

    const [tabActiva, setTabActiva] = useState<TabVista>('cobrar');
    const [deudas, setDeudas] = useState<DeudaPendiente[]>([]);
    const [ultimoPago, setUltimoPago] = useState<TransaccionPago | null>(null);
    const [cargandoUltimoPago, setCargandoUltimoPago] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [generandoImg, setGenerandoImg] = useState(false);
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [resultado, setResultado] = useState<PagoProcesado | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [configClub, setConfigClub] = useState<ConfiguracionClub | null>(null);
    const [imagenComprobante, setImagenComprobante] = useState<string | null>(null);

    const [modalAnularAbierto, setModalAnularAbierto] = useState(false);
    const [cargandoAnulacion, setCargandoAnulacion] = useState(false);

    const { generarImagen, descargarComprobante, compartirPorWhatsApp } = useGeneradorComprobante();

    // Efecto para cargar deudas y config al abrir el modal
    useEffect(() => {
        if (abierto && estudiante) {
            setTabActiva('cobrar');
            cargarDatosFinancieros();
            cargarConfig();
            setResultado(null);
            setError(null);
            setSeleccionados(new Set());
            setImagenComprobante(null);
        }
    }, [abierto, estudiante]);

    const cargarDatosFinancieros = async () => {
        await cargarDeudas();
        if (esAdmin) {
            await cargarUltimoPago();
        }
    };

    const cargarDeudas = async () => {
        if (!estudiante) return;
        setLoading(true);
        try {
            const resumen = await obtenerDeudasEstudiante(estudiante.id);
            setDeudas(resumen.items);
        } catch (err: any) {
            setError("No se pudieron cargar las deudas pendientes.");
        } finally {
            setLoading(false);
        }
    };

    const cargarUltimoPago = async () => {
        if (!estudiante) return;
        setCargandoUltimoPago(true);
        try {
            const transaccion = await obtenerUltimoPagoEfectivo(estudiante.id);
            setUltimoPago(transaccion);
        } catch (err) {
            console.error("Error cargando último pago", err);
        } finally {
            setCargandoUltimoPago(false);
        }
    };

    const cargarConfig = async () => {
        try {
            const config = await obtenerConfiguracionClub(estudiante?.tenantId);
            setConfigClub(config);
        } catch (e) {
            console.warn("Config no disponible, usando defaults.");
        }
    };

    const toggleSeleccion = (id: string) => {
        const newSet = new Set(seleccionados);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSeleccionados(newSet);
    };

    const calcularTotalSeleccionado = () =>
        deudas.filter(d => seleccionados.has(d.id)).reduce((acc, curr) => acc + curr.monto, 0);

    // Construye los datos del comprobante a partir del resultado del pago
    const construirDatosComprobante = (res: PagoProcesado): DatosComprobante => {
        const itemsSeleccionados = deudas.filter(d => seleccionados.has(d.id));
        return {
            reciboId: res.reciboId || `REC-${Date.now()}`,
            fechaHora: new Date().toISOString(),
            nombreEstudiante: `${estudiante?.nombres} ${estudiante?.apellidos}`,
            nombreTutor: estudiante?.tutor ? `${estudiante.tutor.nombres} ${estudiante.tutor.apellidos}` : undefined,
            telefonoTutor: estudiante?.tutor?.telefono,
            itemsPagados: itemsSeleccionados.map(d => ({
                descripcion: d.descripcion,
                tipo: d.tipo,
                monto: d.monto,
            })),
            montoTotal: calcularTotalSeleccionado(),
            metodoPago: 'Efectivo',
            concepto: 'Pago en Efectivo (Caja)',
        };
    };

    const handleProcesarPago = async () => {
        if (!estudiante) return;

        const itemsAPagar: ItemAPagar[] = deudas
            .filter(d => seleccionados.has(d.id))
            .map(d => ({ id: d.id, tipo: d.tipo, monto: d.monto }));

        setProcessing(true);
        setError(null);

        try {
            const total = calcularTotalSeleccionado();
            const res = await procesarPagoEfectivo(
                estudiante.id,
                itemsAPagar,
                total,
                "Pago en Efectivo (Caja)",
                ""
            );

            if (res.exito) {
                setResultado(res);
                if (onPagoExitoso) onPagoExitoso();
                
                // Actualizamos último pago visible si es admin
                if (esAdmin) {
                    cargarUltimoPago();
                }

                // Generar comprobante automáticamente
                const datosCom = construirDatosComprobante(res);
                if (configClub) {
                    setGenerandoImg(true);
                    const img = await generarImagen(datosCom, configClub);
                    setImagenComprobante(img);
                    setGenerandoImg(false);
                }
            } else {
                setError(res.mensaje || "Error al procesar el pago.");
            }
        } catch (err: any) {
            setError(err.message || "Error desconocido al procesar pago.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDescargar = async () => {
        if (!resultado || !configClub) return;
        const datos = construirDatosComprobante(resultado);
        await descargarComprobante(datos, configClub);
    };

    const handleWhatsApp = async () => {
        if (!resultado || !configClub) return;
        const telefono = estudiante?.tutor?.telefono || estudiante?.telefono || '';
        const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
        if (!telefonoLimpio) {
            alert("El estudiante no tiene número de teléfono registrado.");
            return;
        }
        const datos = construirDatosComprobante(resultado);
        await compartirPorWhatsApp(datos, configClub, telefonoLimpio);
    };

    const handleAnularUltimoPago = async () => {
        if (!estudiante) return;
        setCargandoAnulacion(true);
        try {
            const res = await anularUltimoPagoEfectivo(estudiante.id, usuario?.id);
            if (res.exito) {
                mostrarNotificacion('Pago anulado correctamente', 'success');
                setModalAnularAbierto(false);
                setTabActiva('cobrar');
                // Recargar deudas y estado
                cargarDatosFinancieros();
                if (onPagoExitoso) onPagoExitoso(); // Para refrescar al estudiante en la lista
            } else {
                mostrarNotificacion(res.mensaje || 'Error al anular pago', 'error');
            }
        } catch (error: any) {
            mostrarNotificacion(error.message, 'error');
        } finally {
            setCargandoAnulacion(false);
        }
    };

    const getIconoPorTipo = (tipo: string) => {
        switch (tipo) {
            case 'Tienda': return <IconoTienda className="w-5 h-5 text-purple-500" />;
            case 'Evento': return <IconoEventos className="w-5 h-5 text-orange-500" />;
            case 'Mensualidad': return <IconoBillete className="w-5 h-5 text-blue-500" />;
            default: return <IconoBillete className="w-5 h-5 text-gray-500" />;
        }
    };

    const formatMoneda = (valor: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);

    if (!abierto || !estudiante) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            {modalAnularAbierto && (
                <ModalConfirmacion
                    abierto={modalAnularAbierto}
                    titulo="Deshacer Último Pago"
                    mensaje={`¿Estás seguro de que deseas anular el recibo ${ultimoPago?.reciboId}? Esto restaurará la deuda de ${formatMoneda(ultimoPago?.montoTotal || 0)} y quedará registrado como un egreso contable en auditoría.`}
                    cargando={cargandoAnulacion}
                    onConfirmar={handleAnularUltimoPago}
                    onCerrar={() => setModalAnularAbierto(false)}
                />
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-black text-tkd-dark dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <IconoBillete className="w-6 h-6 text-tkd-blue" />
                                Gestión Financiera
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">
                                Estudiante: <span className="text-tkd-blue font-bold">{estudiante.nombres} {estudiante.apellidos}</span>
                            </p>
                        </div>
                        <button onClick={onCerrar} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                            <IconoCerrar className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs */}
                    {!resultado && esAdmin && (
                        <div className="flex gap-4 border-b dark:border-gray-700">
                            <button
                                onClick={() => setTabActiva('cobrar')}
                                className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
                                    tabActiva === 'cobrar' 
                                        ? 'border-tkd-blue text-tkd-blue' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                Cobrar
                            </button>
                            <button
                                onClick={() => setTabActiva('ultimo_pago')}
                                className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                                    tabActiva === 'ultimo_pago' 
                                        ? 'border-tkd-blue text-tkd-blue' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                Último Recibo
                                {ultimoPago && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {resultado ? (
                        /* --- PANTALLA DE ÉXITO CON COMPROBANTE --- */
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <div className="text-green-500 mb-3">
                                <IconoExitoAnimado className="w-20 h-20" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-1">¡Pago Exitoso!</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">El saldo ha sido actualizado correctamente.</p>

                            <div className="bg-gray-100 dark:bg-gray-700/50 px-6 py-3 rounded-xl mb-6">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Recibo #</p>
                                <p className="text-lg font-mono font-bold text-gray-800 dark:text-white">{resultado.reciboId}</p>
                            </div>

                            {/* Preview del comprobante generado */}
                            {generandoImg ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-tkd-blue"></div>
                                    Generando comprobante...
                                </div>
                            ) : imagenComprobante ? (
                                <div className="mb-6 w-full max-w-xs">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Vista Previa del Comprobante</p>
                                    <img
                                        src={imagenComprobante}
                                        alt="Comprobante de pago"
                                        className="w-full rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
                                    />
                                </div>
                            ) : null}

                            {/* Botones de acción del comprobante */}
                            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                <button
                                    onClick={handleDescargar}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                                >
                                    <IconoExportar className="w-5 h-5" />
                                    Descargar PNG
                                </button>
                                <button
                                    onClick={handleWhatsApp}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
                                >
                                    <IconoWhatsApp className="w-5 h-5" />
                                    Enviar WA
                                </button>
                            </div>

                            <button
                                onClick={onCerrar}
                                className="mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                Cerrar y Continuar →
                            </button>
                        </div>
                    ) : tabActiva === 'cobrar' ? (
                        <>
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tkd-blue"></div>
                                </div>
                            ) : deudas.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <IconoBillete className="w-8 h-8 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Estudiante Al Día</h3>
                                    <p className="text-gray-500 mt-2">No se encontraron deudas pendientes.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-start gap-3">
                                        <IconoAlertaTriangulo className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                            <p className="font-bold text-blue-800 dark:text-blue-300">Selecciona los conceptos a pagar</p>
                                            <p className="text-blue-600 dark:text-blue-400">Al confirmar se generará el comprobante PNG automáticamente.</p>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-gray-700 border dark:border-gray-700 rounded-xl overflow-hidden">
                                        {deudas.map((deuda) => {
                                            const isSelected = seleccionados.has(deuda.id);
                                            return (
                                                <div
                                                    key={deuda.id}
                                                    onClick={() => toggleSeleccion(deuda.id)}
                                                    className={`p-4 flex items-center gap-4 cursor-pointer transition-colors
                                                        ${isSelected
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/20'
                                                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                                                        ${isSelected
                                                            ? 'bg-tkd-blue border-tkd-blue text-white'
                                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                                                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {getIconoPorTipo(deuda.tipo)}
                                                            <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{deuda.tipo}</span>
                                                        </div>
                                                        <p className="font-bold text-gray-800 dark:text-white line-clamp-1">{deuda.descripcion}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">Generado: {new Date(deuda.fechaGeneracion).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-lg text-tkd-dark dark:text-white">{formatMoneda(deuda.monto)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
                                    <IconoAlertaTriangulo className="w-5 h-5" />
                                    {error}
                                </div>
                            )}
                        </>
                    ) : (
                        /* --- PESTAÑA: ÚLTIMO RECIBO --- */
                        <>
                            {cargandoUltimoPago ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tkd-blue"></div>
                                </div>
                            ) : ultimoPago ? (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Recibo Completado</p>
                                                <p className="text-xl font-mono font-bold text-gray-800 dark:text-white">{ultimoPago.reciboId}</p>
                                                <p className="text-sm text-gray-500 mt-1">{new Date(ultimoPago.fecha).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Monto Total</p>
                                                <p className="text-2xl font-black text-green-600 dark:text-green-400">{formatMoneda(ultimoPago.montoTotal)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400 border-b dark:border-gray-700 pb-2">Conceptos Pagados</p>
                                            {ultimoPago.itemsPagados.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        {getIconoPorTipo(item.tipo)}
                                                        <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{item.tipo}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-800 dark:text-white">{formatMoneda(item.monto)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-full text-red-600 dark:text-red-400 shrink-0">
                                                <IconoDeshacer className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-red-800 dark:text-red-400 font-black uppercase tracking-tight mb-1">Deshacer Pago</h4>
                                                <p className="text-sm text-red-600 dark:text-red-300 leading-relaxed mb-4">
                                                    Si el pago se registró por error, podés anularlo. El saldo volverá a la cuenta del estudiante y el pago quedará marcado como 'Anulado' en la contabilidad.
                                                </p>
                                                <button
                                                    onClick={() => setModalAnularAbierto(true)}
                                                    className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-700 hover:shadow-red-600/40 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <IconoDeshacer className="w-5 h-5" />
                                                    Anular Este Recibo
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <IconoBillete className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p>No se encontraron pagos recientes que se puedan anular.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions (solo en modo selección de Cobrar) */}
                {!resultado && tabActiva === 'cobrar' && deudas.length > 0 && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="text-center sm:text-left">
                            <p className="text-xs text-gray-500 uppercase font-black tracking-wider mb-1">Total a Pagar</p>
                            <p className="text-3xl font-black text-tkd-blue">{formatMoneda(calcularTotalSeleccionado())}</p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                onClick={onCerrar}
                                disabled={processing}
                                className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleProcesarPago}
                                disabled={processing || seleccionados.size === 0}
                                className="flex-1 sm:flex-none px-8 py-3 bg-tkd-blue text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IconoBillete className="w-5 h-5" />
                                        <span>Confirmar y Generar Recibo</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ModalRegistrarPago;
