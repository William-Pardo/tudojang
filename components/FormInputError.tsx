// components/FormInputError.tsx
import React from 'react';
import { IconoAlertaTriangulo } from './Iconos';

interface FormInputErrorProps {
  mensaje?: string;
}

const FormInputError: React.FC<FormInputErrorProps> = ({ mensaje }) => {
  if (!mensaje) return null;
  return (
    <div className="flex items-center text-sm text-red-600 dark:text-red-400 mt-1" role="alert">
      <IconoAlertaTriangulo className="w-4 h-4 mr-1 flex-shrink-0" />
      <span>{mensaje}</span>
    </div>
  );
};

export default FormInputError;
