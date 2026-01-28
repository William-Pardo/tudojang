// vistas/Notificaciones.tsx
import React from 'react';
import { useGestionNotificaciones } from '../hooks/useGestionNotificaciones';
import { IconoEnviar, IconoHistorial, IconoAprobar } from '../components/Iconos';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import TarjetaHistorial from '../components/TarjetaHistorial';

const VistaNotificaciones: React.FC = () => {
    const { 
        historial, 
        cargando, 
        error, 
        enviando, 
        progreso, 
        noLeidasCount,
        handleEnviarRecordatorios, 
        cargarHistorial,
        handleMarcarLeida,
        handleMarcarTodasLeidas
    } = useGestionNotificaciones();
    
    const renderHistorial = () => {
        if (cargando) return <Loader texto="Cargando historial..." />;
        if (error) return <ErrorState mensaje={error} onReintentar={cargarHistorial} />;
        if (historial.length === 0) {
            return <EmptyState Icono={IconoHistorial} titulo="Sin notificaciones" mensaje="El historial de notificaciones enviadas aparecerá aquí." />;
        }
        return (
            <div className="space-y-4">
                {historial.map(item => <TarjetaHistorial key={item.id} item={item} onMarcarLeida={handleMarcarLeida} />)}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-tkd-dark dark:text-white">Alertas y Notificaciones</h1>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-tkd-blue mb-2">Envío de Recordatorios de Pago</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Esta acción enviará un mensaje personalizado a todos los tutores de estudiantes con pagos pendientes o vencidos.
                </p>
                <button 
                    onClick={handleEnviarRecordatorios} 
                    disabled={enviando || cargando}
                    className="bg-tkd-red text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <IconoEnviar className="w-5 h-5"/>
                    <span>{enviando ? (progreso || 'Enviando...') : 'Enviar Recordatorios Masivos'}</span>
                </button>
                {enviando && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 animate-pulse">{progreso}</p>}
            </div>

             <div className="space-y-4">
                 <div className="flex flex-wrap gap-4 justify-between items-center">
                    <h2 className="text-2xl font-bold text-tkd-dark dark:text-white flex items-center gap-2">
                        <IconoHistorial className="w-6 h-6"/>
                        Historial de Envíos
                        {noLeidasCount > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tkd-red text-white text-xs font-bold">{noLeidasCount}</span>
                        )}
                    </h2>
                    <button
                        onClick={handleMarcarTodasLeidas}
                        disabled={noLeidasCount === 0 || cargando}
                        className="text-sm bg-tkd-blue text-white px-3 py-1.5 rounded-md font-semibold hover:bg-blue-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center space-x-2 shadow-sm"
                    >
                        <IconoAprobar className="w-4 h-4" />
                        <span>Marcar todo como leído</span>
                    </button>
                 </div>
                {renderHistorial()}
            </div>
        </div>
    );
};

export default VistaNotificaciones;