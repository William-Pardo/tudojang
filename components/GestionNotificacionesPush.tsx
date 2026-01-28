// components/GestionNotificacionesPush.tsx
import React, { useState, useEffect } from 'react';
import { solicitarPermisoYGuardarToken } from '../servicios/pushService';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { IconoCampana } from './Iconos';

const GestionNotificacionesPush: React.FC = () => {
    const { usuario } = useAuth();
    const { mostrarNotificacion } = useNotificacion();
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    useEffect(() => {
        if (isSupported) {
            setPermissionStatus(Notification.permission);
        }
    }, [isSupported]);
    
    const handleRequestPermission = async () => {
        if (!usuario) return;
        setIsSubmitting(true);
        try {
            await solicitarPermisoYGuardarToken(usuario);
            mostrarNotificacion('¡Notificaciones activadas para este navegador!', 'success');
            setPermissionStatus('granted');
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : "Error desconocido";
            mostrarNotificacion(mensaje, 'error');
            setPermissionStatus(Notification.permission);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderContent = () => {
        if (!isSupported) {
            return <p className="text-sm text-gray-600 dark:text-gray-400">Las notificaciones push no son compatibles con este navegador.</p>;
        }

        switch (permissionStatus) {
            case 'granted':
                return <p className="text-sm text-green-600 dark:text-green-400">Las notificaciones push están activas en este navegador.</p>;
            case 'denied':
                return <p className="text-sm text-tkd-red">Has bloqueado las notificaciones. Para activarlas, debes cambiar la configuración de permisos de este sitio en tu navegador.</p>;
            default:
                return (
                    <>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Recibe alertas importantes directamente en tu navegador, incluso si la aplicación no está abierta.
                        </p>
                        <button 
                            onClick={handleRequestPermission} 
                            disabled={isSubmitting}
                            className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-md disabled:bg-gray-400"
                        >
                            <IconoCampana className="w-5 h-5"/>
                            <span>{isSubmitting ? 'Procesando...' : 'Activar Notificaciones Push'}</span>
                        </button>
                    </>
                );
        }
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-tkd-blue p-6 pb-4 border-b dark:border-gray-700">Notificaciones Push del Navegador</h2>
            <div className="p-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default GestionNotificacionesPush;
