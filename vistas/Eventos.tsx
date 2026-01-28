
// vistas/Eventos.tsx
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { obtenerEventoPorId } from '../servicios/api'; 
import { useGestionEventos } from '../hooks/useGestionEventos';
import { usePaginaPublica } from '../hooks/usePaginaPublica';

// Componentes
import FormularioEvento from '../components/FormularioEvento';
import ModalConfirmacion from '../components/ModalConfirmacion';
import ToggleSwitch from '../components/ToggleSwitch';
import ModalCompartirEvento from '../components/ModalCompartirEvento';
import ModalGestionarSolicitudes from '../components/ModalGestionarSolicitudes';
import { IconoEventos, IconoAgregar } from '../components/Iconos';
import ModalSolicitarInscripcion from '../components/ModalSolicitarInscripcion';
import TarjetaEventoAdmin from '../components/TarjetaEventoAdmin';
import TarjetaEventoPublico from '../components/TarjetaEventoPublico';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

// --- VISTA PÚBLICA DEL EVENTO ---
export const VistaEventoPublico: React.FC = () => {
    const { idEvento } = ReactRouterDOM.useParams<{ idEvento: string }>();
    const fetcher = () => {
        if (!idEvento) throw new Error("ID de evento no proporcionado.");
        return obtenerEventoPorId(idEvento);
    }
    const { data: evento, cargando, error, cargarDatos: cargarEvento } = usePaginaPublica(fetcher);
    const [modalAbierto, setModalAbierto] = useState(false);

    if (cargando) return <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark"><Loader texto="Cargando evento..." /></div>;
    if (error || !evento) return <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4"><ErrorState mensaje={error || "El evento que buscas no existe."} onReintentar={cargarEvento} /></div>;

    return (
        <div className="min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4 sm:p-8 flex items-center justify-center">
             <TarjetaEventoPublico evento={evento} onSolicitarInscripcion={() => setModalAbierto(true)} />
            {modalAbierto && <ModalSolicitarInscripcion abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} evento={evento} />}
        </div>
    );
};


// --- VISTA PRINCIPAL DE EVENTOS (ADMIN) ---
export const VistaEventos: React.FC = () => {
  const {
    eventos,
    eventosMostrados,
    cargando,
    error,
    cargarEventos,
    esAdmin,
    mostrarSoloFuturos,
    setMostrarSoloFuturos,
    modalFormularioAbierto,
    eventoEnEdicion,
    abrirFormulario,
    cerrarFormulario,
    guardarEventoHandler,
    actualizarNombreEvento,
    cargandoCRUD,
    modalConfirmacionAbierto,
    eventoAEliminar,
    abrirConfirmacionEliminar,
    cerrarConfirmacion,
    confirmarEliminacion,
    modalCompartirAbierto,
    eventoACompartir,
    abrirModalCompartir,
    setModalCompartirAbierto,
    modalGestionAbierto,
    eventoAGestionar,
    abrirModalGestion,
    setModalGestionAbierto,
  } = useGestionEventos();

  if (cargando) {
    return <div className="flex justify-center items-center h-full min-h-[400px]"><Loader texto="Cargando eventos..." /></div>;
  }

  if (error) {
    return <div className="p-8"><ErrorState mensaje={error} onReintentar={cargarEventos} /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-tkd-dark dark:text-white">Eventos</h1>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <label htmlFor="mostrar-futuros" className="text-sm font-medium text-gray-700 dark:text-gray-300">Mostrar solo futuros</label>
                <ToggleSwitch id="mostrar-futuros" checked={mostrarSoloFuturos} onChange={setMostrarSoloFuturos}/>
            </div>
            {esAdmin && (
              <button 
                onClick={() => abrirFormulario()} 
                className="bg-tkd-blue text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 inline-flex items-center space-x-2 shadow-md hover:shadow-lg"
              >
                <IconoAgregar className="w-5 h-5"/>
                <span>Agregar Evento</span>
              </button>
            )}
        </div>
      </div>
      
      <div className="min-h-[200px]">
        {eventos.length === 0 ? (
          <EmptyState Icono={IconoEventos} titulo="No hay eventos registrados" mensaje="Crea tu primer evento para empezar a gestionar las inscripciones.">
             {esAdmin && (
               <button onClick={() => abrirFormulario()} className="bg-tkd-blue text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-800 inline-flex items-center space-x-2">
                 <IconoAgregar className="w-5 h-5"/>
                 <span>Agregar Evento</span>
               </button>
             )}
          </EmptyState>
        ) : eventosMostrados.length === 0 ? (
          <EmptyState Icono={IconoEventos} titulo="Sin eventos futuros" mensaje="No hay eventos programados que coincidan con el filtro. Prueba desactivarlo para ver el historial."/>
        ) : (
          <div className="space-y-6">
            {eventosMostrados.map(evento => (
              <TarjetaEventoAdmin 
                key={evento.id} 
                evento={evento} 
                esAdmin={!!esAdmin} 
                onCompartir={abrirModalCompartir} 
                onGestionar={abrirModalGestion} 
                onEditar={abrirFormulario} 
                onEliminar={abrirConfirmacionEliminar} 
                onUpdateNombre={actualizarNombreEvento} 
              />
            ))}
          </div>
        )}
      </div>

      {esAdmin && modalFormularioAbierto && (
        <FormularioEvento 
          abierto={modalFormularioAbierto} 
          onCerrar={cerrarFormulario} 
          onGuardar={guardarEventoHandler} 
          eventoActual={eventoEnEdicion} 
          cargando={cargandoCRUD}
        />
      )}

      {modalCompartirAbierto && eventoACompartir && (
        <ModalCompartirEvento 
          abierto={modalCompartirAbierto} 
          onCerrar={() => setModalCompartirAbierto(false)} 
          evento={eventoACompartir}
        />
      )}

      {esAdmin && modalGestionAbierto && eventoAGestionar && (
        <ModalGestionarSolicitudes 
          abierto={modalGestionAbierto} 
          onCerrar={() => setModalGestionAbierto(false)} 
          evento={eventoAGestionar} 
          onSolicitudGestionada={cargarEventos} 
        />
      )}

      {esAdmin && modalConfirmacionAbierto && eventoAEliminar && (
        <ModalConfirmacion 
          abierto={modalConfirmacionAbierto} 
          titulo="Confirmar Eliminación" 
          mensaje={`¿Estás seguro de que quieres eliminar el evento "${eventoAEliminar.nombre}"?`} 
          onCerrar={cerrarConfirmacion} 
          onConfirmar={confirmarEliminacion} 
          cargando={cargandoCRUD}
        />
      )}
    </div>
  );
};
