// components/academico/EscanerAsistenciaClase.tsx
//
// Consumidor nuevo de `EscanerQR` (Fase 3, clase-en-vivo-checkin-trigger-agenda):
// escanea el QR del carnet y registra check-in/check-out sobre una
// `JornadaInstruccion` real via el callable server-side
// `registrarAsistenciaJornada` (functions/academico/asistencia.js, Fase 1),
// en vez de `api.registrarEntrada` (flujo de guarderia, sin relacion).
//
// A diferencia de `EscanerAsistencia.tsx` (que cierra tras un solo escaneo),
// este consumidor NO cierra el escaner tras un registro exitoso: una Clase en
// Vivo espera multiples estudiantes en secuencia. `EscanerQR` ya soporta esto
// (resetea su estado interno de "procesando" tanto en exito como en error).
import React from 'react';
import { useNotificacion } from '../../context/NotificacionContext';
import EscanerQR from './EscanerQR';
import { registrarAsistenciaClase } from '../../servicios/academico/asistenciaClaseService';

export interface EscanerAsistenciaClaseProps {
    tenantId: string;
    jornadaId: string;
    onClose: () => void;
    /** Notifica a la vista contenedora tras cada check-in/check-out exitoso, para refrescar la lista de asistencia en vivo. */
    onRegistrado?: () => void;
}

const MENSAJE_POR_TIPO: Record<'entrada' | 'salida', string> = {
    entrada: 'Check-in registrado',
    salida: 'Check-out registrado',
};

const EscanerAsistenciaClase: React.FC<EscanerAsistenciaClaseProps> = ({
    tenantId,
    jornadaId,
    onClose,
    onRegistrado,
}) => {
    const { mostrarNotificacion } = useNotificacion();

    const manejarDeteccion = async (estudianteId: string) => {
        const resultado = await registrarAsistenciaClase({ tenantId, jornadaId, estudianteId });
        mostrarNotificacion(MENSAJE_POR_TIPO[resultado.tipo], 'success');
        onRegistrado?.();
    };

    return (
        <EscanerQR
            onDetectarEstudiante={manejarDeteccion}
            onClose={onClose}
            titulo="Control de Asistencia"
            subtitulo="Check-in / Check-out de asistencia"
        />
    );
};

export default EscanerAsistenciaClase;
