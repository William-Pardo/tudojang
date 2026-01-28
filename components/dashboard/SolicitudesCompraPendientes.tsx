
// components/dashboard/SolicitudesCompraPendientes.tsx

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SolicitudCompra, Estudiante } from '../../tipos';
import { EstadoSolicitudCompra, TipoNotificacion } from '../../tipos';
import { formatearPrecio, formatearFecha } from '../../utils/formatters';
// Added comment above fix: Imported useConfiguracion to provide required configClub to generating personalized messages.
import { useConfiguracion } from '../../context/DataContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { generarMensajePersonalizado } from '../../servicios/geminiService';
import { enviarNotificacion } from '../../servicios/api';
import { IconoAprobar, IconoRechazar } from '../Iconos';

interface Props {
  solicitudes: SolicitudCompra[];
  onGestionar: (solicitud: SolicitudCompra, nuevoEstado: EstadoSolicitudCompra) => void;
  cargandoAccion: Record<string, boolean>;
}

const SolicitudesCompraPendientes: React.FC<Props> = ({ solicitudes, onGestionar, cargandoAccion }) => {
  const { mostrarNotificacion } = useNotificacion();
  // Added comment above fix: Destructured configClub from useConfiguracion.
  const { configClub } = useConfiguracion();

  const handleGestion = async (solicitud: SolicitudCompra, nuevoEstado: EstadoSolicitudCompra) => {
    onGestionar(solicitud, nuevoEstado);

    if (nuevoEstado === EstadoSolicitudCompra.Aprobada) {
        try {
            mostrarNotificacion(`Solicitud de ${solicitud.estudiante.nombres} aprobada.`, "success");
            const estudianteActualizado = solicitud.estudiante;
             const concepto = `${solicitud.implemento.nombre} (${solicitud.variacion.descripcion})`;
            // Added comment above fix: Passed configClub as 3rd argument to generating personalized messages.
            const mensaje = await generarMensajePersonalizado(
              TipoNotificacion.ConfirmacionCompra,
              estudianteActualizado as any as Estudiante,
              configClub,
              { concepto, monto: solicitud.variacion.precio }
            );
            const canal = estudianteActualizado.tutor?.telefono ? 'WhatsApp' : 'Email';
            const destinatario = estudianteActualizado.tutor?.telefono || estudianteActualizado.tutor?.correo;
    
            if (destinatario) {
              await enviarNotificacion(canal, destinatario, mensaje);
              mostrarNotificacion(`Notificación enviada a ${destinatario}.`, "info");
            }
        } catch (error) {
             mostrarNotificacion("Error al enviar notificación de aprobación de compra.", "error");
        }
    } else {
        mostrarNotificacion(`Solicitud de ${solicitud.estudiante.nombres} rechazada.`, "info");
    }
  };


  if (solicitudes.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-4">
        Solicitudes de Compra Pendientes ({solicitudes.length})
      </h3>
      <div className="space-y-3 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {solicitudes.map(solicitud => (
            <motion.div
              key={solicitud.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              className="flex flex-wrap items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm"
            >
              <div className="flex-grow">
                <p className="text-sm font-medium text-tkd-dark dark:text-white">
                  <span className="font-bold">{solicitud.estudiante.nombres} {solicitud.estudiante.apellidos}</span> quiere comprar <span className="font-bold">{solicitud.implemento.nombre}</span> ({solicitud.variacion.descripcion})
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Solicitado: {formatearFecha(solicitud.fechaSolicitud)} - Valor: {formatearPrecio(solicitud.variacion.precio)}
                </p>
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                <button
                  onClick={() => handleGestion(solicitud, EstadoSolicitudCompra.Rechazada)}
                  disabled={cargandoAccion[solicitud.id]}
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 inline-flex items-center space-x-1"
                >
                  <IconoRechazar className="w-4 h-4" />
                  <span>Rechazar</span>
                </button>
                <button
                  onClick={() => handleGestion(solicitud, EstadoSolicitudCompra.Aprobada)}
                  disabled={cargandoAccion[solicitud.id]}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 inline-flex items-center space-x-1"
                >
                  <IconoAprobar className="w-4 h-4" />
                  <span>Aprobar</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SolicitudesCompraPendientes;
