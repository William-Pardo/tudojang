// components/TarjetaEventoAdmin.tsx
// Representa una tarjeta individual para un evento en la lista de administración.

import React, { useState, useRef, useEffect } from 'react';
import type { Evento } from '../tipos';
import { IconoImagen, IconoCompartir, IconoCampana, IconoEditar, IconoEliminar } from './Iconos';
import { formatearPrecio, formatearFecha } from '../utils/formatters';

interface Props {
  evento: Evento;
  esAdmin: boolean;
  onCompartir: (evento: Evento) => void;
  onGestionar: (evento: Evento) => void;
  onEditar: (evento: Evento) => void;
  onEliminar: (evento: Evento) => void;
  onUpdateNombre: (eventoId: string, nuevoNombre: string) => Promise<void>;
}

const TarjetaEventoAdmin: React.FC<Props> = ({ evento, esAdmin, onCompartir, onGestionar, onEditar, onEliminar, onUpdateNombre }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(evento.nombre);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editedName.trim() === evento.nombre || !editedName.trim()) {
        setIsEditing(false);
        setEditedName(evento.nombre);
        return;
    }
    
    try {
        await onUpdateNombre(evento.id, editedName.trim());
        setIsEditing(false);
    } catch (error) {
        console.error("Fallo al actualizar el nombre del evento", error);
        // La UI se mantiene en modo de edición para que el usuario pueda reintentar.
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditedName(evento.nombre);
      setIsEditing(false);
    }
  };

  const handleTitleClick = () => {
      if (esAdmin) {
          setIsEditing(true);
      }
  };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col md:flex-row">
      <div className="md:w-56 lg:w-64 xl:w-72 flex-shrink-0">
        <div className="w-full aspect-[9/16] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {evento.imagenUrl ? (
            <img src={evento.imagenUrl} alt={`Imagen de ${evento.nombre}`} className="w-full h-full object-cover"/>
          ) : (
            <IconoImagen className="w-16 h-16 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-grow">
            {isEditing ? (
              <input
                  ref={inputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={handleKeyDown}
                  className="w-full text-2xl font-bold text-tkd-blue bg-transparent border-b-2 border-tkd-blue dark:text-blue-400 dark:border-blue-400 focus:outline-none"
                  aria-label="Editar nombre del evento"
              />
            ) : (
                <h2
                    onClick={handleTitleClick}
                    className={`text-2xl font-bold text-tkd-blue pr-4 ${esAdmin ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md p-1 -m-1' : ''}`}
                    title={esAdmin ? 'Haz clic para editar el nombre' : ''}
                >
                    {evento.nombre}
                </h2>
            )}
            <p className="text-gray-600 dark:text-gray-400 mt-1">{evento.lugar}</p>
          </div>
          <div className="mt-4 sm:mt-0 text-left sm:text-right flex-shrink-0">
            <div className="flex justify-start sm:justify-end items-center space-x-2">
              <button onClick={() => onCompartir(evento)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110" title="Compartir Evento">
                <IconoCompartir className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              {esAdmin && (
                <>
                  <button onClick={() => onGestionar(evento)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110 relative" title="Gestionar Solicitudes">
                    <IconoCampana className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    {evento.solicitudesPendientes && evento.solicitudesPendientes > 0 ? (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-tkd-red text-white text-xs font-bold">{evento.solicitudesPendientes}</span>
                    ) : null}
                  </button>
                  <button onClick={() => onEditar(evento)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110" title="Editar Evento">
                    <IconoEditar className="w-5 h-5 text-tkd-blue dark:text-blue-400" />
                  </button>
                  <button onClick={() => onEliminar(evento)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 ease-in-out transform hover:scale-110" title="Eliminar Evento">
                    <IconoEliminar className="w-5 h-5 text-tkd-red" />
                  </button>
                </>
              )}
            </div>
            <p className="text-xl font-semibold text-tkd-dark dark:text-white mt-2">{formatearPrecio(evento.valor)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Valor de inscripción</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t dark:border-gray-700 flex-grow">
          <p className="text-gray-700 dark:text-gray-300">{evento.descripcion}</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-tkd-dark dark:text-gray-200">Fecha del Evento:</p>
              <p className="text-gray-600 dark:text-gray-400">{formatearFecha(evento.fechaEvento)}</p>
            </div>
            <div>
              <p className="font-semibold text-tkd-dark dark:text-gray-200">Inscripciones:</p>
              <p className="text-gray-600 dark:text-gray-400">Del {formatearFecha(evento.fechaInicioInscripcion)} al {formatearFecha(evento.fechaFinInscripcion)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold text-tkd-dark dark:text-gray-200">Requisitos:</p>
              <p className="text-gray-600 dark:text-gray-400">{evento.requisitos}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TarjetaEventoAdmin;