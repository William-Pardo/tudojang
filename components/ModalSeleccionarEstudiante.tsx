// componentes/ModalSeleccionarEstudiante.tsx
// Este componente muestra un modal para buscar y seleccionar un estudiante de una lista.
// Es reutilizable para diferentes acciones como compras o inscripciones a eventos.

import React, { useState, useEffect, useMemo } from 'react';
import type { Estudiante } from '../tipos';
import { obtenerEstudiantes } from '../servicios/api';
import { IconoCerrar, IconoUsuario } from './Iconos';

interface Props {
  abierto: boolean;
  titulo: string;
  textoBotonConfirmar: string;
  onCerrar: () => void;
  onConfirmar: (estudiante: Estudiante) => void;
  cargandoConfirmacion: boolean;
}

const ModalSeleccionarEstudiante: React.FC<Props> = ({ abierto, titulo, textoBotonConfirmar, onCerrar, onConfirmar, cargandoConfirmacion }) => {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | null>(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
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

  useEffect(() => {
    if (abierto) {
      setCargando(true);
      obtenerEstudiantes()
        .then(setEstudiantes)
        .catch(err => console.error("Error al cargar estudiantes", err))
        .finally(() => setCargando(false));
      
      setEstudianteSeleccionado(null);
      setTerminoBusqueda('');
    }
  }, [abierto]);

  const estudiantesFiltrados = useMemo(() => {
    if (!terminoBusqueda) return estudiantes;
    return estudiantes.filter(e =>
      `${e.nombres} ${e.apellidos}`.toLowerCase().includes(terminoBusqueda.toLowerCase())
    );
  }, [estudiantes, terminoBusqueda]);
  
  const manejarConfirmacion = () => {
    if (estudianteSeleccionado) {
      onConfirmar(estudianteSeleccionado);
    }
  };

  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">{titulo}</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto">
          <input
            type="text"
            placeholder="Buscar estudiante por nombre..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 transition-colors duration-200 focus:ring-tkd-blue focus:border-tkd-blue shadow-sm"
            value={terminoBusqueda}
            onChange={e => setTerminoBusqueda(e.target.value)}
          />
          {cargando ? (
            <p className="dark:text-gray-300">Cargando estudiantes...</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {estudiantesFiltrados.map(estudiante => (
                <li key={estudiante.id}>
                  <button
                    onClick={() => setEstudianteSeleccionado(estudiante)}
                    className={`w-full text-left p-3 rounded-md flex items-center space-x-3 transition-colors duration-200 ${estudianteSeleccionado?.id === estudiante.id ? 'bg-tkd-blue text-white shadow-md' : 'hover:bg-tkd-gray dark:hover:bg-gray-700'}`}
                  >
                    <IconoUsuario className="w-5 h-5"/>
                    <span className="dark:text-white">{`${estudiante.nombres} ${estudiante.apellidos}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="p-4 border-t flex justify-end space-x-3 bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-sm"
          >
            Cancelar
          </button>
          <button
            onClick={manejarConfirmacion}
            disabled={!estudianteSeleccionado || cargandoConfirmacion}
            className="px-4 py-2 bg-tkd-red text-white rounded-md hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {cargandoConfirmacion ? 'Procesando...' : textoBotonConfirmar}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ModalSeleccionarEstudiante;