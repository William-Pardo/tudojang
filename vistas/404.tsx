// vistas/404.tsx
import React from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { IconoLogoOficial, IconoCasa } from '../components/Iconos';

const Vista404: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark text-center p-4">
      <IconoLogoOficial className="w-32 h-32 text-tkd-blue mb-4" />
      <h1 className="text-6xl font-extrabold text-tkd-blue">404</h1>
      <h2 className="text-2xl font-bold text-tkd-dark dark:text-white mt-4">
        Página No Encontrada
      </h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md">
        Lo sentimos, la página que estás buscando no existe o ha sido movida.
      </p>
      <ReactRouterDOM.Link
        to="/"
        className="mt-8 bg-tkd-red text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-lg hover:shadow-xl"
      >
        <IconoCasa className="w-5 h-5" />
        <span>Volver al Inicio</span>
      </ReactRouterDOM.Link>
    </div>
  );
};

export default Vista404;