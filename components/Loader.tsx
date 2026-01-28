// components/Loader.tsx
// Un componente reutilizable para mostrar un indicador de carga.

import React from 'react';

interface LoaderProps {
  texto?: string;
}

const Loader: React.FC<LoaderProps> = ({ texto = "Cargando..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4" role="status" aria-live="polite">
      <div className="w-16 h-16 border-4 border-tkd-blue border-t-transparent border-solid rounded-full animate-spin" aria-hidden="true"></div>
      <p className="text-lg font-semibold text-tkd-dark dark:text-white">{texto}</p>
    </div>
  );
};

export default Loader;
