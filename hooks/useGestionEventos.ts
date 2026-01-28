// hooks/useGestionEventos.ts
import { useState, useMemo } from 'react';
import type { Evento } from '../tipos';
import { RolUsuario } from '../tipos';
import { useAuth } from '../context/AuthContext';
import { useEventos } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';

export const useGestionEventos = () => {
    const { eventos, cargando, error, cargarEventos, agregarEvento, actualizarEvento, eliminarEvento } = useEventos();
    const { mostrarNotificacion } = useNotificacion();
    const { usuario } = useAuth();
    const esAdmin = usuario?.rol === RolUsuario.Admin;

    // Estado local para UI
    const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
    const [eventoEnEdicion, setEventoEnEdicion] = useState<Evento | null>(null);
    const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);
    const [eventoAEliminar, setEventoAEliminar] = useState<Evento | null>(null);
    const [cargandoCRUD, setCargandoCRUD] = useState(false);
    const [modalCompartirAbierto, setModalCompartirAbierto] = useState(false);
    const [eventoACompartir, setEventoACompartir] = useState<Evento | null>(null);
    const [modalGestionAbierto, setModalGestionAbierto] = useState(false);
    const [eventoAGestionar, setEventoAGestionar] = useState<Evento | null>(null);
    const [mostrarSoloFuturos, setMostrarSoloFuturos] = useState(true);

    const eventosMostrados = useMemo(() => {
        if (!mostrarSoloFuturos) return eventos;
        const hoy = new Date().toISOString().split('T')[0];
        return eventos.filter(e => e.fechaEvento >= hoy);
    }, [eventos, mostrarSoloFuturos]);
    
    const abrirModalCompartir = (evento: Evento) => {
        setEventoACompartir(evento);
        setModalCompartirAbierto(true);
    };

    const abrirModalGestion = (evento: Evento) => {
        setEventoAGestionar(evento);
        setModalGestionAbierto(true);
    };

    const abrirFormulario = (evento: Evento | null = null) => {
        setEventoEnEdicion(evento);
        setModalFormularioAbierto(true);
    };
    
    const cerrarFormulario = () => {
        setModalFormularioAbierto(false);
        setEventoEnEdicion(null);
    };
    
    const guardarEventoHandler = async (datosEvento: Omit<Evento, 'id'> | Evento) => {
        setCargandoCRUD(true);
        try {
        if ('id' in datosEvento) {
            await actualizarEvento(datosEvento);
            mostrarNotificacion("Evento actualizado correctamente.", "success");
        } else {
            await agregarEvento(datosEvento);
            mostrarNotificacion("Evento agregado correctamente.", "success");
        }
        cerrarFormulario();
        } catch (error) {
        mostrarNotificacion("No se pudo guardar el evento.", "error");
        throw error;
        } finally {
        setCargandoCRUD(false);
        }
    };

    const actualizarNombreEvento = async (eventoId: string, nuevoNombre: string) => {
        const eventoOriginal = eventos.find(e => e.id === eventoId);
        if (!eventoOriginal) {
            throw new Error("Evento no encontrado");
        }
    
        try {
            const eventoActualizado = { ...eventoOriginal, nombre: nuevoNombre };
            await actualizarEvento(eventoActualizado);
            mostrarNotificacion("Nombre del evento actualizado.", "success");
        } catch (error) {
            mostrarNotificacion("No se pudo actualizar el nombre del evento.", "error");
            throw error; // Re-lanzar para informar al componente que llama
        }
    };

    const abrirConfirmacionEliminar = (evento: Evento) => {
        setEventoAEliminar(evento);
        setModalConfirmacionAbierto(true);
    };

    const cerrarConfirmacion = () => {
        setModalConfirmacionAbierto(false);
        setEventoAEliminar(null);
    };
    
    const confirmarEliminacion = async () => {
        if (!eventoAEliminar) return;
        setCargandoCRUD(true);
        try {
        await eliminarEvento(eventoAEliminar.id);
        mostrarNotificacion("Evento eliminado.", "success");
        cerrarConfirmacion();
        } catch(error) {
        mostrarNotificacion("No se pudo eliminar el evento.", "error");
        } finally {
        setCargandoCRUD(false);
        }
    };

    return {
        // Datos y estado de carga
        eventos,
        eventosMostrados,
        cargando,
        error,
        cargarEventos,
        esAdmin,

        // Estado de filtros
        mostrarSoloFuturos,
        setMostrarSoloFuturos,

        // Estado de modales y acciones
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
    };
};