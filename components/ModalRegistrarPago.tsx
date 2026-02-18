import React, { useState, useEffect } from 'react';
import type { Estudiante } from '../tipos';
import { obtenerDeudasEstudiante, procesarPagoEfectivo } from '../servicios/pagosApi';
import type { DeudaPendiente, PagoProcesado, ItemAPagar } from '../servicios/pagosApi';
import {
    IconoCerrar,
    IconoTienda,
    IconoEventos,
    IconoBillete,
    IconoExitoAnimado,
    IconoAlertaTriangulo
} from './Iconos';

interface Props {
    estudiante: Estudiante | null;
    abierto: boolean;
    onCerrar: () => void;
    onPagoExitoso?: () => void;
}

const ModalRegistrarPago: React.FC<Props> = ({ estudiante, abierto, onCerrar, onPagoExitoso }) => {
    const [deudas, setDeudas] = useState<DeudaPendiente[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [resultado, setResultado] = useState<PagoProcesado | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Efecto para cargar deudas al abrir el modal
    useEffect(() => {
        if (abierto && estudiante) {
            cargarDeudas();
            setResultado(null);
            setError(null);
            setSeleccionados(new Set());
        }
    }, [abierto, estudiante]);

    const cargarDeudas = async () => {
        if (!estudiante) return;
        setLoading(true);
        try {
            const resumen = await obtenerDeudasEstudiante(estudiante.id);
            setDeudas(resumen.items);
        } catch (err: any) {
            console.error("Error cargando deudas:", err);
            setError("No se pudieron cargar las deudas pendientes.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSeleccion = (id: string) => {
        const newSet = new Set(seleccionados);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSeleccionados(newSet);
    };

    const calcularTotalSeleccionado = () => {
        return deudas
            .filter(d => seleccionados.has(d.id))
            .reduce((acc, curr) => acc + curr.monto, 0);
    };

    const handleProcesarPago = async () => {
        if (!estudiante) return;

        const itemsAPagar: ItemAPagar[] = deudas
            .filter(d => seleccionados.has(d.id))
            .map(d => ({
                id: d.id,
                tipo: d.tipo,
                monto: d.monto
            }));

        if (itemsAPagar.length === 0) {
            setError("Debes seleccionar al menos un ítem para pagar.");
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const total = calcularTotalSeleccionado();
            const res = await procesarPagoEfectivo(
                estudiante.id,
                itemsAPagar,
                total,
                "Pago en Efectivo (Caja)", // Concepto automático
                "" // Notas opcionales (podríamos agregar un campo de texto si fuera necesario)
            );

            if (res.exito) {
                setResultado(res);
                if (onPagoExitoso) onPagoExitoso();
            } else {
                setError(res.mensaje || "Error al procesar el pago.");
            }
        } catch (err: any) {
            console.error("Error procesando pago:", err);
            setError(err.message || "Error desconocido al procesar pago.");
        } finally {
            setProcessing(false);
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

    const formatMoneda = (valor: number) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);
    };

    if (!abierto || !estudiante) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-xl font-black text-tkd-dark dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <IconoBillete className="w-6 h-6 text-green-600" />
                            Registrar Pago
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">
                            Estudiante: <span className="text-tkd-blue font-bold">{estudiante.nombres} {estudiante.apellidos}</span>
                        </p>
                    </div>
                    <button
                        onClick={onCerrar}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
                    >
                        <IconoCerrar className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {resultado ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-scale-in">
                            <div className="text-green-500 mb-4">
                                <IconoExitoAnimado className="w-24 h-24" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">¡Pago Exitoso!</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md">
                                Se ha registrado el pago correctamente. El saldo del estudiante ha sido actualizado.
                            </p>
                            <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-xl mb-6 w-full max-w-xs">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Recibo #</p>
                                <p className="text-lg font-mono font-bold text-gray-800 dark:text-white">{resultado.reciboId}</p>
                            </div>
                            <button
                                onClick={onCerrar}
                                className="px-8 py-3 bg-tkd-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30"
                            >
                                Cerrar y Continuar
                            </button>
                        </div>
                    ) : (
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
                                    <p className="text-gray-500 mt-2">No se encontraron deudas pendientes registradas.</p>
                                    <p className="text-xs text-gray-400 mt-4 max-w-xs mx-auto">
                                        Nota: Si deseas registrar un pago adelantado, usa la sección de Movimientos Financieros generales.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-start gap-3">
                                        <IconoAlertaTriangulo className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                            <p className="font-bold text-blue-800 dark:text-blue-300">Selecciona los conceptos a pagar</p>
                                            <p className="text-blue-600 dark:text-blue-400">Puedes seleccionar múltiples ítems. El total se calculará automáticamente.</p>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-gray-100 dark:divide-gray-700 border dark:border-gray-700 rounded-xl overflow-hidden">
                                        {deudas.map((deuda) => {
                                            const isSelected = seleccionados.has(deuda.id);
                                            return (
                                                <div
                                                    key={deuda.id}
                                                    onClick={() => toggleSeleccion(deuda.id)}
                                                    className={`
                                                        p-4 flex items-center gap-4 cursor-pointer transition-colors
                                                        ${isSelected
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/20'
                                                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                                                    `}
                                                >
                                                    <div className={`
                                                        w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                        ${isSelected
                                                            ? 'bg-tkd-blue border-tkd-blue text-white'
                                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}
                                                    `}>
                                                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {getIconoPorTipo(deuda.tipo)}
                                                            <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{deuda.tipo}</span>
                                                        </div>
                                                        <p className="font-bold text-gray-800 dark:text-white line-clamp-1">{deuda.descripcion}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            Generado: {new Date(deuda.fechaGeneracion).toLocaleDateString()}
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="font-black text-lg text-tkd-dark dark:text-white">
                                                            {formatMoneda(deuda.monto)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2 animate-shake">
                                    <IconoAlertaTriangulo className="w-5 h-5" />
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                {!resultado && deudas.length > 0 && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="text-center sm:text-left">
                            <p className="text-xs text-gray-500 uppercase font-black tracking-wider mb-1">Total a Pagar</p>
                            <p className="text-3xl font-black text-tkd-blue">
                                {formatMoneda(calcularTotalSeleccionado())}
                            </p>
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
                                className={`
                                    flex-1 sm:flex-none px-8 py-3 bg-tkd-blue text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 
                                    hover:bg-blue-700 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {processing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IconoBillete className="w-5 h-5" />
                                        <span>Confirmar Pago</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModalRegistrarPago;
