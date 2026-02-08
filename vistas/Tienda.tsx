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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {implementosFiltrados.map(implemento => {
          const variacionSeleccionada = implemento.variaciones.find(v => v.id === selecciones[implemento.id]);
          return (
            <div key={implemento.id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col shadow-sm hover:shadow-2xl hover:scale-[1.01] transition-all group relative">
              <div className="relative h-72 overflow-hidden">
                <img src={implemento.imagenUrl} alt={implemento.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                <div className="absolute top-5 right-5 px-4 py-1.5 bg-tkd-blue/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase text-white tracking-widest">{implemento.categoria}</div>
              </div>
              <div className="p-10 flex flex-col flex-grow">
                <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-tight">{implemento.nombre}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium leading-relaxed mt-4 flex-grow mb-8">{implemento.descripcion}</p>
                <div className="mt-auto space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1 block">Configuración de Implemento</label>
                    <select
                      id={`select-${implemento.id}`}
                      value={selecciones[implemento.id] || ''}
                      onChange={(e) => handleSeleccionChange(implemento.id, e.target.value)}
                      className="block w-full bg-gray-50 dark:bg-gray-900 border-none text-tkd-dark dark:text-white rounded-2xl px-5 py-4 text-xs font-black uppercase shadow-inner focus:ring-2 focus:ring-tkd-blue outline-none transition-all cursor-pointer appearance-none"
                      aria-label={`Selecciona una variación para ${implemento.nombre}`}
                    >
                      <option value="" disabled>-- Seleccione Especificación --</option>
                      {implemento.variaciones.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.descripcion} ({v.precio > 0 ? formatearPrecio(v.precio) : 'Consultar'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => iniciarCompra(implemento, selecciones[implemento.id])} disabled={!variacionSeleccionada || variacionSeleccionada.precio <= 0} className="w-full bg-green-500 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-[0_15px_30px_-10px_rgba(34,197,94,0.4)] hover:bg-green-600 transition-all active:scale-95 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-3">
                    <IconoCarritoAgregar className="w-6 h-6" /><span>Asignar a Estudiante</span>
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
    <div className="p-4 sm:p-12 bg-tkd-gray dark:bg-gray-950 min-h-screen animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8 justify-between items-start md:items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-none">Tienda de Implementos</h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Equipamiento técnico y uniformología oficial</p>
        </div>
        <button onClick={() => setModalCompartirAbierto(true)} className="w-full md:w-auto bg-white dark:bg-gray-800 text-green-500 border border-gray-100 dark:border-white/10 px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95">
          <IconoCompartir className="w-5 h-5" /><span>Compartir Catálogo</span>
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