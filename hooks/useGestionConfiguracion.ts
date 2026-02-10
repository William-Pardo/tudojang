
// hooks/useGestionConfiguracion.ts
import React, { useState, useEffect, useMemo } from 'react';
import type { Usuario, ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { useConfiguracion } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';

export const useGestionConfiguracion = () => {
    const {
        usuarios, configNotificaciones, configClub, cargando, error,
        guardarConfiguraciones, agregarUsuario, actualizarUsuario, eliminarUsuario, cargarConfiguracion
    } = useConfiguracion();
    const { usuario: usuarioActual } = useAuth();
    const { mostrarNotificacion } = useNotificacion();

    const [cargandoAccion, setCargandoAccion] = useState(false);
    const [filtroUsuario, setFiltroUsuario] = useState('');
    const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
    const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<Usuario | null>(null);
    const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);
    const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);

    const [localConfigNotificaciones, setLocalConfigNotificaciones] = useState<ConfiguracionNotificaciones>(configNotificaciones);
    const [localConfigClub, setLocalConfigClub] = useState<ConfiguracionClub | null>(configClub);

    useEffect(() => {
        if (configNotificaciones) setLocalConfigNotificaciones(configNotificaciones);
        if (configClub) setLocalConfigClub(configClub);
    }, [configNotificaciones, configClub]);


    const usuariosFiltrados = useMemo(() => {
        if (!filtroUsuario) return usuarios;
        const filtroLowerCase = filtroUsuario.toLowerCase();
        return usuarios.filter(u =>
            u.nombreUsuario.toLowerCase().includes(filtroLowerCase) ||
            u.email.toLowerCase().includes(filtroLowerCase)
        );
    }, [usuarios, filtroUsuario]);

    const abrirFormularioUsuario = (usuario: Usuario | null = null) => {
        // VALIDACIÓN SAAS: Límite de usuarios (instructores/asistentes)
        if (!usuario && usuarios.length >= configClub.limiteUsuarios) {
            mostrarNotificacion(`Límite de Personal alcanzado (${configClub.limiteUsuarios}). Por favor, mejore su plan para habilitar más perfiles de instructor.`, "warning");
            return;
        }
        setUsuarioEnEdicion(usuario);
        setModalUsuarioAbierto(true);
    };

    const cerrarFormularioUsuario = () => {
        setModalUsuarioAbierto(false);
        setUsuarioEnEdicion(null);
    };

    const guardarUsuarioHandler = async (datos: any, id?: string) => {
        setCargandoAccion(true);
        try {
            if (id) {
                await actualizarUsuario(datos, id);
            } else {
                await agregarUsuario(datos);
            }
            mostrarNotificacion("Usuario guardado exitosamente.", "success");
            cerrarFormularioUsuario();
        } catch (error) {
            mostrarNotificacion(`No se pudo guardar el usuario: ${error instanceof Error ? error.message : "Error"}.`, "error");
        } finally {
            setCargandoAccion(false);
        }
    };

    const abrirConfirmacionEliminar = (usuario: Usuario) => {
        setUsuarioAEliminar(usuario);
        setModalConfirmacionAbierto(true);
    };

    const cerrarConfirmacion = () => {
        setModalConfirmacionAbierto(false);
        setUsuarioAEliminar(null);
    };

    const confirmarEliminacion = async () => {
        if (!usuarioAEliminar) return;
        setCargandoAccion(true);
        try {
            await eliminarUsuario(usuarioAEliminar.id);
            mostrarNotificacion("Usuario eliminado.", "success");
            cerrarConfirmacion();
        } catch (error) {
            mostrarNotificacion("No se pudo eliminar el usuario.", "error");
        } finally {
            setCargandoAccion(false);
        }
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>, setConfig: React.Dispatch<React.SetStateAction<any>>) => {
        const { name, value, type } = e.target;
        setConfig((prev: any) => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) || 0 : value }));
    };

    const guardarConfiguracionesHandler = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localConfigClub) {
            mostrarNotificacion("Error: Configuración del club no disponible.", "error");
            return;
        }
        setCargandoAccion(true);
        try {
            await guardarConfiguraciones(localConfigNotificaciones, localConfigClub);
            mostrarNotificacion("Configuraciones guardadas exitosamente.", "success");
        } catch (error) {
            mostrarNotificacion("No se pudieron guardar las configuraciones.", "error");
        } finally {
            setCargandoAccion(false);
        }
    };

    return {
        cargando,
        error,
        cargarConfiguracion,
        usuarios,
        usuariosFiltrados,
        localConfigClub,
        localConfigNotificaciones,
        cargandoAccion,
        filtroUsuario,
        setFiltroUsuario,
        modalUsuarioAbierto,
        usuarioEnEdicion,
        abrirFormularioUsuario,
        cerrarFormularioUsuario,
        guardarUsuarioHandler,
        modalConfirmacionAbierto,
        usuarioAEliminar,
        abrirConfirmacionEliminar,
        cerrarConfirmacion,
        confirmarEliminacion,
        handleConfigChange,
        guardarConfiguracionesHandler,
        setLocalConfigClub,
        setLocalConfigNotificaciones,
    };
};
