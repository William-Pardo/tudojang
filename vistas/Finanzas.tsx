
// vistas/Finanzas.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useFinanzas, useSedes, useEstudiantes } from '../context/DataContext';
import { TipoMovimiento, type MovimientoFinanciero, RolUsuario } from '../tipos';
import { formatearPrecio } from '../utils/formatters';
import { IconoAgregar, IconoExportar, IconoEditar, IconoEliminar, IconoDashboard, IconoMenu } from '../components/Iconos';
import EmptyState from '../components/EmptyState';
import FormularioMovimiento from '../components/FormularioMovimiento';
import ModalConfirmacion from '../components/ModalConfirmacion';
import InformeVisualEjecutivo from '../components/Finanzas/InformeVisualEjecutivo';
import { useNotificacion } from '../context/NotificacionContext';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

interface Props {
    isSubView?: boolean;
    initialView?: 'diario' | 'analitica';
}

const VistaFinanzas: React.FC<Props> = ({ isSubView = false, initialView = 'diario' }) => {
    const { movimientos, cargando, cargarMovimientos, agregarMovimiento, actualizarMovimiento, eliminarMovimiento } = useFinanzas();
    const { sedes } = useSedes();
    const { estudiantes } = useEstudiantes();
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();

    const [filtroSede, setFiltroSede] = useState('todas');
    const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
    const [filtroFechaFin, setFiltroFechaFin] = useState('');

    const [vistaAnalitica, setVistaAnalitica] = useState(initialView === 'analitica');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [movimientoEnEdicion, setMovimientoEnEdicion] = useState<MovimientoFinanciero | null>(null);
    const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
    const [movimientoAEliminar, setMovimientoAEliminar] = useState<MovimientoFinanciero | null>(null);
    const [cargandoAccion, setCargandoAccion] = useState(false);

    const esAdmin = usuario?.rol === RolUsuario.Admin;

    useEffect(() => {
        cargarMovimientos(filtroSede);
    }, [filtroSede, cargarMovimientos]);

    // Sincronizar vista si cambia la prop
    useEffect(() => {
        setVistaAnalitica(initialView === 'analitica');
    }, [initialView]);

    const movimientosFiltrados = useMemo(() => {
        return movimientos.filter(m => {
            const fechaValida = (!filtroFechaInicio || m.fecha >= filtroFechaInicio) &&
                (!filtroFechaFin || m.fecha <= filtroFechaFin);
            return fechaValida;
        });
    }, [movimientos, filtroFechaInicio, filtroFechaFin]);

    const handleGuardarMovimiento = async (data: Omit<MovimientoFinanciero, 'id'> | MovimientoFinanciero) => {
        setCargandoAccion(true);
        try {
            if ('id' in data) {
                await actualizarMovimiento(data as MovimientoFinanciero);
                mostrarNotificacion("Movimiento actualizado", "success");
            } else {
                await agregarMovimiento(data);
                mostrarNotificacion("Movimiento registrado", "success");
            }
            setModalAbierto(false);
            setMovimientoEnEdicion(null);
        } catch (err: any) {
            mostrarNotificacion("Error al procesar", "error");
        } finally {
            setCargandoAccion(false);
        }
    };

    const handleConfirmarEliminacion = async () => {
        if (!movimientoAEliminar) return;
        setCargandoAccion(true);
        try {
            await eliminarMovimiento(movimientoAEliminar.id);
            mostrarNotificacion("Eliminado correctamente", "success");
            setModalEliminarAbierto(false);
            setMovimientoAEliminar(null);
        } catch (err: any) {
            mostrarNotificacion("Error al eliminar", "error");
        } finally {
            setCargandoAccion(false);
        }
    };

    if (cargando && movimientos.length === 0) return <div className="p-8"><Loader texto="Cargando finanzas..." /></div>;

    const selectClasses = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white shadow-inner focus:ring-2 focus:ring-tkd-blue outline-none transition-all text-sm font-black uppercase";

    return (
        <div className={`space-y-10 animate-fade-in ${!isSubView ? 'p-4 sm:p-12 bg-tkd-gray dark:bg-gray-950 min-h-screen' : ''}`}>
            {!isSubView && (
                <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                    <div>
                        <h1 className="text-4xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-none">Libro de Tesorería</h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Sincronización de flujos y balance operativo</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-1 rounded-full md:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex flex-row gap-1 p-0.5">
                            <button
                                onClick={() => setVistaAnalitica(false)}
                                className={`px-8 py-3 rounded-full md:rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${!vistaAnalitica ? 'bg-tkd-dark text-white shadow-lg scale-[1.02]' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <IconoMenu className="w-4 h-4" /> Diario
                            </button>
                            <button
                                onClick={() => setVistaAnalitica(true)}
                                className={`px-8 py-3 rounded-full md:rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${vistaAnalitica ? 'bg-tkd-blue text-white shadow-lg scale-[1.02]' : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                                <IconoDashboard className="w-4 h-4" /> Analíticas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barra de Filtros */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div>
                    <label className="text-[10px] uppercase font-black text-gray-400 block mb-2 ml-1 tracking-widest">Sede / Dojang</label>
                    <select value={filtroSede} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFiltroSede(e.target.value)} className={selectClasses}>
                        <option value="todas">Todas las Sedes</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] uppercase font-black text-gray-400 block mb-2 ml-1 tracking-widest">Fecha Inicio</label>
                    <input type="date" value={filtroFechaInicio} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltroFechaInicio(e.target.value)} className={selectClasses} />
                </div>
                <div>
                    <label className="text-[10px] uppercase font-black text-gray-400 block mb-2 ml-1 tracking-widest">Fecha Fin</label>
                    <input type="date" value={filtroFechaFin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltroFechaFin(e.target.value)} className={selectClasses} />
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setMovimientoEnEdicion(null); setModalAbierto(true); }} className="flex-grow bg-tkd-blue text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <IconoAgregar className="w-4 h-4" /> Registrar
                    </button>
                    <button className="bg-green-50 text-green-600 dark:bg-green-600/10 dark:text-green-500 p-4 rounded-xl border border-green-100 dark:border-green-600/20 hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Exportar CSV">
                        <IconoExportar className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {vistaAnalitica ? (
                <InformeVisualEjecutivo movimientos={movimientosFiltrados} estudiantes={estudiantes} sedes={sedes} />
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {movimientosFiltrados.length === 0 ? (
                        <div className="p-20 text-center">
                            <EmptyState Icono={IconoAgregar} titulo="Sin registros financieros" mensaje="No se encontraron movimientos con los filtros actuales." />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">Concepto / Descripción</th>
                                        <th className="px-6 py-4">Categoría</th>
                                        <th className="px-6 py-4 text-right">Monto (COP)</th>
                                        <th className="px-6 py-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {movimientosFiltrados.map(m => (
                                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">{m.fecha}</td>
                                            <td className="px-6 py-4 font-black text-gray-900 dark:text-white uppercase text-xs tracking-tight">{m.descripcion}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-blue-50 text-tkd-blue dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-[9px] font-black uppercase tracking-tighter border border-blue-100 dark:border-blue-800">{m.categoria}</span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black text-sm ${m.tipo === TipoMovimiento.Ingreso ? 'text-green-600' : 'text-tkd-red'}`}>
                                                {m.tipo === TipoMovimiento.Ingreso ? '+' : '-'}{formatearPrecio(m.monto)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center space-x-2">
                                                    <button onClick={() => { setMovimientoEnEdicion(m); setModalAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-blue transition-all"><IconoEditar className="w-5 h-5" /></button>
                                                    {esAdmin && <button onClick={() => { setMovimientoAEliminar(m); setModalEliminarAbierto(true); }} className="p-2 text-gray-400 hover:text-tkd-red transition-all"><IconoEliminar className="w-5 h-5" /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {modalAbierto && (
                <FormularioMovimiento abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} onGuardar={handleGuardarMovimiento} sedes={sedes} cargando={cargandoAccion} movimientoActual={movimientoEnEdicion} />
            )}
            {modalEliminarAbierto && movimientoAEliminar && (
                <ModalConfirmacion abierto={modalEliminarAbierto} titulo="Anular Movimiento" mensaje={`¿Confirmas anular este registro por valor de ${formatearPrecio(movimientoAEliminar.monto)}?`} onCerrar={() => setModalEliminarAbierto(false)} onConfirmar={handleConfirmarEliminacion} cargando={cargandoAccion} />
            )}
        </div>
    );
};

export default VistaFinanzas;
