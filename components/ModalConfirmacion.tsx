// componentes/ModalConfirmacion.tsx
// Un modal genérico para pedir confirmación al usuario antes de una acción destructiva.

import React, { useState, useEffect } from 'react';
import { IconoCerrar, IconoAprobar } from './Iconos';

interface Props {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  onCerrar: () => void;
  onConfirmar: () => void;
  cargando: boolean;
  textoBotonConfirmar?: string;
}

const ModalConfirmacion: React.FC<Props> = ({
  abierto,
  titulo,
  mensaje,
  onCerrar,
  onConfirmar,
  cargando,
  textoBotonConfirmar = 'Confirmar',
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onCerrar(), 200);
  };

  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">{titulo}</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300">{mensaje}</p>
        </div>

        <footer className="p-4 border-t flex justify-end space-x-3 bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={cargando}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cargando}
            className="px-4 py-2 bg-tkd-red text-white rounded-md hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
          >
            <IconoAprobar className="w-5 h-5" />
            <span>{cargando ? 'Procesando...' : textoBotonConfirmar}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ModalConfirmacion;