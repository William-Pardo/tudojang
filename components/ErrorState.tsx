// components/ErrorState.tsx
import React from 'react';
import { IconoAlertaTriangulo } from './Iconos';

interface ErrorStateProps {
  mensaje: string;
  onReintentar?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ mensaje, onReintentar }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md my-6">
      <IconoAlertaTriangulo className="w-16 h-16 text-tkd-red mb-4" />
      <h3 className="text-xl font-bold text-tkd-dark dark:text-white mb-2">
        ¡Ups! Algo salió mal
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {mensaje}
      </p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="bg-tkd-blue text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
        >
          Intentar Nuevamente
        </button>
      )}
    </div>
  );
};

export default ErrorState;
