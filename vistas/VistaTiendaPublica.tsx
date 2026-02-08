// vistas/VistaTiendaPublica.tsx
import React, { useState } from 'react';
import type { Implemento, VariacionImplemento } from '../tipos';
import { obtenerImplementos } from '../servicios/api';
import { usePaginaPublica } from '../hooks/usePaginaPublica';
import ModalSolicitarCompra from '../components/ModalSolicitarCompra';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { IconoLogoOficial } from '../components/Iconos';
import { formatearPrecio } from '../utils/formatters';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const VistaTiendaPublica: React.FC = () => {
  const { data: implementos, cargando, error, cargarDatos } = usePaginaPublica(obtenerImplementos);

  // Estado local para UI
  const [modalAbierto, setModalAbierto] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<{ implemento: Implemento, variacion: VariacionImplemento } | null>(null);
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});

  const handleSeleccionChange = (implementoId: string, variacionId: string) => {
    setSelecciones(prev => ({
        ...prev,
        [implementoId]: variacionId
    }));
  };

  const iniciarSolicitudCompra = (implemento: Implemento, variacionId: string) => {
    const variacion = implemento.variaciones.find(v => v.id === variacionId);
    if (variacion) {
      setItemSeleccionado({ implemento, variacion });
      setModalAbierto(true);
    }
  };

  const renderContent = () => {
    if (cargando) {
        return (
            <div className="flex justify-center items-center h-full p-8">
                <Loader texto="Cargando implementos..." />
            </div>
        );
    }
    if (error) {
      return <ErrorState mensaje={error} onReintentar={cargarDatos} />;
    }
    if (!implementos || implementos.length === 0) {
        return <EmptyState Icono={IconoLogoOficial} titulo="Tienda No Disponible" mensaje="Actualmente no hay implementos para mostrar. Por favor, intente más tarde." />;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {implementos.map(implemento => {
          const variacionSeleccionada = implemento.variaciones.find(v => v.id === selecciones[implemento.id]);
          return (
            <div key={implemento.id} className="group bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-2">
              <div className="overflow-hidden">
                <img 
                    src={implemento.imagenUrl} 
                    alt={implemento.nombre} 
                    className="w-full h-48 object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                />
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h2 className="text-xl font-bold text-tkd-dark dark:text-white">{implemento.nombre}</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1 flex-grow mb-4">{implemento.descripcion}</p>
                <div className="mt-auto space-y-3">
                   <select
                      id={`select-${implemento.id}`}
                      value={selecciones[implemento.id] || ''}
                      onChange={(e) => handleSeleccionChange(implemento.id, e.target.value)}
                      className="block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm text-tkd-dark transition-colors"
                    >
                      <option value="" disabled>-- Elige una opción --</option>
                      {implemento.variaciones.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.descripcion} ({v.precio > 0 ? formatearPrecio(v.precio) : 'Consultar'})
                        </option>
                      ))}
                    </select>
                  <button
                      onClick={() => iniciarSolicitudCompra(implemento, selecciones[implemento.id])}
                      disabled={!variacionSeleccionada || variacionSeleccionada.precio <= 0}
                      className="w-full bg-tkd-red text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                      Solicitar Compra
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <IconoLogoOficial aria-label="Logo TaekwondoGa Jog" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-tkd-dark dark:text-white">Tienda de Implementos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Selecciona un artículo y sigue los pasos para solicitarlo. La escuela confirmará tu solicitud.</p>
        </header>

        <div className="max-w-3xl mx-auto mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-tkd-blue text-center text-lg">¿Cómo funciona?</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 mt-2">
                <li><strong>Selecciona el artículo:</strong> Elige el implemento y la variación que necesitas (talla, color, etc.).</li>
                <li><strong>Solicita la compra:</strong> Haz clic en "Solicitar Compra" e introduce el número de identificación del estudiante.</li>
                <li><strong>Espera la confirmación:</strong> Un administrador revisará tu solicitud. Una vez aprobada, el valor se añadirá al saldo del estudiante y recibirás una notificación de confirmación.</li>
            </ol>
        </div>

        {renderContent()}

        <footer className="text-center mt-12 text-xs text-gray-500 dark:text-gray-400">
           <p>Gestionado por TaekwondoGa Jog. <ReactRouterDOM.Link to="/login" className="hover:underline">Acceso de Administrador</ReactRouterDOM.Link></p>
        </footer>
      </div>

      {modalAbierto && itemSeleccionado && (
        <ModalSolicitarCompra
          abierto={modalAbierto}
          onCerrar={() => setModalAbierto(false)}
          implemento={itemSeleccionado.implemento}
          variacion={itemSeleccionado.variacion}
        />
      )}
    </div>
  );
};

export default VistaTiendaPublica;