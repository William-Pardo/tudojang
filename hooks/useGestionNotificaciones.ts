
// hooks/useGestionNotificaciones.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEstudiantes, useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import * as api from '../servicios/api';
import { generarMensajePersonalizado } from '../servicios/geminiService';
import { iniciarTudojangRelay } from '../servicios/tudojangRelay';
import { EstadoPago, TipoNotificacion } from '../tipos';
import type { NotificacionHistorial } from '../tipos';

export const useGestionNotificaciones = () => {
    const { estudiantes, cargando: cargandoEstudiantes } = useEstudiantes();
    const { configClub } = useConfiguracion();
    const { mostrarNotificacion } = useNotificacion();
    const [historial, setHistorial] = useState<NotificacionHistorial[]>([]);
    const [cargandoHistorial, setCargandoHistorial] = useState(true);
    const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [progreso, setProgreso] = useState<string | null>(null);

    const cargarHistorial = useCallback(async () => {
        setCargandoHistorial(true);
        setErrorHistorial(null);
        try {
            const data = await api.obtenerHistorialNotificaciones(configClub.tenantId);
            setHistorial(data);
        } catch (err) {
            setErrorHistorial('No se pudo cargar el historial de notificaciones.');
        } finally {
            setCargandoHistorial(false);
        }
    }, [configClub.tenantId]);

    useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    const noLeidasCount = useMemo(() => historial.filter(h => !h.leida).length, [historial]);

    const handleMarcarLeida = useCallback(async (idNotificacion: string) => {
        setHistorial(prev => prev.map(n => n.id === idNotificacion ? { ...n, leida: true } : n));
        try {
            await api.marcarNotificacionComoLeida(idNotificacion);
        } catch (error) {
            mostrarNotificacion('Error al marcar la notificación como leída.', 'error');
            setHistorial(prev => prev.map(n => n.id === idNotificacion ? { ...n, leida: false } : n));
        }
    }, [mostrarNotificacion]);

    const handleMarcarTodasLeidas = useCallback(async () => {
        if (noLeidasCount === 0) return;
        const original = [...historial];
        setHistorial(prev => prev.map(n => ({ ...n, leida: true })));
        try {
            await api.marcarTodasComoLeidas(configClub.tenantId);
        } catch (error) {
            mostrarNotificacion('Error al marcar todas las notificaciones como leídas.', 'error');
            setHistorial(original);
        }
    }, [historial, noLeidasCount, mostrarNotificacion, configClub.tenantId]);

    const handleEnviarRecordatorios = async () => {
        setEnviando(true);
        setProgreso(null);

        const estudiantesARecordar = estudiantes.filter(
            e => (e.estadoPago === EstadoPago.Pendiente || e.estadoPago === EstadoPago.Vencido) && e.saldoDeudor > 0
        );

        if (estudiantesARecordar.length === 0) {
            mostrarNotificacion('No hay recordatorios de pago pendientes por enviar.', 'info');
            setEnviando(false);
            return;
        }

        let enviadosConExito = 0;

        for (let i = 0; i < estudiantesARecordar.length; i++) {
            const estudiante = estudiantesARecordar[i];
            setProgreso(`Enviando ${i + 1} de ${estudiantesARecordar.length} a ${estudiante.nombres}...`);
            
            const tutor = estudiante.tutor;
            if (!tutor) continue;

            const canal = tutor.telefono ? 'WhatsApp' : 'Email';
            const destinatario = tutor.telefono || tutor.correo;
            if (!destinatario) continue;
            
            const tipo = estudiante.estadoPago === EstadoPago.Pendiente ? TipoNotificacion.RecordatorioPago : TipoNotificacion.AvisoVencimiento;
            
            try {
                // CAMBIO CLAVE: Ahora se pasa configClub directamente
                const mensaje = await generarMensajePersonalizado(tipo, estudiante, configClub, { 
                    monto: estudiante.saldoDeudor 
                });
                
                await api.enviarNotificacion(canal, destinatario, mensaje);
                
                await api.guardarNotificacionEnHistorial({
                    tenantId: configClub.tenantId,
                    fecha: new Date().toISOString(),
                    estudianteId: estudiante.id,
                    estudianteNombre: `${estudiante.nombres} ${estudiante.apellidos}`,
                    tutorNombre: `${tutor.nombres} ${tutor.apellidos}`,
                    destinatario,
                    canal,
                    tipo,
                    mensaje,
                    leida: false,
                });

                enviadosConExito++;
            } catch (error) {
                console.error(`Error enviando notificación a ${estudiante.nombres}:`, error);
                mostrarNotificacion(`Error al enviar recordatorio para ${estudiante.nombres}.`, 'error');
            }
        }
        
        mostrarNotificacion(`${enviadosConExito} de ${estudiantesARecordar.length} recordatorios fueron enviados exitosamente.`, 'success');
        setEnviando(false);
        setProgreso(null);
        cargarHistorial(); 
    };

    const handleEnviarRecordatoriosRelay = async () => {
        setEnviando(true);
        setProgreso(null);

        const estudiantesARecordar = estudiantes.filter(
            e => (e.estadoPago === EstadoPago.Pendiente || e.estadoPago === EstadoPago.Vencido) && e.saldoDeudor > 0 && e.tutor?.telefono
        );

        if (estudiantesARecordar.length === 0) {
            mostrarNotificacion('No hay recordatorios con WhatsApp disponibles para Tudojang Relay.', 'info');
            setEnviando(false);
            return;
        }

        try {
            const messages = [];

            for (let i = 0; i < estudiantesARecordar.length; i++) {
                const estudiante = estudiantesARecordar[i];
                const tutor = estudiante.tutor;
                if (!tutor?.telefono) continue;

                setProgreso(`Preparando ${i + 1} de ${estudiantesARecordar.length} para Tudojang Relay...`);

                const tipo = estudiante.estadoPago === EstadoPago.Pendiente ? TipoNotificacion.RecordatorioPago : TipoNotificacion.AvisoVencimiento;
                const mensaje = await generarMensajePersonalizado(tipo, estudiante, configClub, {
                    monto: estudiante.saldoDeudor
                });

                messages.push({
                    id: `${estudiante.id}-${Date.now()}`,
                    phone: tutor.telefono,
                    text: mensaje,
                    studentName: `${estudiante.nombres} ${estudiante.apellidos}`,
                    tutorName: `${tutor.nombres} ${tutor.apellidos}`,
                    type: tipo
                });
            }

            const response = await iniciarTudojangRelay(messages, {
                batchSize: 10,
                maxSessionMessages: 100
            });

            if (!response.ok) {
                throw new Error(response.error || 'No se pudo iniciar Tudojang Relay.');
            }

            mostrarNotificacion(`${messages.length} recordatorios fueron entregados a Tudojang Relay.`, 'success');
        } catch (error: any) {
            mostrarNotificacion(error.message || 'No se pudo iniciar Tudojang Relay.', 'error');
        } finally {
            setEnviando(false);
            setProgreso(null);
        }
    };

    return {
        historial,
        cargando: cargandoEstudiantes || cargandoHistorial,
        error: errorHistorial,
        enviando,
        progreso,
        noLeidasCount,
        handleEnviarRecordatorios,
        handleEnviarRecordatoriosRelay,
        cargarHistorial,
        handleMarcarLeida,
        handleMarcarTodasLeidas,
    };
};
