// hooks/useDashboard.ts
import React, { useState, useMemo, useCallback } from 'react';
import type { SolicitudCompra, GrupoEdad, MovimientoFinanciero } from '../tipos';
import { EstadoSolicitudCompra, TipoMovimiento } from '../tipos';

import { useEstudiantes, useEventos, useTienda, useFinanzas } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';

export const useDashboard = () => {
    const { estudiantes, cargando: cargandoEstudiantes, error: errorEstudiantes, cargarEstudiantes } = useEstudiantes();
    const { eventos, cargando: cargandoEventos, error: errorEventos, cargarEventos } = useEventos();
    const { solicitudesCompra, cargando: cargandoTienda, error: errorTienda, gestionarSolicitudCompra, cargarDatosTienda } = useTienda();
    const { movimientos, cargando: cargandoFinanzas, cargarMovimientos } = useFinanzas();
    
    const { mostrarNotificacion } = useNotificacion();
    const [cargandoAccion, setCargandoAccion] = useState<Record<string, boolean>>({});
    const [filtros, setFiltros] = useState({
        fechaInicio: '',
        fechaFin: '',
        grupo: 'todos' as GrupoEdad | 'todos',
        sedeId: 'todas'
    });

    const cargando = cargandoEstudiantes || cargandoEventos || cargandoTienda || cargandoFinanzas;
    const error = errorEstudiantes || errorEventos || errorTienda;

    const recargarTodo = useCallback(() => {
        cargarEstudiantes();
        cargarEventos();
        cargarDatosTienda();
        cargarMovimientos();
    }, [cargarEstudiantes, cargarEventos, cargarDatosTienda, cargarMovimientos]);
    
    const datosFiltrados = useMemo(() => {
        let estudiantesFiltrados = [...estudiantes];
        let movimientosFiltrados = [...movimientos];
        
        // Filtro por Sede (Afecta Estudiantes y Finanzas)
        if (filtros.sedeId !== 'todas') {
            estudiantesFiltrados = estudiantesFiltrados.filter(e => e.sedeId === filtros.sedeId);
            movimientosFiltrados = movimientosFiltrados.filter(m => m.sedeId === filtros.sedeId);
        }

        // Filtro por Grupo de Edad
        if (filtros.grupo !== 'todos') {
            estudiantesFiltrados = estudiantesFiltrados.filter(e => e.grupo === filtros.grupo);
        }
        
        // Filtro por fecha de ingreso para estudiantes y fecha de registro para movimientos
        if (filtros.fechaInicio) {
            estudiantesFiltrados = estudiantesFiltrados.filter(e => e.fechaIngreso >= filtros.fechaInicio);
            movimientosFiltrados = movimientosFiltrados.filter(m => m.fecha >= filtros.fechaInicio);
        }
        if (filtros.fechaFin) {
            estudiantesFiltrados = estudiantesFiltrados.filter(e => e.fechaIngreso <= filtros.fechaFin);
            movimientosFiltrados = movimientosFiltrados.filter(m => m.fecha <= filtros.fechaFin);
        }

        const hoy = new Date().toISOString().split('T')[0];
        let eventosParaMostrar = eventos.filter(e => e.fechaEvento >= hoy);

        // Cálculos financieros basados en los filtros de sede y fecha
        const ingresos = movimientosFiltrados
            .filter(m => m.tipo === TipoMovimiento.Ingreso)
            .reduce((acc, m) => acc + m.monto, 0);
            
        const egresos = movimientosFiltrados
            .filter(m => m.tipo === TipoMovimiento.Egreso)
            .reduce((acc, m) => acc + m.monto, 0);

        return {
            estudiantesFiltrados,
            eventosParaMostrar,
            finanzas: { ingresos, egresos, balance: ingresos - egresos }
        };
    }, [estudiantes, eventos, movimientos, filtros]);

    const manejarGestionCompra = async (solicitud: SolicitudCompra, nuevoEstado: EstadoSolicitudCompra) => {
        setCargandoAccion(prev => ({ ...prev, [solicitud.id]: true }));
        try {
          const estudianteActualizado = await gestionarSolicitudCompra(solicitud.id, nuevoEstado);
          if (estudianteActualizado) {
              await cargarEstudiantes();
          }
          mostrarNotificacion("Solicitud de compra gestionada.", "success");
        } catch (error) {
          mostrarNotificacion(`No se pudo procesar la solicitud: ${error instanceof Error ? error.message : "Error desconocido"}`, "error");
        } finally {
          setCargandoAccion(prev => ({ ...prev, [solicitud.id]: false }));
        }
    };

    const handleFiltroChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const limpiarFiltros = () => {
        setFiltros({
            fechaInicio: '',
            fechaFin: '',
            grupo: 'todos',
            sedeId: 'todas'
        });
    };
    
    const filtrosActivos = filtros.fechaInicio !== '' || filtros.fechaFin !== '' || filtros.grupo !== 'todos' || filtros.sedeId !== 'todas';

    return {
        cargando,
        error,
        solicitudesCompra,
        filtros,
        filtrosActivos,
        datosFiltrados,
        cargandoAccion,
        recargarTodo,
        manejarGestionCompra,
        handleFiltroChange,
        limpiarFiltros,
    };
};