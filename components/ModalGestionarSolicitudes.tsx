
// components/ModalGestionarSolicitudes.tsx
// Este componente es un modal para que el administrador gestione las solicitudes de inscripción a un evento.

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Evento, SolicitudInscripcion, Estudiante } from '../tipos';
import { EstadoSolicitud, TipoNotificacion } from '../tipos';
import { obtenerSolicitudesPorEvento, gestionarSolicitud, enviarNotificacion } from '../servicios/api';
// Added comment above fix: Imported useConfiguracion to provide required configClub to generating personalized messages.
import { useConfiguracion } from '../context/DataContext';
import { useNotificacion } from '../context/NotificacionContext';
import { generarMensajePersonalizado } from '../servicios/geminiService';
import { IconoCerrar, IconoUsuario, IconoAprobar, IconoRechazar } from './Iconos';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  evento: Evento;
  onSolicitudGestionada: () => void; // Para refrescar el contador en la vista de eventos
}

const ModalGestionarSolicitudes: React.FC<Props> = ({ abierto, onCerrar, evento, onSolicitudGestionada }) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudInscripcion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoAccion, setCargandoAccion] = useState<Record<string, boolean>>({}); // { [solicitudId]: boolean }
  const [visible, setVisible] = useState(false);
  const { mostrarNotificacion } = useNotificacion();
  // Added comment above fix: Destructured configClub from useConfiguracion.
  const { configClub } = useConfiguracion();

  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onCerrar(), 200);
  };

  const cargarSolicitudes = useCallback(() => {
    if (evento.id) {
      setCargando(true);
      obtenerSolicitudesPorEvento(evento.id)
        .then(setSolicitudes)
        .catch(err => mostrarNotificacion("Error al cargar solicitudes.", "error"))
        .finally(() => setCargando(false));
    }
  }, [evento.id, mostrarNotificacion]);

  useEffect(() => {
    if (abierto) {
      cargarSolicitudes();
    }
  }, [abierto, cargarSolicitudes]);

  const manejarGestion = async (solicitud: SolicitudInscripcion, nuevoEstado: EstadoSolicitud) => {
    setCargandoAccion(prev => ({ ...prev, [solicitud.id]: true }));
    try {
      const estudianteCompleto = await gestionarSolicitud(solicitud.id, nuevoEstado);

      if (nuevoEstado === EstadoSolicitud.Aprobada && estudianteCompleto) {
        mostrarNotificacion(`Solicitud de ${estudianteCompleto.nombres} aprobada.`, "success");
        // Added comment above fix: Passed configClub as 3rd argument to generating personalized messages.
        const mensaje = await generarMensajePersonalizado(
          TipoNotificacion.ConfirmacionInscripcionEvento,
          estudianteCompleto,
          configClub,
          { concepto: evento.nombre, monto: evento.valor }
        );
        const canal = estudianteCompleto.tutor?.telefono ? 'WhatsApp' : 'Email';
        const destinatario = estudianteCompleto.tutor?.telefono || estudianteCompleto.tutor?.correo;

        if (destinatario) {
          await enviarNotificacion(canal, destinatario, mensaje);
          mostrarNotificacion(`Notificación enviada a ${destinatario}.`, "info");
        }
      } else {
        mostrarNotificacion("Solicitud rechazada.", "info");
      }

      setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
      onSolicitudGestionada();

    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : "Error desconocido";
      mostrarNotificacion(`No se pudo gestionar la solicitud: ${mensajeError}`, "error");
    } finally {
      setCargandoAccion(prev => ({ ...prev, [solicitud.id]: false }));
    }
  };


  if (!abierto) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-tkd-dark dark:text-white">Solicitudes para: {evento.nombre}</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto">
          {cargando ? (
            <p className="dark:text-gray-300">Cargando solicitudes...</p>
          ) : solicitudes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-4">No hay solicitudes pendientes para este evento.</p>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence>
                {solicitudes.map(solicitud => (
                  <motion.li
                    key={solicitud.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 50, transition: { duration: 0.3 } }}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <IconoUsuario className="w-6 h-6 text-tkd-blue" />
                      <div>
                          <p className="font-medium text-tkd-dark dark:text-white">{solicitud.estudiante.nombres} {solicitud.estudiante.apellidos}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Solicitado el: {new Date(solicitud.fechaSolicitud).toLocaleDateString('es-CO')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => manejarGestion(solicitud, EstadoSolicitud.Rechazada)}
                        disabled={cargandoAccion[solicitud.id]}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 inline-flex items-center space-x-1"
                      >
                        <IconoRechazar className="w-4 h-4" />
                        <span>{cargandoAccion[solicitud.id] ? '...' : 'Rechazar'}</span>
                      </button>
                       <button
                        onClick={() => manejarGestion(solicitud, EstadoSolicitud.Aprobada)}
                        disabled={cargandoAccion[solicitud.id]}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-green-400 inline-flex items-center space-x-1"
                      >
                        <IconoAprobar className="w-4 h-4" />
                        <span>{cargandoAccion[solicitud.id] ? '...' : 'Aprobar'}</span>
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <footer className="p-4 border-t dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-tkd-blue text-white rounded-md hover:bg-blue-800 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ModalGestionarSolicitudes;
