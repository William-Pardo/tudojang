import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { useSedes } from '../context/DataContext';

// Componentes con estilos actualizados
import SolicitudesCompraPendientes from '../components/dashboard/SolicitudesCompraPendientes';
import FiltrosDashboard from '../components/dashboard/FiltrosDashboard';
import ResumenKPIs from '../components/dashboard/ResumenKPIs';
import ProximosEventos from '../components/dashboard/ProximosEventos';
import ResumenPagos from '../components/dashboard/ResumenPagos';
import AccesosDirectos from '../components/dashboard/AccesosDirectos';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';

interface Props {
    isSubView?: boolean;
}

const VistaDashboard: React.FC<Props> = ({ isSubView = false }) => {
    const {
        cargando,
        error,
        solicitudesCompra,
        filtros,
        datosFiltrados,
        cargandoAccion,
        recargarTodo,
        manejarGestionCompra,
        handleFiltroChange,
        limpiarFiltros,
    } = useDashboard();

    const { sedesVisibles } = useSedes();

    if (cargando) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader texto="Sincronizando Consola Maestra..." />
            </div>
        );
    }
    
    if (error) {
        return <div className="p-8"><ErrorState mensaje={error} onReintentar={recargarTodo} /></div>;
    }

    return (
        <div className={`space-y-10 animate-fade-in ${!isSubView ? 'p-6 sm:p-10' : ''}`}>
            {!isSubView && (
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-none">Dashboard</h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Estado General de la Academia</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Servidor Online</span>
                    </div>
                </header>
            )}

            {/* Alertas Críticas (Solicitudes de Tienda) */}
            <SolicitudesCompraPendientes 
                solicitudes={solicitudesCompra} 
                onGestionar={manejarGestionCompra}
                cargandoAccion={cargandoAccion}
            />

            {/* Panel de Filtros Técnicos */}
            <div className="animate-slide-in-right">
                <FiltrosDashboard 
                    filtros={filtros}
                    sedes={sedesVisibles}
                    onFiltroChange={handleFiltroChange}
                    onLimpiarFiltros={limpiarFiltros}
                />
            </div>

            {/* Núcleo de KPIs */}
            <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <ResumenKPIs 
                    estudiantes={datosFiltrados.estudiantesFiltrados} 
                    finanzas={datosFiltrados.finanzas}
                />
            </section>

            {/* Grid de Análisis Profundo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                    <div className="tkd-card p-1">
                        <ProximosEventos eventos={datosFiltrados.eventosParaMostrar} />
                    </div>
                </div>
                
                <div className="space-y-10">
                    <div className="tkd-card p-1">
                        <ResumenPagos estudiantes={datosFiltrados.estudiantesFiltrados} />
                    </div>
                    <div className="tkd-card p-1">
                        <AccesosDirectos />
                    </div>
                </div>
            </div>

            <footer className="pt-10 text-center">
                <p className="text-[9px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-[0.5em]">Tudojang Core Visual Engine v4.0</p>
            </footer>
        </div>
    );
};

export default VistaDashboard;