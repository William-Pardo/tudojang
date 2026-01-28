
// components/Footer.tsx
// Este componente renderiza el pie de página de la aplicación simplificado.

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="p-6 bg-white border-t dark:bg-gray-900 dark:border-white/5">
      <div className="flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
          &copy; 2026 Aliant. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
