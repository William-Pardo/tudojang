// components/AutosavePrompt.tsx
import React from 'react';
import { IconoGuardar, IconoEliminar } from './Iconos';

interface AutosavePromptProps {
  onRestore: () => void;
  onDiscard: () => void;
}

const AutosavePrompt: React.FC<AutosavePromptProps> = ({ onRestore, onDiscard }) => {
  return (
    <div
      className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3"
      role="alert"
    >
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 text-center sm:text-left">
        Encontramos un borrador no guardado. ¿Deseas continuar donde lo dejaste?
      </p>
      <div className="flex space-x-2 flex-shrink-0">
        <button
          onClick={onDiscard}
          type="button"
          className="px-3 py-1 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 inline-flex items-center space-x-1"
          aria-label="Descartar borrador"
        >
          <IconoEliminar className="w-4 h-4" />
          <span>Descartar</span>
        </button>
        <button
          onClick={onRestore}
          type="button"
          className="px-3 py-1 text-xs bg-tkd-blue text-white rounded-md hover:bg-blue-800 inline-flex items-center space-x-1"
          aria-label="Restaurar borrador"
        >
          <IconoGuardar className="w-4 h-4" />
          <span>Restaurar</span>
        </button>
      </div>
    </div>
  );
};

export default AutosavePrompt;