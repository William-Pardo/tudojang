
// vistas/Dashboard.tsx
import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { useSedes } from '../context/DataContext';

// Componentes
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
        filtrosActivos,
        datosFiltrados,
        cargandoAccion,
        recargarTodo,
        manejarGestionCompra,
        handleFiltroChange,
        limpiarFiltros,
    } = useDashboard();

    const { sedes } = useSedes();

    if (cargando) {
        return <div className="flex justify-center items-center h-full p-8"><Loader texto="Cargando resumen..." /></div>;
    }
    
    if (error) {
        return <div className="p-8"><ErrorState mensaje={error} onReintentar={recargarTodo} /></div>;
    }

    return (
        <div className={`space-y-8 animate-fade-in ${!isSubView ? 'p-4 sm:p-8' : ''}`}>
            {!isSubView && (
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-black text-tkd-dark dark:text-white uppercase tracking-tight">Dashboard Administrativo</h1>
                </div>
            )}

            <SolicitudesCompraPendientes 
                solicitudes={solicitudesCompra} 
                onGestionar={manejarGestionCompra}
                cargandoAccion={cargandoAccion}
            />

            <FiltrosDashboard 
                filtros={filtros}
                sedes={sedes}
                onFiltroChange={handleFiltroChange}
                onLimpiarFiltros={limpiarFiltros}
            />

            <ResumenKPIs 
                estudiantes={datosFiltrados.estudiantesFiltrados} 
                finanzas={datosFiltrados.finanzas}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <ProximosEventos eventos={datosFiltrados.eventosParaMostrar} />
                </div>
                
                <div className="space-y-8">
                    <ResumenPagos estudiantes={datosFiltrados.estudiantesFiltrados} />
                    <AccesosDirectos />
                </div>
            </div>
        </div>
    );
};

export default VistaDashboard;
