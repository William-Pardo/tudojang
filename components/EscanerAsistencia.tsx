
// components/EscanerAsistencia.tsx
//
// Flujo de guarderia/entrega a tutores (Sistema C, sede-based, sin relacion a
// JornadaInstruccion). Refactor Fase 3 (clase-en-vivo-checkin-trigger-agenda):
// la camara/BarcodeDetector se extrajo a `components/academico/EscanerQR.tsx`
// (componente generico y desacoplado); este archivo conserva exactamente el
// mismo comportamiento externo (props `sedeId`/`onClose`, `api.registrarEntrada`,
// mensajes de exito/error) para no romper a sus consumidores reales
// (`vistas/MiPerfil.tsx`, `vistas/GestionClase.tsx`, `vistas/PerfilTutor.tsx`).
// El diseño original de este change (design.md, File Changes Fase 1) proponia
// modificar directamente las props de este componente a `jornadaId`/`tenantId`
// -- se descarto esa opcion porque asumia (incorrectamente) que este archivo
// solo servia al Sistema B demo; en la practica ya tiene 3 consumidores de
// produccion no relacionados a Clase en Vivo. Ver apply-progress para el
// detalle de la desviacion.
import React from 'react';
import { useNotificacion } from '../context/NotificacionContext';
import * as api from '../servicios/api';
import EscanerQR from './academico/EscanerQR';

interface Props {
    sedeId: string;
    onClose: () => void;
}

const EscanerAsistencia: React.FC<Props> = ({ sedeId, onClose }) => {
    const { mostrarNotificacion } = useNotificacion();

    const manejarDeteccion = async (idEstudiante: string) => {
        const estudiante = await api.obtenerEstudiantePorId(idEstudiante);
        await api.registrarEntrada(idEstudiante, sedeId);
        mostrarNotificacion(`Asistencia registrada: ${estudiante.nombres}`, "success");
        onClose();
    };

    return <EscanerQR onDetectarEstudiante={manejarDeteccion} onClose={onClose} />;
};

export default EscanerAsistencia;
