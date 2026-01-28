
// hooks/useGestionTienda.ts
import { useState, useMemo } from 'react';
import type { Implemento, VariacionImplemento, Estudiante, CategoriaImplemento } from '../tipos';
import { TipoNotificacion } from '../tipos';
import { enviarNotificacion } from '../servicios/api';
import { generarMensajePersonalizado } from '../servicios/geminiService';
import { useNotificacion } from '../context/NotificacionContext';
// Added comment above fix: Imported useConfiguracion from DataContext.
import { useTienda, useEstudiantes, useConfiguracion } from '../context/DataContext';

export const useGestionTienda = () => {
    const { implementos, cargando, error, registrarCompra, cargarDatosTienda } = useTienda();
    const { cargarEstudiantes } = useEstudiantes();
    const { mostrarNotificacion } = useNotificacion();
    // Added comment above fix: Destructured configClub from useConfiguracion.
    const { configClub } = useConfiguracion();

    // Estado local de UI
    const [modalAbierto, setModalAbierto] = useState(false);
    const [cargandoCompra, setCargandoCompra] = useState(false);
    const [modalCompartirAbierto, setModalCompartirAbierto] = useState(false);
    const [compraSeleccionada, setCompraSeleccionada] = useState<{ implemento: Implemento, variacion: VariacionImplemento } | null>(null);
    const [selecciones, setSelecciones] = useState<Record<string, string>>({});
    
    // Estado para filtros
    const [filtroCategoria, setFiltroCategoria] = useState<CategoriaImplemento | 'todos'>('todos');
    const [filtroPrecio, setFiltroPrecio] = useState<string>('todos');

    const implementosFiltrados = useMemo(() => {
        return implementos
            .filter(imp => {
                if (filtroCategoria === 'todos') return true;
                return imp.categoria === filtroCategoria;
            })
            .filter(imp => {
                if (filtroPrecio === 'todos') return true;
                const [min, max] = filtroPrecio.split('-').map(Number);
                // Incluye el implemento si ALGUNA de sus variaciones está en el rango
                return imp.variaciones.some(v => v.precio >= min && (max ? v.precio <= max : true));
            });
    }, [implementos, filtroCategoria, filtroPrecio]);

    const handleSeleccionChange = (implementoId: string, variacionId: string) => {
        setSelecciones(prev => ({ ...prev, [implementoId]: variacionId }));
    };

    const iniciarCompra = (implemento: Implemento, variacionId: string) => {
        const variacion = implemento.variaciones.find(v => v.id === variacionId);
        if (variacion) {
        setCompraSeleccionada({ implemento, variacion });
        setModalAbierto(true);
        }
    };
    
    const limpiarFiltros = () => {
        setFiltroCategoria('todos');
        setFiltroPrecio('todos');
    };

    const procesarCompra = async (estudiante: Estudiante) => {
        if (!compraSeleccionada) return;
        setCargandoCompra(true);
        try {
            const estudianteActualizado = await registrarCompra(estudiante.id, compraSeleccionada.implemento, compraSeleccionada.variacion);
            await cargarEstudiantes(); // Recargar estudiantes para reflejar el cambio de saldo
            
            const concepto = `${compraSeleccionada.implemento.nombre} (${compraSeleccionada.variacion.descripcion})`;
            // Added comment above fix: Passed configClub as 3rd argument to generating personalized messages.
            const mensaje = await generarMensajePersonalizado(TipoNotificacion.ConfirmacionCompra, estudianteActualizado, configClub, { concepto, monto: compraSeleccionada.variacion.precio });
            
            const canal = estudiante.tutor?.telefono ? 'WhatsApp' : 'Email';
            const destinatario = estudiante.tutor?.telefono || estudiante.tutor?.correo;

            if(destinatario) {
                await enviarNotificacion(canal, destinatario, mensaje);
                mostrarNotificacion(`Notificación enviada a ${destinatario}.`, "info");
            }
            
            mostrarNotificacion("Compra asignada correctamente.", "success");

        } catch (error) {
            mostrarNotificacion(`Error al procesar la compra: ${error instanceof Error ? error.message : "Error desconocido"}`, "error");
        } finally {
            setCargandoCompra(false);
            setModalAbierto(false);
            setCompraSeleccionada(null);
        }
    };

    return {
        // Datos y estado de carga
        implementos,
        implementosFiltrados,
        cargando,
        error,
        cargarDatosTienda,

        // Estado y manejadores de UI
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

        // Filtros
        filtroCategoria,
        setFiltroCategoria,
        filtroPrecio,
        setFiltroPrecio,
        limpiarFiltros,
    };
};
