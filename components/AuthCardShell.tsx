// components/AuthCardShell.tsx
// Fix consistencia UX de autenticación (2026-07-15): shell visual REUTILIZADO por Login,
// ActivarCuenta y RestablecerClave (a pedido explícito del usuario: "que la UX que se
// muestre sea la misma de login... reutilizala... que esto aplique para los otros roles").
// Antes cada página de auth tenía su propio diseño distinto (fondo/tarjeta/tipografía
// diferentes) -- ahora las tres comparten el mismo header de marca (logo, "Tudojang SaaS",
// badge de versión) y el mismo contenedor de tarjeta, para cualquier rol (Tutor, Estudiante,
// Maestro, Asistente, Admin).
import React from 'react';
import { IconoLogoOficial } from './Iconos';

interface AuthCardShellProps {
  children: React.ReactNode;
}

const AuthCardShell: React.FC<AuthCardShellProps> = ({ children }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-tkd-blue p-4 transition-colors duration-500 overflow-y-auto">
      <div className="w-full max-w-md p-6 sm:p-8 landscape:p-6 space-y-6 sm:space-y-8 landscape:space-y-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-white/10 relative my-auto">
        <div className="text-center landscape:flex landscape:items-center landscape:text-left landscape:gap-5">
          <div className="bg-tkd-gray dark:bg-gray-800 w-20 h-20 sm:w-24 sm:h-24 landscape:w-16 landscape:h-16 rounded-2xl flex items-center justify-center mx-auto landscape:mx-0 shadow-inner border border-gray-100 dark:border-gray-700 flex-shrink-0">
            <IconoLogoOficial className="w-12 h-12 sm:w-16 sm:h-16 landscape:w-10 landscape:h-10 text-tkd-red" />
          </div>
          <div className="mt-4 sm:mt-6 landscape:mt-0">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
              Tudojang <span className="text-tkd-blue">SaaS</span>
            </h2>
            <p className="mt-1 sm:mt-2 text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest leading-none">Gestión Premium para Dojangs</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

export default AuthCardShell;
