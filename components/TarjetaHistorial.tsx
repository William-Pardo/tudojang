// components/TarjetaHistorial.tsx
import React, { useState } from 'react';
import type { NotificacionHistorial } from '../tipos';
import { IconoWhatsApp, IconoEmail, IconoAprobar } from './Iconos';

interface Props {
    item: NotificacionHistorial;
    onMarcarLeida: (id: string) => void;
}

const TarjetaHistorial: React.FC<Props> = ({ item, onMarcarLeida }) => {
    const [expandido, setExpandido] = useState(false);
    
    const containerClasses = item.leida
        ? 'opacity-70 bg-gray-50 dark:bg-gray-800/50'
        : 'bg-white dark:bg-gray-800';

    return (
        <div className={`p-4 rounded-lg shadow-sm border dark:border-gray-700 transition-opacity duration-300 ${containerClasses}`}>
            <div className="flex justify-between items-start gap-4">
                <div>
                    <p className="font-bold text-tkd-dark dark:text-white">{item.estudianteNombre}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Enviado a {item.tutorNombre} ({item.destinatario})
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(item.fecha).toLocaleString('es-CO')}
                    </p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    {item.canal === 'WhatsApp' ? <IconoWhatsApp className="w-6 h-6 text-green-500" /> : <IconoEmail className="w-6 h-6 text-blue-500" />}
                    {!item.leida && (
                        <button 
                            onClick={() => onMarcarLeida(item.id)}
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Marcar como leída"
                        >
                            <IconoAprobar className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-3">
                <p className={`text-sm text-gray-700 dark:text-gray-300 ${!expandido ? 'line-clamp-2' : ''}`}>
                    {item.mensaje}
                </p>
                <button onClick={() => setExpandido(!expandido)} className="text-sm text-tkd-blue hover:underline mt-1">
                    {expandido ? 'Leer menos' : 'Leer más'}
                </button>
            </div>
        </div>
    );
};

export default TarjetaHistorial;