
// components/TablaUsuarios.tsx
import React from 'react';
import type { Usuario } from '../tipos';
import { FilaUsuario } from './FilaUsuario';
import { AnimatePresence } from 'framer-motion';

interface Props {
  usuarios: Usuario[];
  onEditar: (usuario: Usuario) => void;
  onEliminar: (usuario: Usuario) => void;
  onGestionarContrato: (usuario: Usuario) => void;
}

const TablaUsuarios: React.FC<Props> = ({ usuarios, onEditar, onEliminar, onGestionarContrato }) => {
  return (
    <div>
      {/* Vista de Tabla para Desktop */}
      <div className="rounded-lg shadow-sm overflow-x-auto border border-gray-200 dark:border-gray-700 hidden md:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-500 dark:text-gray-300 tracking-widest">Nombre y Email</th>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-500 dark:text-gray-300 tracking-widest">Rol</th>
              <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-500 dark:text-gray-300 tracking-widest">Estado Legal</th>
              <th className="px-6 py-3 text-right text-[10px] font-black uppercase text-gray-500 dark:text-gray-300 tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <AnimatePresence>
                {usuarios.length > 0 ? usuarios.map(usuario => (
                    <FilaUsuario 
                        key={usuario.id} 
                        usuario={usuario}
                        onEditar={onEditar}
                        onEliminar={onEliminar}
                        onGestionarContrato={onGestionarContrato}
                        isCard={false}
                    />
                )) : <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay personal registrado.</td></tr>}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

       {/* Vista de Tarjetas para Móvil */}
       <div className="md:hidden space-y-4">
         <AnimatePresence>
            {usuarios.length > 0 ? usuarios.map(usuario => (
                <FilaUsuario 
                    key={usuario.id} 
                    usuario={usuario}
                    onEditar={onEditar}
                    onEliminar={onEliminar}
                    onGestionarContrato={onGestionarContrato}
                    isCard={true}
                />
            )) : <p className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay personal registrado.</p>}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TablaUsuarios;
