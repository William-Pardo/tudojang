// componentes/ModalVerFirma.tsx
// Este componente muestra un modal para visualizar una firma digital guardada.

import React, { useState, useEffect } from 'react';
import { IconoCerrar } from './Iconos';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  firmaDigital: string; // Se espera una cadena Base64
  nombreTutor: string;
}

const ModalVerFirma: React.FC<Props> = ({ abierto, onCerrar, firmaDigital, nombreTutor }) => {
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

  if (!abierto) {
    return null;
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">Firma de {nombreTutor}</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 flex justify-center items-center bg-gray-50 dark:bg-gray-700">
          {firmaDigital ? (
            <img 
                src={firmaDigital} 
                alt={`Firma de ${nombreTutor}`} 
                className="border rounded-md shadow-inner bg-white" 
            />
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No hay una imagen de firma disponible.</p>
          )}
        </div>

        <footer className="p-4 border-t flex justify-end bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-tkd-blue text-white rounded-md hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ModalVerFirma;