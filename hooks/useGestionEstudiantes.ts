
// hooks/useGestionEstudiantes.ts
import { useState, useMemo, useCallback, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Estudiante } from '../tipos';
import { GrupoEdad, EstadoPago, TipoNotificacion } from '../tipos';
import { enviarNotificacion } from '../servicios/api';
import { generarMensajePersonalizado } from '../servicios/geminiService';
import { useNotificacion } from '../context/NotificacionContext';
import { useEstudiantes, useConfiguracion } from '../context/DataContext';
import { generarUrlAbsoluta } from '../utils/formatters';

const ITEMS_PER_PAGE = 10;

export const useGestionEstudiantes = () => {
    const { estudiantes, cargando, error, agregarEstudiante, actualizarEstudiante, eliminarEstudiante, cargarEstudiantes } = useEstudiantes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const location = ReactRouterDOM.useLocation();

    // Estado local para UI
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroGrupo, setFiltroGrupo] = useState<GrupoEdad | 'todos'>('todos');
    const [filtroEstado, setFiltroEstado] = useState<EstadoPago | 'todos'>('todos');
    const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
    const [estudianteEnEdicion, setEstudianteEnEdicion] = useState<Estudiante | null>(null);
    const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);
    const [estudianteAEliminar, setEstudianteAEliminar] = useState<Estudiante | null>(null);
    const [cargandoAccion, setCargandoAccion] = useState(false);
    const [modalFirmaAbierto, setModalFirmaAbierto] = useState(false);
    const [firmaParaVer, setFirmaParaVer] = useState<{ firma: string; tutor: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const query = params.get('q');
        if (query) {
            setFiltroNombre(query);
        }
    }, [location.search]);

    const estudiantesFiltrados = useMemo(() => {
        if (error) return [];
        return estudiantes.filter(e => {
            const nombreCompleto = `${e.nombres} ${e.apellidos}`.toLowerCase();
            const pasaFiltroNombre = filtroNombre === '' || nombreCompleto.includes(filtroNombre.toLowerCase());
            const pasaFiltroGrupo = filtroGrupo === 'todos' || e.grupo === filtroGrupo;
            const pasaFiltroEstado = filtroEstado === 'todos' || e.estadoPago === filtroEstado;
            return pasaFiltroNombre && pasaFiltroGrupo && pasaFiltroEstado;
        });
    }, [estudiantes, filtroNombre, filtroGrupo, filtroEstado, error]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [filtroNombre, filtroGrupo, filtroEstado]);

    const totalPages = Math.ceil(estudiantesFiltrados.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const estudiantesPaginados = useMemo(() => 
        estudiantesFiltrados.slice(startIndex, endIndex),
        [estudiantesFiltrados, currentPage, startIndex, endIndex]
    );

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    const goToPreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const abrirFormulario = (estudiante: Estudiante | null = null) => {
        if (!estudiante && estudiantes.length >= configClub.limiteEstudiantes) {
            mostrarNotificacion(`Límite del Plan superado (${configClub.limiteEstudiantes} alumnos). Por favor, suba de plan para agregar más estudiantes.`, "warning");
            return;
        }
        setEstudianteEnEdicion(estudiante);
        setModalFormularioAbierto(true);
    };
    
    const cerrarFormulario = () => {
        setModalFormularioAbierto(false);
        setEstudianteEnEdicion(null);
    };

    const guardarEstudiante = async (datosEstudiante: Estudiante) => {
        setCargandoAccion(true);
        try {
            if (datosEstudiante.id) { 
                await actualizarEstudiante(datosEstudiante);
                mostrarNotificacion("Estudiante actualizado correctamente.", "success");
            } else { 
                const nuevoEstudiante = await agregarEstudiante(datosEstudiante);
                mostrarNotificacion("Estudiante creado correctamente.", "success");
                
                const canal = nuevoEstudiante.tutor?.telefono ? 'WhatsApp' : 'Email';
                const destinatario = nuevoEstudiante.tutor?.telefono || nuevoEstudiante.tutor?.correo;

                if (destinatario && nuevoEstudiante.tutor) {
                    const links = [];
                    if (!nuevoEstudiante.consentimientoInformado) links.push({ nombre: 'Consentimiento de Riesgos', url: generarUrlAbsoluta(`/firma/${nuevoEstudiante.id}`) });
                    if (!nuevoEstudiante.contratoServiciosFirmado) links.push({ nombre: 'Contrato de Servicios', url: generarUrlAbsoluta(`/contrato/${nuevoEstudiante.id}`) });
                    if (!nuevoEstudiante.consentimientoImagenFirmado) links.push({ nombre: 'Autorización de Manejo de Imagen', url: generarUrlAbsoluta(`/imagen/${nuevoEstudiante.id}`) });

                    if (links.length > 0) {
                        // Added comment above fix: Passed configClub as 3rd argument to generating personalized messages.
                        const mensaje = await generarMensajePersonalizado(TipoNotificacion.Bienvenida, nuevoEstudiante, configClub, { links });
                        await enviarNotificacion(canal, destinatario, mensaje);
                        mostrarNotificacion(`Notificación enviada a ${destinatario}.`, "info");
                    }
                }
            }
            cerrarFormulario();
        } catch(error) {
            mostrarNotificacion("No se pudo guardar el estudiante.", "error");
            throw error;
        } finally {
            setCargandoAccion(false);
        }
    };

    const abrirConfirmacionEliminar = (estudiante: Estudiante) => {
        setEstudianteAEliminar(estudiante);
        setModalConfirmacionAbierto(true);
    };

    const cerrarConfirmacion = () => {
        setModalConfirmacionAbierto(false);
        setEstudianteAEliminar(null);
    };

    const confirmarEliminacion = async () => {
        if (!estudianteAEliminar) return;
        setCargandoAccion(true);
        try {
            await eliminarEstudiante(estudianteAEliminar.id);
            mostrarNotificacion("Estudiante dado de baja.", "success");
            cerrarConfirmacion();
        } catch(error) {
            mostrarNotificacion("No se pudo eliminar el estudiante.", "error");
        } finally {
            setCargandoAccion(false);
        }
    };
    
    const handleShareLink = async (tipo: 'firma' | 'contrato' | 'imagen', idEstudiante: string) => {
        const url = generarUrlAbsoluta(`/${tipo}/${idEstudiante}`);
        const estudiante = estudiantes.find(e => e.id === idEstudiante);
        const nombreEstudiante = estudiante ? `${estudiante.nombres}` : 'el estudiante';

        const textos = {
            firma: `🥋 Hola, por favor firma el Consentimiento de Riesgos para ${nombreEstudiante} en ${configClub.nombreClub}:`,
            contrato: `📄 Hola, por favor firma el Contrato de Servicios para ${nombreEstudiante} en ${configClub.nombreClub}:`,
            imagen: `📸 Hola, por favor firma la Autorización de Manejo de Imagen para ${nombreEstudiante} en ${configClub.nombreClub}:`
        };

        const mensajeCompleto = `${textos[tipo]}\n\n${url}`;
        
        try {
            // Caso 1: Navegador móvil con soporte nativo de compartir
            if (navigator.share) {
                await navigator.share({
                    title: 'Firma de Documentos - ' + configClub.nombreClub,
                    text: textos[tipo],
                    url: url
                });
                mostrarNotificacion("Enlace compartido con éxito.", "success");
            } else {
                // Caso 2: Navegador de escritorio (Fallback manual)
                await navigator.clipboard.writeText(mensajeCompleto);
                mostrarNotificacion("Enlace copiado al portapapeles. ¡Pégalo en WhatsApp!", "success");
                
                // Intentar abrir WhatsApp Web automáticamente si es posible
                if (estudiante?.tutor?.telefono) {
                    const tel = estudiante.tutor.telefono.replace(/\s+/g, '');
                    window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(mensajeCompleto)}`, '_blank');
                }
            }
        } catch (err) {
            // Error al compartir (usuario canceló o bloqueo de portapapeles)
            console.error("Error al compartir:", err);
            // Re-intento silencioso de copia
            try {
                await navigator.clipboard.writeText(url);
                mostrarNotificacion("Se copió solo la URL. Pégala en el chat.", "info");
            } catch (copyErr) {
                mostrarNotificacion("No se pudo copiar el enlace. Intenta de nuevo.", "error");
            }
        }
    };

    const abrirModalFirma = (firma: string, tutor: Estudiante['tutor']) => {
        if (firma && tutor) {
            setFirmaParaVer({ firma, tutor: `${tutor.nombres} ${tutor.apellidos}` });
            setModalFirmaAbierto(true);
        }
    };

    const cerrarModalFirma = () => {
        setModalFirmaAbierto(false);
        setFirmaParaVer(null);
    };

    const exportarCSV = useCallback(() => {
        if (estudiantesFiltrados.length === 0) {
            mostrarNotificacion("No hay estudiantes para exportar.", "info");
            return;
        }
    
        const headers = [
            'Nombres', 'Apellidos', 'NumeroIdentificacion', 'FechaNacimiento', 'Grupo',
            'Correo', 'Telefono', 'EstadoPago', 'SaldoDeudor',
            'ConsentimientoRiesgos', 'ContratoServicios', 'AutorizaFotos', 'DocImagenFirmado',
            'TutorNombres', 'TutorApellidos', 'TutorIdentificacion', 'TutorCorreo', 'TutorTelefono'
        ];
    
        const escapeCSV = (value: any): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
    
        const csvRows = [
            headers.join(','),
            ...estudiantesFiltrados.map(e => ([
                escapeCSV(e.nombres),
                escapeCSV(e.apellidos),
                escapeCSV(e.numeroIdentificacion),
                escapeCSV(e.fechaNacimiento),
                escapeCSV(e.grupo),
                escapeCSV(e.correo),
                escapeCSV(e.telefono),
                escapeCSV(e.estadoPago),
                e.saldoDeudor,
                e.consentimientoInformado ? 'Sí' : 'No',
                e.contratoServiciosFirmado ? 'Sí' : 'No',
                e.consentimientoFotosVideos ? 'Sí' : 'No',
                e.consentimientoImagenFirmado ? 'Sí' : 'No',
                escapeCSV(e.tutor?.nombres),
                escapeCSV(e.tutor?.apellidos),
                escapeCSV(e.tutor?.numeroIdentificacion),
                escapeCSV(e.tutor?.correo),
                escapeCSV(e.tutor?.telefono),
            ].join(',')))
        ];
    
        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `export_estudiantes_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        mostrarNotificacion("Exportación a CSV completada.", "success");
    
    }, [estudiantesFiltrados, mostrarNotificacion]);

    return {
        estudiantes,
        cargando,
        error,
        cargarEstudiantes,
        filtroNombre,
        setFiltroNombre,
        filtroGrupo,
        setFiltroGrupo,
        filtroEstado,
        setFiltroEstado,
        estudiantesFiltrados,
        estudiantesPaginados,
        currentPage,
        totalPages,
        startIndex,
        endIndex,
        goToNextPage,
        goToPreviousPage,
        modalFormularioAbierto,
        estudianteEnEdicion,
        abrirFormulario,
        cerrarFormulario,
        guardarEstudiante,
        cargandoAccion,
        modalConfirmacionAbierto,
        estudianteAEliminar,
        abrirConfirmacionEliminar,
        cerrarConfirmacion,
        confirmarEliminacion,
        modalFirmaAbierto,
        firmaParaVer,
        abrirModalFirma,
        cerrarModalFirma,
        handleShareLink,
        exportarCSV,
    };
};
