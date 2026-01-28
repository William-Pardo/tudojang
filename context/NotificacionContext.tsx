// context/NotificacionContext.tsx
// Define el contexto y el proveedor para un sistema de notificaciones global.

import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';

export type TipoToast = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
}

interface NotificacionContextType {
  toasts: Toast[];
  mostrarNotificacion: (mensaje: string, tipo?: TipoToast) => void;
  ocultarNotificacion: (id: number) => void;
}

const NotificacionContext = createContext<NotificacionContextType | undefined>(undefined);

export const NotificacionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const ocultarNotificacion = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const mostrarNotificacion = useCallback((mensaje: string, tipo: TipoToast = 'info') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, mensaje, tipo }]);
    
    // Auto-cierre después de 5 segundos
    setTimeout(() => {
      ocultarNotificacion(id);
    }, 5000);
  }, [ocultarNotificacion]);

  const value = { toasts, mostrarNotificacion, ocultarNotificacion };

  return (
    <NotificacionContext.Provider value={value}>
      {children}
    </NotificacionContext.Provider>
  );
};

export const useNotificacion = () => {
  const context = useContext(NotificacionContext);
  if (context === undefined) {
    throw new Error('useNotificacion debe ser usado dentro de un NotificacionProvider');
  }
  return context;
};
