// components/EmptyState.tsx
import React from 'react';

interface EmptyStateProps {
  Icono: React.ElementType;
  titulo: string;
  mensaje: string;
  children?: React.ReactNode; // Para el botón de acción
}

const EmptyState: React.FC<EmptyStateProps> = ({ Icono, titulo, mensaje, children }) => {
  return (
    <div className="text-center py-10 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md my-6">
      <Icono className="mx-auto w-16 h-16 text-gray-400 dark:text-gray-500" />
      <h3 className="mt-4 text-xl font-bold text-tkd-dark dark:text-white">
        {titulo}
      </h3>
      <p className="mt-2 text-md text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
        {mensaje}
      </p>
      {children && (
        <div className="mt-6">
          {children}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
