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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {implementosFiltrados.map(implemento => {
          const variacionSeleccionada = implemento.variaciones.find(v => v.id === selecciones[implemento.id]);
          return (
            <div key={implemento.id} className="bg-[#1A2232] rounded-[2rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl hover:scale-[1.02] transition-all group">
              <div className="relative h-64 overflow-hidden">
                <img src={implemento.imagenUrl} alt={implemento.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2232] to-transparent opacity-60"></div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">{implemento.nombre}</h2>
                <p className="text-gray-400 text-[11px] font-medium leading-relaxed mt-3 flex-grow mb-6">{implemento.descripcion}</p>
                <div className="mt-auto space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest ml-1">Variación / Talla</label>
                    <select
                      id={`select-${implemento.id}`}
                      value={selecciones[implemento.id] || ''}
                      onChange={(e) => handleSeleccionChange(implemento.id, e.target.value)}
                      className="block w-full bg-[#0D121F] border border-white/10 text-white rounded-xl px-4 py-3 text-xs font-bold focus:border-tkd-blue outline-none transition-all"
                      aria-label={`Selecciona una variación para ${implemento.nombre}`}
                    >
                      <option value="" disabled>-- Elige una opción --</option>
                      {implemento.variaciones.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.descripcion} ({v.precio > 0 ? formatearPrecio(v.precio) : 'Consultar'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => iniciarCompra(implemento, selecciones[implemento.id])} disabled={!variacionSeleccionada || variacionSeleccionada.precio <= 0} className="w-full bg-[#10B981] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] hover:bg-[#059669] transition-all active:scale-95 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-3">
                    <IconoCarritoAgregar className="w-5 h-5" /><span>Asignar Compra</span>
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
    <div className="p-8 sm:p-12 bg-[#0D121F] min-h-screen">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Tienda de Implementos</h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Equipamiento técnico y uniformología oficial</p>
        </div>
        <button onClick={() => setModalCompartirAbierto(true)} className="bg-white/5 text-green-400 border border-green-500/20 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-green-500 hover:text-white transition-all flex items-center gap-3">
          <IconoCompartir className="w-4 h-4" /><span>Compartir Tienda</span>
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