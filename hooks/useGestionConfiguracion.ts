
// hooks/useGestionConfiguracion.ts
import React, { useState, useEffect, useMemo } from 'react';
import type { Usuario, ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { RolUsuario } from '../tipos';
import { useConfiguracion } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import { calcularCapacidad } from '../utils/facturacion';
import { DOMINIOS_PASARELAS_PAGO_PERMITIDOS } from '../constantes';

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

    // Forzar inicialización con valores por defecto si el contexto aún no los tiene (evita estancamiento en Loader)
    const [localConfigNotificaciones, setLocalConfigNotificaciones] = useState<ConfiguracionNotificaciones>(() => {
        if (configNotificaciones && Object.keys(configNotificaciones).length > 0) return configNotificaciones;
        return {
            tenantId: (usuarioActual?.tenantId && usuarioActual.tenantId !== 'PLATFORM_INIT_PENDING') ? usuarioActual.tenantId : '',
            diaCobroMensual: 5,
            diasAnticipoRecordatorio: 3,
            diasGraciaSuspension: 5,
            frecuenciaSyncHoras: 24,
            frecuenciaQueryApiDias: 7
        } as ConfiguracionNotificaciones;
    });

    // IMPORTANTE: Si configClub es el por defecto (PENDING), preferimos mantener null 
    // para que la guardia de la vista dispare el Loader en lugar del Wizard.
    const [localConfigClub, setLocalConfigClub] = useState<ConfiguracionClub | null>(() => {
        if (configClub && configClub.tenantId !== 'PLATFORM_INIT_PENDING') return configClub;
        return null;
    });

    console.log("[useGestionConfiguracion] Render:", {
        hasLocal: !!localConfigClub,
        hasContext: !!configClub,
        cargando,
        tenantId: usuarioActual?.tenantId
    });

    const isInitialSync = React.useRef(true);

    useEffect(() => {
        if (configNotificaciones && Object.keys(configNotificaciones).length > 0) {
            setLocalConfigNotificaciones(configNotificaciones);
        } else if (usuarioActual?.tenantId && (!localConfigNotificaciones.tenantId)) {
            setLocalConfigNotificaciones(prev => ({
                ...prev,
                tenantId: usuarioActual.tenantId
            }));
        }

        // Sincronización inteligente: 
        // Solo sobreescribimos el estado local si es la CARGA INICIAL o si el estado local está vacío.
        // Esto evita que al guardar (y disparar refresco de contexto), el estado local 
        // "salte" a valores viejos antes de que la DB confirme.
        if (configClub) {
            const tenantCambio = localConfigClub && localConfigClub.tenantId !== configClub.tenantId;

            if (isInitialSync.current || !localConfigClub || tenantCambio) {
                console.log("[useGestionConfiguracion] Sincronización desde contexto (Motivo: " + (tenantCambio ? "Cambio de Tenant" : "Carga Inicial") + ")");
                setLocalConfigClub(configClub);
                isInitialSync.current = false;
            } else {
                console.log("[useGestionConfiguracion] Contexto actualizado, ignorando sobreescritura para preservar edición local");
            }
        } else if (usuarioActual?.tenantId && !cargando) {
            console.log("[useGestionConfiguracion] Intentando cargar configuración forzada para:", usuarioActual.tenantId);
            cargarConfiguracion();
        }
    }, [configNotificaciones, configClub, usuarioActual?.tenantId, cargando, cargarConfiguracion]);


    const usuariosFiltrados = useMemo(() => {
        if (!filtroUsuario) return usuarios;
        const filtroLowerCase = filtroUsuario.toLowerCase();
        return usuarios.filter(u =>
            u.nombreUsuario.toLowerCase().includes(filtroLowerCase) ||
            u.email.toLowerCase().includes(filtroLowerCase)
        );
    }, [usuarios, filtroUsuario]);

    // SDD pricing-cupo-real (Bloque 4, D8 design.md): calcularCapacidad ya cuenta al
    // owner/Admin DENTRO de los 3 cupos incluidos (facturacion-config.json ->
    // incluido.equipoTecnico) -- reemplaza a obtenerLimiteEquipoTecnico (utils/limitesSaas.ts,
    // borrado en este bloque), que sumaba `limitePlan + 1 + cuposAdicionales` con el owner
    // como un cupo extra oculto por fuera del plan.
    const limiteUsuariosPermitido = useMemo(() => {
        return calcularCapacidad(configClub ?? {}).equipoTecnico;
    }, [configClub]);

    // Fix tutor-role-end-to-end (2026-07-14): el cupo del plan es de STAFF (equipo técnico).
    // Tutor/Estudiante son consultores y NO deben contar contra ese límite. Se cuentan solo
    // los usuarios de staff para las validaciones de cupo.
    const cantidadStaff = useMemo(
        () => usuarios.filter((u) => u.rol !== RolUsuario.Tutor && u.rol !== RolUsuario.Estudiante).length,
        [usuarios]
    );

    const notificarLimiteUsuarios = () => {
        mostrarNotificacion(`Límite de equipo técnico alcanzado (${limiteUsuariosPermitido}). Mejora tu plan o compra cupos adicionales para agregar más perfiles.`, "warning");
    };

    const abrirFormularioUsuario = (usuario: Usuario | null = null) => {
        // VALIDACIÓN SAAS: Límite de usuarios (instructores/asistentes)
        if (!usuario && limiteUsuariosPermitido > 0 && cantidadStaff >= limiteUsuariosPermitido) {
            notificarLimiteUsuarios();
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
        if (!id && limiteUsuariosPermitido > 0 && cantidadStaff >= limiteUsuariosPermitido) {
            notificarLimiteUsuarios();
            cerrarFormularioUsuario();
            return;
        }

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
        const { name, value, type, checked } = e.target;
        const nextValue = type === 'checkbox'
            ? checked
            : type === 'number'
                ? (value === '' ? '' : Number(value))
                : value;
        setConfig((prev: any) => ({ ...prev, [name]: nextValue }));
    };

    const guardarConfiguracionesHandler = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!localConfigClub) {
            mostrarNotificacion("Error: Configuración del club no disponible.", "error");
            return;
        }

        // Fix (2026-07-18): el link de pago en línea de la academia es un dato externo
        // (Payment Link de Wompi/PayU/ePayco de la CUENTA de la academia, no de Tudojang),
        // por lo que se valida contra la whitelist de pasarelas conocidas antes de persistir.
        // Tudojang no procesa ese dinero, solo evita guardar/mostrar un link a un dominio
        // arbitrario. Defensa en profundidad adicional en firestore.rules.
        const linkPago = localConfigClub.linkPagoMensualidad?.trim();
        if (linkPago) {
            let hostnameValido = false;
            try {
                const hostname = new URL(linkPago).hostname;
                hostnameValido = DOMINIOS_PASARELAS_PAGO_PERMITIDOS.includes(hostname);
            } catch {
                hostnameValido = false;
            }
            if (!hostnameValido) {
                mostrarNotificacion("El link debe ser de Wompi, PayU o ePayco. Si usás otra pasarela, contactá soporte para agregarla.", "error");
                return;
            }
        }

        setCargandoAccion(true);
        try {
            const configNormalizada = {
                ...localConfigClub,
                valorMensualidad: Number(localConfigClub.valorMensualidad) || 0,
                moraPorcentaje: Number(localConfigClub.moraPorcentaje) || 0,
                valorMatricula: Number(localConfigClub.valorMatricula) || 0,
            };
            await guardarConfiguraciones(localConfigNotificaciones, configNormalizada);
            setLocalConfigClub(configNormalizada);
            mostrarNotificacion("Configuraciones guardadas exitosamente.", "success");
        } catch (error) {
            // Antes se tragaba el error real -- ni console.error ni el mensaje del toast lo
            // mostraban, así que un rechazo de Firestore (regla, tamaño de documento, red) era
            // indistinguible de cualquier otro fallo. Mismo patrón que guardarUsuarioHandler
            // arriba: mensaje real en el toast + log en consola para poder diagnosticar sin
            // reproducir a ciegas.
            console.error("[useGestionConfiguracion] Error al guardar configuraciones:", error);
            mostrarNotificacion(`No se pudieron guardar las configuraciones: ${error instanceof Error ? error.message : "Error desconocido"}.`, "error");
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
        limiteUsuariosPermitido,
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
        guardarConfiguraciones,
        setLocalConfigClub,
        setLocalConfigNotificaciones,
    };
};
