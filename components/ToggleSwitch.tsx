// components/ToggleSwitch.tsx
// Un interruptor reutilizable y estilizado para opciones booleanas.

import React from 'react';
import { motion } from 'framer-motion';

interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  ...rest
}) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleToggle}
        disabled={disabled}
        id={id}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tkd-blue focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            checked ? 'bg-tkd-blue' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        {...rest}
    >
        <motion.span
            layout
            transition={{ type: "spring", stiffness: 700, damping: 30 }}
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 ${
            checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
    </button>
  );
};

export default ToggleSwitch;