// components/TarjetaEventoPublico.tsx
// Muestra la vista detallada de un evento en la página pública.

import React from 'react';
import type { Evento } from '../tipos';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { IconoEventos, IconoImagen } from './Iconos';
import { formatearPrecio, formatearFecha } from '../utils/formatters';

interface Props {
  evento: Evento;
  onSolicitarInscripcion: () => void;
}

const TarjetaEventoPublico: React.FC<Props> = ({ evento, onSolicitarInscripcion }) => {
  return (
    <div className="max-w-4xl w-full">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-56 lg:w-64 xl:w-72 flex-shrink-0">
          <div className="w-full aspect-[9/16] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {evento.imagenUrl ? (
              <img src={evento.imagenUrl} alt={`Imagen de ${evento.nombre}`} className="w-full h-full object-cover" />
            ) : (
              <IconoImagen className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            )}
          </div>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h1 className="text-3xl font-bold text-tkd-blue">{evento.nombre}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{evento.lugar}</p>
          <div className="mt-4 pt-4 border-t dark:border-gray-700 flex-grow">
            <p className="text-gray-700 dark:text-gray-300">{evento.descripcion}</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-tkd-dark dark:text-gray-200">Fecha del Evento:</p>
                <p className="text-gray-600 dark:text-gray-400">{formatearFecha(evento.fechaEvento)}</p>
              </div>
              <div>
                <p className="font-semibold text-tkd-dark dark:text-gray-200">Inscripciones:</p>
                <p className="text-gray-600 dark:text-gray-400">Del {formatearFecha(evento.fechaInicioInscripcion)} al {formatearFecha(evento.fechaFinInscripcion)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-semibold text-tkd-dark dark:text-gray-200">Requisitos:</p>
                <p className="text-gray-600 dark:text-gray-400">{evento.requisitos}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-semibold text-tkd-dark dark:text-gray-200">Valor de Inscripción:</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatearPrecio(evento.valor)}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 text-right">
            <button onClick={onSolicitarInscripcion} className="bg-tkd-red text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 text-lg">
              <IconoEventos className="w-5 h-5" />
              <span>Solicitar Inscripción</span>
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
        Gestionado por TaekwondoGa Jog. <ReactRouterDOM.Link to="/login" className="hover:underline">Acceso de Administrador</ReactRouterDOM.Link>
      </p>
    </div>
  );
};

export default TarjetaEventoPublico;