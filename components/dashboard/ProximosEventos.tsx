// components/dashboard/ProximosEventos.tsx

import React, { useMemo } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import type { Evento } from '../../tipos';
import { formatearFecha } from '../../utils/formatters';

interface Props {
  eventos: Evento[];
}

const ProximosEventos: React.FC<Props> = ({ eventos }) => {
    
  const proximosEventos = useMemo(() => {
    return eventos
      .sort((a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime())
      .slice(0, 3);
  }, [eventos]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col">
      <h2 className="text-xl font-bold text-tkd-blue mb-4">Próximos Eventos</h2>
      <div className="flex-grow">
        {proximosEventos.length > 0 ? (
          <ul className="space-y-4">
            {proximosEventos.map(evento => (
              <li key={evento.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div>
                  <p className="font-semibold text-tkd-dark dark:text-white">{evento.nombre}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{evento.lugar}</p>
                </div>
                <p className="text-sm font-medium text-tkd-red mt-2 sm:mt-0">
                  {formatearFecha(evento.fechaEvento)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No hay eventos próximos que coincidan con los filtros.
          </p>
        )}
      </div>
      <div className="mt-6 text-right">
        <ReactRouterDOM.Link
          to="/eventos"
          className="text-sm font-semibold text-tkd-blue hover:underline dark:hover:text-blue-400"
        >
          Ver todos los eventos →
        </ReactRouterDOM.Link>
      </div>
    </div>
  );
};

export default ProximosEventos;