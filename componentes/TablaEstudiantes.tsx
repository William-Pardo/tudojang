// componentes/TablaEstudiantes.tsx
import React from 'react';
import type { Estudiante } from '../tipos';
import { FilaEstudiante } from './FilaEstudiante';
import { AnimatePresence } from 'framer-motion';

interface Props {
  estudiantes: Estudiante[];
  onEditar: (estudiante: Estudiante) => void;
  onEliminar: (estudiante: Estudiante) => void;
  onVerFirma: (firma: string, tutor: Estudiante['tutor']) => void;
  onCompartirLink: (tipo: 'firma' | 'contrato' | 'imagen', idEstudiante: string) => void;
}

const TablaEstudiantes: React.FC<Props> = ({
  estudiantes,
  onEditar,
  onEliminar,
  onVerFirma,
  onCompartirLink,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grupo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado de Pago</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Documentos</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          <AnimatePresence>
            {estudiantes.length > 0 ? (
              estudiantes.map(estudiante => (
                <FilaEstudiante
                  key={estudiante.id}
                  estudiante={estudiante}
                  onEditar={onEditar}
                  onEliminar={onEliminar}
                  onVerFirma={onVerFirma}
                  onCompartirLink={onCompartirLink}
                />
              ))
            ) : (
              <tr><td colSpan={5} className="text-center py-4 dark:text-gray-400">No se encontraron estudiantes con los filtros aplicados.</td></tr>
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
};

export default TablaEstudiantes;