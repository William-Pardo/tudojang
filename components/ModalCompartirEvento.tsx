// components/ModalCompartirEvento.tsx
// Un modal que ofrece múltiples opciones para compartir un evento.

import React, { useState, useEffect } from 'react';
import type { Evento } from '../tipos';
import { generarUrlAbsoluta } from '../utils/formatters';
import { useNotificacion } from '../context/NotificacionContext';
import { 
    IconoCerrar, 
    IconoWhatsApp, 
    IconoEmail, 
    IconoFacebook, 
    IconoXTwitter, 
    IconoLinkedIn, 
    IconoCopiar 
} from './Iconos';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  evento: Evento;
}

const ModalCompartirEvento: React.FC<Props> = ({ abierto, onCerrar, evento }) => {
  const [visible, setVisible] = useState(false);
  const { mostrarNotificacion } = useNotificacion();

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

  if (!abierto) return null;

  const url = generarUrlAbsoluta(`/evento/${evento.id}`);
  const texto = `¡Te invitamos a nuestro próximo evento: "${evento.nombre}"! Haz clic en el enlace para ver más detalles y solicitar tu inscripción:`;
  const textoEncoded = encodeURIComponent(texto);
  const urlEncoded = encodeURIComponent(url);

  const opciones = [
    { red: 'WhatsApp', icono: IconoWhatsApp, url: `https://wa.me/?text=${textoEncoded}%20${urlEncoded}`, color: 'text-green-500' },
    { red: 'Email', icono: IconoEmail, url: `mailto:?subject=Invitación: ${encodeURIComponent(evento.nombre)}&body=${textoEncoded}%0A%0A${urlEncoded}`, color: 'text-gray-600' },
    { red: 'Facebook', icono: IconoFacebook, url: `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`, color: 'text-blue-600' },
    { red: 'X (Twitter)', icono: IconoXTwitter, url: `https://twitter.com/intent/tweet?text=${textoEncoded}&url=${urlEncoded}`, color: 'text-black dark:text-white' },
    { red: 'LinkedIn', icono: IconoLinkedIn, url: `https://www.linkedin.com/shareArticle?mini=true&url=${urlEncoded}&title=${encodeURIComponent(evento.nombre)}&summary=${textoEncoded}`, color: 'text-blue-700' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      mostrarNotificacion('¡Enlace copiado al portapapeles!', 'success');
      handleClose();
    }).catch(err => {
        mostrarNotificacion('No se pudo copiar el enlace.', 'error');
    });
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-200 ease-out ${visible ? 'bg-opacity-60' : 'bg-opacity-0'}`} aria-modal="true" role="dialog" onClick={handleClose}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-tkd-dark dark:text-white">Compartir Evento</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 transition-transform hover:scale-110 active:scale-100">
            <IconoCerrar className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6">
          <p className="text-center font-semibold text-tkd-blue mb-5">{evento.nombre}</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {opciones.map(({ red, icono: Icono, url, color }) => (
              <a 
                key={red} 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                aria-label={`Compartir en ${red}`}
              >
                <Icono className={`w-10 h-10 mb-1 transition-transform group-hover:scale-110 ${color}`} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{red}</span>
              </a>
            ))}
             <button 
                onClick={handleCopy} 
                className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                aria-label="Copiar enlace"
            >
              <IconoCopiar className="w-10 h-10 mb-1 transition-transform group-hover:scale-110 text-gray-600 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Copiar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalCompartirEvento;