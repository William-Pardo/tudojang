
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
    <div className="p-4 sm:p-12 space-y-12 bg-[#0D121F] min-h-screen text-white">
      <div className="flex flex-wrap gap-6 justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Eventos</h1>
          <p className="text-[10px] font-black text-gray-500 mt-2 uppercase tracking-[0.4em]">Gestión de seminarios, torneos y actividades</p>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 bg-[#1A2232] px-6 py-3 rounded-2xl border border-white/5 shadow-xl">
            <label htmlFor="mostrar-futuros" className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Mostrar solo futuros</label>
            <ToggleSwitch id="mostrar-futuros" checked={mostrarSoloFuturos} onChange={setMostrarSoloFuturos} />
          </div>
          {esAdmin && (
            <button
              onClick={() => abrirFormulario()}
              className="bg-tkd-blue text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_15px_30px_-10px_rgba(0,71,160,0.5)] hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
            >
              <IconoAgregar className="w-4 h-4" />
              <span>Agregar Evento</span>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[400px]">
        {eventos.length === 0 ? (
          <EmptyState Icono={IconoEventos} titulo="No hay eventos registrados" mensaje="Crea tu primer evento para empezar a gestionar las inscripciones.">
            {esAdmin && (
              <button onClick={() => abrirFormulario()} className="bg-tkd-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest mt-6 shadow-2xl hover:bg-blue-800 transition-all">
                <IconoAgregar className="w-5 h-5 inline-block mr-2 mt-[-2px]" />
                <span>Agregar Evento</span>
              </button>
            )}
          </EmptyState>
        ) : eventosMostrados.length === 0 ? (
          <EmptyState Icono={IconoEventos} titulo="Sin eventos futuros" mensaje="No hay eventos programados que coincidan con el filtro. Prueba desactivarlo para ver el historial." />
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

      {esAdmin && (
        <FormularioEvento
          abierto={modalFormularioAbierto}
          onCerrar={cerrarFormulario}
          onGuardar={guardarEventoHandler}
          eventoActual={eventoEnEdicion}
          cargando={cargandoCRUD}
        />
      )}
    </div>
  );
};
