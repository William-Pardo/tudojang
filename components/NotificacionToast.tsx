// components/NotificacionToast.tsx
// Componente que muestra las notificaciones (toasts) en la interfaz.

import React from 'react';
import { useNotificacion } from '../context/NotificacionContext';
import { IconoCerrar } from './Iconos';

// Iconos específicos para los toasts para no sobrecargar el archivo principal de Iconos
const IconoExito: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const IconoError: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>;
const IconoInfo: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>;


const NotificacionToast: React.FC = () => {
  const { toasts, ocultarNotificacion } = useNotificacion();

  if (!toasts.length) return null;
  
  const toastConfig = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/50',
      border: 'border-green-400 dark:border-green-600',
      iconColor: 'text-green-500',
      Icon: IconoExito,
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/50',
      border: 'border-red-400 dark:border-red-600',
      iconColor: 'text-red-500',
      Icon: IconoError,
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/50',
      border: 'border-blue-400 dark:border-blue-600',
      iconColor: 'text-blue-500',
      Icon: IconoInfo,
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/50',
      border: 'border-yellow-400 dark:border-yellow-600',
      iconColor: 'text-yellow-500',
      Icon: IconoError,
    },
  };


  return (
    <div className="fixed top-5 right-5 z-[100] w-full max-w-sm space-y-3">
      {toasts.map((toast) => {
        const config = toastConfig[toast.tipo];
        return (
          <div
            key={toast.id}
            className={`relative flex items-start w-full p-4 border-l-4 rounded-r-lg shadow-lg animate-slide-in-right ${config.bg} ${config.border}`}
            role="alert"
          >
            <div className={`flex-shrink-0 ${config.iconColor}`}>
              <config.Icon />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {toast.mensaje}
              </p>
            </div>
            <button
              onClick={() => ocultarNotificacion(toast.id)}
              className="ml-auto -mx-1.5 -my-1.5 p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg focus:ring-2 focus:ring-gray-300 inline-flex h-8 w-8"
              aria-label="Cerrar"
            >
              <IconoCerrar className="w-5 h-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NotificacionToast;
