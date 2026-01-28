// components/dashboard/AccesosDirectos.tsx

import React from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { IconoEstudiantes, IconoTienda } from '../Iconos';

const AccesosDirectos: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-tkd-blue mb-4">Accesos Directos</h2>
      <div className="space-y-3">
        <ReactRouterDOM.Link
          to="/estudiantes"
          className="w-full flex items-center p-3 text-left bg-tkd-blue text-white rounded-md hover:bg-blue-800 transition-colors"
        >
          <IconoEstudiantes className="w-5 h-5 mr-3" />
          <span className="font-semibold">Gestionar Estudiantes</span>
        </ReactRouterDOM.Link>
        <ReactRouterDOM.Link
          to="/tienda"
          className="w-full flex items-center p-3 text-left bg-tkd-red text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <IconoTienda className="w-5 h-5 mr-3" />
          <span className="font-semibold">Ir a la Tienda</span>
        </ReactRouterDOM.Link>
      </div>
    </div>
  );
};

export default AccesosDirectos;