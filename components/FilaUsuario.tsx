
// components/FilaUsuario.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { Usuario } from '../tipos';
import { IconoEditar, IconoEliminar, IconoContrato, IconoAprobar } from './Iconos';

interface Props {
  usuario: Usuario;
  onEditar: (usuario: Usuario) => void;
  onEliminar: (usuario: Usuario) => void;
  onGestionarContrato: (usuario: Usuario) => void;
  isCard: boolean;
}

export const FilaUsuario: React.FC<Props> = ({ usuario, onEditar, onEliminar, onGestionarContrato, isCard }) => {

  const renderBadgeContrato = () => {
      const estado = usuario.contrato?.firmado ? 'Firmado' : (usuario.contrato ? 'Pendiente' : 'Sin configurar');
      const colors: Record<string, string> = {
          'Firmado': 'bg-green-100 text-green-700 border-green-200',
          'Pendiente': 'bg-blue-100 text-blue-700 border-blue-200',
          'Sin configurar': 'bg-gray-100 text-gray-400 border-gray-200'
      };

      return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${colors[estado]}`}>
              Contrato: {estado}
          </span>
      );
  };

  const contenidoAcciones = (
     <div className="flex items-center space-x-1 justify-end">
        <button 
            onClick={() => onGestionarContrato(usuario)} 
            className={`p-2 rounded-full transition-all hover:scale-110 ${usuario.contrato?.firmado ? 'text-green-500' : 'text-gray-400 hover:text-tkd-blue'}`} 
            title="Gestionar Vínculo Legal"
        >
            <IconoContrato className="w-5 h-5" />
        </button>
        <button onClick={() => onEditar(usuario)} className="p-2 text-tkd-blue hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full transition-transform hover:scale-110" title="Editar Perfil"><IconoEditar className="w-5 h-5" /></button>
        <button onClick={() => onEliminar(usuario)} className="p-2 text-tkd-red hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 rounded-full transition-transform hover:scale-110" title="Eliminar"><IconoEliminar className="w-5 h-5" /></button>
    </div>
  );

  if (isCard) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-4 space-y-3"
      >
        <div className="flex justify-between items-start">
            <div>
                <p className="text-lg font-bold text-tkd-dark dark:text-white uppercase leading-none">{usuario.nombreUsuario}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{usuario.email}</p>
                <div className="mt-2">{renderBadgeContrato()}</div>
            </div>
            {contenidoAcciones}
        </div>
        <div className="border-t dark:border-gray-700 pt-3 space-y-2 text-sm">
             <div className="flex justify-between">
                <strong className="text-[10px] font-black uppercase text-gray-400">Rol:</strong>
                <span className="text-[10px] font-black uppercase text-tkd-red">{usuario.rol}</span>
            </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.tr
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="dark:hover:bg-gray-700/50"
    >
        <td className="px-6 py-4 whitespace-nowrap">
            <div className="font-black text-tkd-dark dark:text-white uppercase text-sm leading-none">{usuario.nombreUsuario}</div>
            <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">{usuario.email}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-black uppercase text-tkd-red">{usuario.rol}</td>
        <td className="px-6 py-4 whitespace-nowrap">{renderBadgeContrato()}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
           {contenidoAcciones}
        </td>
    </motion.tr>
  );
};
