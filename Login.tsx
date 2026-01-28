// vistas/Login.tsx
// Este componente renderiza la pantalla de inicio de sesión.
// Es la primera pantalla que ve un usuario no autenticado.

import React, { useState } from 'react';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoUsuario, IconoLogoOficial, IconoLogin } from '../components/Iconos';

interface LoginProps {
  onLogin: (usuario: string, contrasena: string) => void;
  error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(usuario, contrasena);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-tkd-blue">
      <div className="w-full max-w-md p-8 space-y-8 bg-tkd-gray rounded-lg shadow-2xl dark:bg-gray-800">
        <div className="text-center">
            <IconoLogoOficial aria-label="Logo TaekwondoGa Jog" className="w-24 h-24 mx-auto" />
            <h2 className="mt-6 text-3xl font-extrabold text-tkd-dark dark:text-white">
                Bienvenido
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Inicia sesión en el Módulo de Gestión
            </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={manejarSubmit}>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <IconoUsuario className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="usuario"
              name="usuario"
              type="text"
              autoComplete="username"
              required
              className="w-full py-3 pl-10 pr-4 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200 shadow-sm"
              placeholder="Nombre de usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <IconoCandado className="w-5 h-5 text-gray-400" />
            </div>
            <input
              id="contrasena"
              name="contrasena"
              type={mostrarContrasena ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="w-full py-3 pl-10 pr-10 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-tkd-blue focus:border-tkd-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white transition-colors duration-200 shadow-sm"
              placeholder="Contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                type="button"
                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                className="text-gray-400 hover:text-tkd-blue dark:hover:text-white transition-colors duration-200"
              >
                {mostrarContrasena ? <IconoOjoCerrado className="w-5 h-5"/> : <IconoOjoAbierto className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {error && <p className="text-sm text-center text-tkd-red">{error}</p>}

          <div>
            <button
              type="submit"
              className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white border border-transparent rounded-md group bg-tkd-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tkd-red transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 space-x-2"
            >
              <IconoLogin className="w-5 h-5" />
              <span>Ingresar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;