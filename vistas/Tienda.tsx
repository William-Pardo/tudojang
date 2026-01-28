// vistas/Tienda.tsx
import React from 'react';
import { useGestionTienda } from '../hooks/useGestionTienda';

// Componentes
import ModalSeleccionarEstudiante from '../components/ModalSeleccionarEstudiante';
import ModalCompartirTienda from '../components/ModalCompartirTienda';
import FiltrosTienda from '../components/FiltrosTienda';
import { IconoCompartir, IconoCarritoAgregar, IconoTienda } from '../components/Iconos';
import { formatearPrecio } from '../utils/formatters';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const VistaTienda: React.FC = () => {
  const {
    implementos,
    implementosFiltrados,
    cargando,
    error,
    cargarDatosTienda,
    selecciones,
    handleSeleccionChange,
    modalAbierto,
    setModalAbierto,
    cargandoCompra,
    modalCompartirAbierto,
    setModalCompartirAbierto,
    compraSeleccionada,
    iniciarCompra,
    procesarCompra,
    filtroCategoria,
    setFiltroCategoria,
    filtroPrecio,
    setFiltroPrecio,
    limpiarFiltros,
  } = useGestionTienda();

  const renderContent = () => {
    if (cargando) return <div className="flex justify-center items-center h-full p-8"><Loader texto="Cargando implementos..." /></div>;
    if (error) return <ErrorState mensaje={error} onReintentar={cargarDatosTienda} />;
    
    if (implementos.length === 0) {
      return <EmptyState Icono={IconoTienda} titulo="Tienda Vacía" mensaje="Actualmente no hay implementos disponibles para la venta." />;
    }

    if (implementosFiltrados.length === 0) {
      return <EmptyState Icono={IconoTienda} titulo="Sin Resultados" mensaje="Ningún implemento coincide con los filtros seleccionados. Intenta con otros valores." />;
    }

    return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {implementosFiltrados.map(implemento => {
          const variacionSeleccionada = implemento.variaciones.find(v => v.id === selecciones[implemento.id]);
          return (
            <div key={implemento.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-2">
              <img src={implemento.imagenUrl} alt={implemento.nombre} className="w-full h-48 object-cover" />
              <div className="p-4 flex flex-col flex-grow">
                <h2 className="text-xl font-bold text-tkd-dark dark:text-white">{implemento.nombre}</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1 flex-grow mb-4">{implemento.descripcion}</p>
                <div className="mt-auto space-y-3">
                   <select 
                      id={`select-${implemento.id}`} 
                      value={selecciones[implemento.id] || ''} 
                      onChange={(e) => handleSeleccionChange(implemento.id, e.target.value)} 
                      className="block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm text-tkd-dark transition-colors"
                      aria-label={`Selecciona una variación para ${implemento.nombre}`}
                    >
                      <option value="" disabled>-- Elige una opción --</option>
                      {implemento.variaciones.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.descripcion} ({v.precio > 0 ? formatearPrecio(v.precio) : 'Consultar'})
                        </option>
                      ))}
                    </select>
                  <button onClick={() => iniciarCompra(implemento, selecciones[implemento.id])} disabled={!variacionSeleccionada || variacionSeleccionada.precio <= 0} className="w-full bg-tkd-blue text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center justify-center space-x-2 shadow-sm hover:shadow-md">
                      <IconoCarritoAgregar className="w-5 h-5"/><span>Asignar Compra</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-tkd-dark dark:text-white">Tienda de Implementos</h1>
        <button onClick={() => setModalCompartirAbierto(true)} className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-md hover:shadow-lg">
          <IconoCompartir className="w-5 h-5" /><span>Compartir Tienda</span>
        </button>
      </div>

      <FiltrosTienda
        filtroCategoria={filtroCategoria}
        setFiltroCategoria={setFiltroCategoria}
        filtroPrecio={filtroPrecio}
        setFiltroPrecio={setFiltroPrecio}
        limpiarFiltros={limpiarFiltros}
      />

      {renderContent()}
      {modalAbierto && compraSeleccionada && (
        <ModalSeleccionarEstudiante abierto={modalAbierto} titulo={`Asignar Compra a Estudiante`} textoBotonConfirmar="Confirmar Compra" onCerrar={() => setModalAbierto(false)} onConfirmar={procesarCompra} cargandoConfirmacion={cargandoCompra} />
      )}
      {modalCompartirAbierto && <ModalCompartirTienda abierto={modalCompartirAbierto} onCerrar={() => setModalCompartirAbierto(false)} />}
    </div>
  );
};

export default VistaTienda;