// componentes/TablaEstudiantes.tsx
import React from 'react';
import type { Estudiante, GrupoEntrenamiento } from '../tipos';
import { FilaEstudiante } from './FilaEstudiante';
import { AnimatePresence } from 'framer-motion';
import { detectarContactoDuplicado } from '../utils/contactoDuplicado';

interface Props {
  estudiantes: Estudiante[];
  onEditar: (estudiante: Estudiante) => void;
  onEliminar: (estudiante: Estudiante) => void;
  onVerFirma: (firma: string, tutor: Estudiante['tutor']) => void;
  onCompartirLink: (tipo: 'firma' | 'contrato' | 'imagen', idEstudiante: string) => void;
  onRetirar: (estudiante: Estudiante) => void;
  onReactivar: (estudiante: Estudiante) => void;
  // Grupo de entrenamiento + selección para asignación masiva (opcionales: sin
  // onToggleSeleccion no se pinta la columna de checkboxes).
  gruposEntrenamiento?: GrupoEntrenamiento[];
  seleccionados?: ReadonlySet<string>;
  onToggleSeleccion?: (idEstudiante: string) => void;
}

const TablaEstudiantes: React.FC<Props> = ({
  estudiantes,
  onEditar,
  onEliminar,
  onVerFirma,
  onCompartirLink,
  onRetirar,
  onReactivar,
  gruposEntrenamiento,
  seleccionados,
  onToggleSeleccion,
}) => {
  const conSeleccion = !!onToggleSeleccion;
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
      {/* Vista de Tabla para Desktop */}
      <div className="overflow-x-auto hidden md:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {conSeleccion && <th className="pl-6 py-3 w-8"><span className="sr-only">Seleccionar</span></th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grupo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado de Pago</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Documentos</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <AnimatePresence>
              {estudiantes.map(estudiante => (
                  <FilaEstudiante
                    key={estudiante.id}
                    estudiante={estudiante}
                    alertasContacto={detectarContactoDuplicado(estudiante, estudiantes)}
                    onEditar={onEditar}
                    onEliminar={onEliminar}
                    onVerFirma={onVerFirma}
                    onCompartirLink={onCompartirLink}
                    onRetirar={onRetirar}
                    onReactivar={onReactivar}
                    gruposEntrenamiento={gruposEntrenamiento}
                    seleccionado={seleccionados?.has(estudiante.id)}
                    onToggleSeleccion={onToggleSeleccion}
                    isCard={false}
                  />
                ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Vista de Tarjetas para Móvil */}
      <div className="md:hidden p-4 space-y-4">
         <AnimatePresence>
            {estudiantes.map(estudiante => (
              <FilaEstudiante
                key={estudiante.id}
                estudiante={estudiante}
                alertasContacto={detectarContactoDuplicado(estudiante, estudiantes)}
                onEditar={onEditar}
                onEliminar={onEliminar}
                onVerFirma={onVerFirma}
                onCompartirLink={onCompartirLink}
                onRetirar={onRetirar}
                onReactivar={onReactivar}
                gruposEntrenamiento={gruposEntrenamiento}
                seleccionado={seleccionados?.has(estudiante.id)}
                onToggleSeleccion={onToggleSeleccion}
                isCard={true}
              />
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TablaEstudiantes;
