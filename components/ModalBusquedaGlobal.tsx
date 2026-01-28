// components/ModalBusquedaGlobal.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { useEstudiantes } from '../context/DataContext';
import { IconoCerrar, IconoBuscar, IconoUsuario } from './Iconos';
import { useDebounce } from '../hooks/useDebounce';
import Loader from './Loader';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const ModalBusquedaGlobal: React.FC<Props> = ({ abierto, onCerrar }) => {
  const [visible, setVisible] = useState(false);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const { estudiantes, cargando } = useEstudiantes();
  const debouncedTermino = useDebounce(terminoBusqueda, 300);
  const navigate = ReactRouterDOM.useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => {
        setVisible(true);
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
        setTerminoBusqueda('');
        onCerrar();
    }, 200);
  };

  const resultados = useMemo(() => {
    if (cargando || !debouncedTermino || debouncedTermino.length < 2) {
      return [];
    }
    const lowercasedTermino = debouncedTermino.toLowerCase();
    return estudiantes.filter(e =>
      `${e.nombres} ${e.apellidos}`.toLowerCase().includes(lowercasedTermino) ||
      e.numeroIdentificacion.toLowerCase().includes(lowercasedTermino) ||
      e.correo.toLowerCase().includes(lowercasedTermino) ||
      (e.tutor && e.tutor.correo?.toLowerCase().includes(lowercasedTermino))
    ).slice(0, 10); // Limitar resultados para mejorar la visualización
  }, [debouncedTermino, estudiantes, cargando]);

  const handleResultadoClick = (nombreCompleto: string) => {
    navigate(`/estudiantes?q=${encodeURIComponent(nombreCompleto)}`);
    handleClose();
  };

  if (!abierto) return null;

  const renderResultados = () => {
    if (cargando && debouncedTermino.length > 1) {
      return <div className="p-4"><Loader texto="Buscando..." /></div>;
    }
    if (debouncedTermino.length < 2) {
        return <p className="p-4 text-center text-gray-500 dark:text-gray-400">Escribe al menos 2 caracteres para buscar.</p>;
    }
    if (resultados.length === 0) {
        return <p className="p-4 text-center text-gray-500 dark:text-gray-400">No se encontraron resultados para "{debouncedTermino}".</p>;
    }
    return (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {resultados.map(estudiante => (
                <li key={estudiante.id}>
                    <button onClick={() => handleResultadoClick(`${estudiante.nombres} ${estudiante.apellidos}`)} className="w-full text-left p-4 hover:bg-tkd-gray dark:hover:bg-gray-700 transition-colors flex items-center space-x-3">
                        <IconoUsuario className="w-6 h-6 text-tkd-blue flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-tkd-dark dark:text-white">{estudiante.nombres} {estudiante.apellidos}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{estudiante.numeroIdentificacion} - {estudiante.correo || 'Sin correo'}</p>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <IconoBuscar className="w-5 h-5 text-gray-400 mx-3 flex-shrink-0" />
            <input
                ref={inputRef}
                type="text"
                placeholder="Buscar estudiante por nombre, ID o email..."
                value={terminoBusqueda}
                onChange={e => setTerminoBusqueda(e.target.value)}
                className="w-full py-2 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-lg"
            />
            <button onClick={handleClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100" aria-label="Cerrar búsqueda">
                <IconoCerrar className="w-6 h-6" />
            </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh]">
            {renderResultados()}
        </div>
      </div>
    </div>
  );
};

export default ModalBusquedaGlobal;