
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
      'Firmado': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
      'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
      'Sin configurar': 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
    };

    const dots: Record<string, string> = {
      'Firmado': 'bg-green-500',
      'Pendiente': 'bg-amber-500 animate-pulse',
      'Sin configurar': 'bg-gray-300 dark:bg-gray-600'
    };

    return (
      <button
        onClick={() => onGestionarContrato(usuario)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${colors[estado]} transition-all hover:scale-105 active:scale-95 cursor-pointer`}
        title={estado === 'Firmado' ? 'Ver contrato y firma' : estado === 'Pendiente' ? 'Gestionar contrato pendiente' : 'Configurar contrato'}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[estado]}`}></span>
        {estado === 'Firmado' ? '✓ Firmado' : estado === 'Pendiente' ? '⏳ Pendiente' : 'Sin configurar'}
      </button>
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
