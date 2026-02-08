
// vistas/Tienda.tsx
import React, { useState } from 'react';
import { useTienda } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { RolUsuario, Implemento, VariacionImplemento } from '../tipos';

// Componentes
import ModalSeleccionarEstudiante from '../components/ModalSeleccionarEstudiante';
import ModalCompartirTienda from '../components/ModalCompartirTienda';
import FormularioImplemento from '../components/FormularioImplemento';
import ModalConfirmacion from '../components/ModalConfirmacion';
import FiltrosTienda from '../components/FiltrosTienda';
import { IconoCompartir, IconoCarritoAgregar, IconoTienda, IconoAgregar, IconoEditar, IconoEliminar } from '../components/Iconos';
import { formatearPrecio } from '../utils/formatters';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { useNotificacion } from '../context/NotificacionContext';

const VistaTienda: React.FC = () => {
  const { usuario } = useAuth();
  const { mostrarNotificacion } = useNotificacion();
  const {
    implementos, cargando, registrarCompra,
    agregarImplemento, actualizarImplemento, eliminarImplemento
  } = useTienda();

  const esAdmin = usuario?.rol === RolUsuario.Admin;

  // Estados de filtros
  const [filtroCategoria, setFiltroCategoria] = useState<any>('todos');
  const [filtroPrecio, setFiltroPrecio] = useState('todos');

  // Estados de Modales
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [modalEditorAbierto, setModalEditorAbierto] = useState(false);
  const [modalConfirmEliminar, setModalConfirmEliminar] = useState(false);
  const [modalCompartirAbierto, setModalCompartirAbierto] = useState(false);

  const [itemSeleccionado, setItemSeleccionado] = useState<Implemento | null>(null);
  const [variacionSeleccionadaId, setVariacionSeleccionadaId] = useState<string>('');
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [cargandoAccion, setCargandoAccion] = useState(false);

  const handleSeleccionChange = (implementoId: string, variacionId: string) => {
    setSelecciones(prev => ({ ...prev, [implementoId]: variacionId }));
  };

  const iniciarCompra = (item: Implemento) => {
    const varId = selecciones[item.id];
    if (!varId) {
        mostrarNotificacion("Selecciona una talla o variante primero.", "warning");
        return;
    }
    setItemSeleccionado(item);
    setVariacionSeleccionadaId(varId);
    setModalCompraAbierto(true);
  };

  const handleGuardarProducto = async (data: any) => {
    setCargandoAccion(true);
    try {
        if (data.id) {
            await actualizarImplemento(data);
            mostrarNotificacion("Implemento actualizado en catálogo.", "success");
        } else {
            await agregarImplemento(data);
            mostrarNotificacion("Nuevo implemento registrado.", "success");
        }
        setModalEditorAbierto(false);
    } catch (e) {
        mostrarNotificacion("Error al guardar en inventario.", "error");
    } finally {
        setCargandoAccion(false);
    }
  };

  const handleEliminarProducto = async () => {
    if (!itemSeleccionado) return;
    setCargandoAccion(true);
    try {
        await eliminarImplemento(itemSeleccionado.id);
        mostrarNotificacion("Artículo eliminado del sistema.", "info");
        setModalConfirmEliminar(false);
    } catch (e) {
        mostrarNotificacion("Fallo al eliminar el registro.", "error");
    } finally {
        setCargandoAccion(false);
    }
  };

  const implementosFiltrados = implementos.filter(i => {
    const catOk = filtroCategoria === 'todos' || i.categoria === filtroCategoria;
    return catOk;
  });

  if (cargando) return <div className="h-screen flex items-center justify-center"><Loader texto="Audidando Inventario..." /></div>;

  return (
    <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-tkd-dark dark:text-white uppercase tracking-tighter leading-none">Tienda Oficial</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Gestión de Equipamiento y Suministros</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button onClick={() => setModalCompartirAbierto(true)} className="flex-1 sm:flex-none bg-white dark:bg-gray-800 border-2 border-tkd-blue/10 text-tkd-blue px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-tkd-blue hover:text-white transition-all flex items-center justify-center gap-2">
            <IconoCompartir className="w-4 h-4" /> Enlace Público
          </button>
          {esAdmin && (
            <button onClick={() => { setItemSeleccionado(null); setModalEditorAbierto(true); }} className="flex-1 sm:flex-none bg-tkd-dark text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-tkd-blue transition-all active:scale-95 flex items-center justify-center gap-2">
              <IconoAgregar className="w-4 h-4 text-tkd-red" /> Nuevo Artículo
            </button>
          )}
        </div>
      </header>

      <FiltrosTienda 
        filtroCategoria={filtroCategoria} setFiltroCategoria={setFiltroCategoria}
        filtroPrecio={filtroPrecio} setFiltroPrecio={setFiltroPrecio}
        limpiarFiltros={() => { setFiltroCategoria('todos'); setFiltroPrecio('todos'); }}
      />

      {implementosFiltrados.length === 0 ? (
        <EmptyState Icono={IconoTienda} titulo="Tienda Vacía" mensaje="Aún no se han registrado artículos en el inventario." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {implementosFiltrados.map(item => (
            <div key={item.id} className="tkd-card group flex flex-col h-full">
              {/* Contenedor de Imagen con Acciones Admin */}
              <div className="aspect-square bg-gray-50 dark:bg-black/20 relative overflow-hidden">
                {item.imagenUrl ? (
                    <img src={item.imagenUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.nombre} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 dark:text-gray-800">
                        <IconoTienda className="w-20 h-20 opacity-20" />
                    </div>
                )}
                
                {/* Overlay de Acciones (Solo Admin) */}
                {esAdmin && (
                    <div className="absolute inset-0 bg-tkd-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                        <button 
                            onClick={() => { setItemSeleccionado(item); setModalEditorAbierto(true); }}
                            className="p-4 bg-white text-tkd-blue rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
                            title="Editar Artículo"
                        >
                            <IconoEditar className="w-6 h-6" />
                        </button>
                        <button 
                            onClick={() => { setItemSeleccionado(item); setModalConfirmEliminar(true); }}
                            className="p-4 bg-white text-tkd-red rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
                            title="Eliminar de Inventario"
                        >
                            <IconoEliminar className="w-6 h-6" />
                        </button>
                    </div>
                )}
              </div>

              <div className="p-8 flex-grow flex flex-col space-y-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-tkd-blue uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">{item.categoria}</span>
                  <h3 className="text-lg font-black uppercase text-gray-900 dark:text-white tracking-tighter line-clamp-1">{item.nombre}</h3>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-2 uppercase leading-relaxed h-10">{item.descripcion}</p>
                
                <div className="pt-4 space-y-4 mt-auto">
                  <div className="relative">
                      <select 
                        value={selecciones[item.id] || ''} 
                        onChange={(e) => handleSeleccionChange(item.id, e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-4 text-[10px] font-black text-gray-900 dark:text-gray-200 uppercase outline-none focus:ring-2 focus:ring-tkd-blue shadow-inner appearance-none cursor-pointer"
                      >
                        <option value="">Elegir Talla / Opción</option>
                        {item.variaciones.map(v => <option key={v.id} value={v.id}>{v.descripcion} - {formatearPrecio(v.precio)}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                  </div>

                  <button 
                    onClick={() => iniciarCompra(item)}
                    className="w-full bg-tkd-dark text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-tkd-blue transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <IconoCarritoAgregar className="w-4 h-4 text-tkd-red" /> Asignar Venta
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALES DINÁMICOS */}
      {modalEditorAbierto && (
        <FormularioImplemento 
          abierto={modalEditorAbierto} onCerrar={() => setModalEditorAbierto(false)} 
          onGuardar={handleGuardarProducto} itemActual={itemSeleccionado} cargando={cargandoAccion} 
        />
      )}
      
      {modalConfirmEliminar && itemSeleccionado && (
        <ModalConfirmacion 
            abierto={modalConfirmEliminar} titulo="Eliminar Implemento" 
            mensaje={`¿Confirmas que deseas eliminar permanentemente "${itemSeleccionado.nombre}" del catálogo oficial?`} 
            onCerrar={() => setModalConfirmEliminar(false)} onConfirmar={handleEliminarProducto} cargando={cargandoAccion} 
        />
      )}

      {modalCompraAbierto && itemSeleccionado && (
        <ModalSeleccionarEstudiante 
            abierto={modalCompraAbierto} titulo="Cargar Venta a Estudiante" 
            textoBotonConfirmar="Finalizar Venta" onCerrar={() => setModalCompraAbierto(false)} 
            onConfirmar={(est) => {
                const variacion = itemSeleccionado.variaciones.find(v => v.id === variacionSeleccionadaId);
                if (variacion) registrarCompra(est.id, itemSeleccionado, variacion);
                setModalCompraAbierto(false);
                mostrarNotificacion("Venta registrada con éxito.", "success");
            }} 
            cargandoConfirmacion={cargandoAccion} 
        />
      )}

      {modalCompartirAbierto && <ModalCompartirTienda abierto={modalCompartirAbierto} onCerrar={() => setModalCompartirAbierto(false)} />}
    </div>
  );
};

export default VistaTienda;
