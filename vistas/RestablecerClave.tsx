// vistas/RestablecerClave.tsx
// Fix UX de restablecimiento de clave (2026-07-15): página PROPIA (en el dominio de la app,
// con el diseño de la marca) para completar el reset iniciado por sendPasswordReset (Cloud
// Function). Reemplaza la página genérica de Firebase (tudojang.firebaseapp.com/__/auth/action)
// a la que redirigía sendPasswordResetEmail() del SDK cliente. Fix consistencia UX (2026-07-15,
// pedido explícito): reutiliza el MISMO shell + lenguaje visual que Login.tsx (AuthCardShell),
// aplicable a cualquier rol (Tutor, Estudiante, Maestro, Asistente).
import React, { useEffect, useMemo, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoLogin } from '../components/Iconos';
import AuthCardShell from '../components/AuthCardShell';

const passwordMinLength = 8;

const VistaRestablecerClave: React.FC = () => {
  const [searchParams] = ReactRouterDOM.useSearchParams();
  const navigate = ReactRouterDOM.useNavigate();
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [estado, setEstado] = useState<'verificando' | 'listo' | 'loading' | 'success' | 'error'>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [emailDestino, setEmailDestino] = useState('');

  const oobCode = searchParams.get('oobCode') || '';

  useEffect(() => {
    if (!oobCode) {
      setEstado('error');
      setMensaje('El enlace de restablecimiento está incompleto. Solicita uno nuevo desde "¿Olvidaste tu acceso?" en el login.');
      return;
    }
    verifyPasswordResetCode(getAuth(), oobCode)
      .then((email) => {
        setEmailDestino(email);
        setEstado('listo');
      })
      .catch(() => {
        setEstado('error');
        setMensaje('Este enlace ya fue usado o venció. Solicita uno nuevo desde "¿Olvidaste tu acceso?" en el login.');
      });
  }, [oobCode]);

  const errorFormulario = useMemo(() => {
    if (password && password.length < passwordMinLength) return 'La contraseña debe tener al menos 8 caracteres.';
    if (confirmacion && password !== confirmacion) return 'Las contraseñas no coinciden.';
    return '';
  }, [confirmacion, password]);

  const puedeEnviar = estado === 'listo'
    && password.length >= passwordMinLength
    && password === confirmacion;

  useEffect(() => {
    if (estado !== 'success') return;
    const t = setTimeout(() => navigate('/login', { replace: true }), 1800);
    return () => clearTimeout(t);
  }, [estado, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeEnviar) return;

    setEstado('loading');
    setMensaje('');
    try {
      await confirmPasswordReset(getAuth(), oobCode, password);
      setEstado('success');
      setMensaje('Contraseña actualizada. Redirigiendo al inicio de sesión...');
    } catch (error) {
      setEstado('error');
      setMensaje(error instanceof Error ? error.message : 'No fue posible cambiar la contraseña.');
    }
  };

  const inputClase = 'w-full py-2.5 sm:py-3 pl-10 pr-10 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white';
  const OjoBtn = (
    <button
      type="button"
      onClick={() => setVerClave((v) => !v)}
      aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tkd-blue"
    >
      {verClave ? <IconoOjoCerrado className="w-4 h-4 sm:w-5 sm:h-5" /> : <IconoOjoAbierto className="w-4 h-4 sm:w-5 sm:h-5" />}
    </button>
  );

  return (
    <AuthCardShell>
      <div className="text-center -mt-2 space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tkd-red">Restablecer clave</p>
        <p className="text-xs font-bold text-gray-500">
          {estado === 'verificando' && 'Verificando el enlace...'}
          {estado === 'listo' && `Definí una contraseña nueva para ${emailDestino}.`}
          {(estado === 'loading' || estado === 'success') && `Cuenta: ${emailDestino}`}
        </p>
      </div>

      {estado === 'error' ? (
        <div role="status" className="p-2 sm:p-3 bg-red-50 text-red-600 rounded-xl text-[10px] sm:text-xs font-bold text-center border border-red-100 uppercase">
          {mensaje}
        </div>
      ) : (
        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">
              Contraseña nueva
            </label>
            <div className="relative">
              <IconoCandado className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
              <input
                id="password"
                type={verClave ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={estado === 'verificando' || estado === 'success'}
                className={inputClase}
                placeholder="Mínimo 8 caracteres"
              />
              {OjoBtn}
            </div>
          </div>

          <div>
            <label htmlFor="confirmacion" className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">
              Confirmar contraseña
            </label>
            <div className="relative">
              <IconoCandado className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
              <input
                id="confirmacion"
                type={verClave ? 'text' : 'password'}
                value={confirmacion}
                onChange={(event) => setConfirmacion(event.target.value)}
                autoComplete="new-password"
                disabled={estado === 'verificando' || estado === 'success'}
                className={inputClase}
                placeholder="Repite la contraseña"
              />
              {OjoBtn}
            </div>
          </div>

          {(errorFormulario || mensaje) && (
            <div
              role="status"
              className={`p-2 sm:p-3 rounded-xl text-[10px] sm:text-xs font-bold text-center border uppercase ${
                estado === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
              }`}
            >
              {mensaje || errorFormulario}
            </div>
          )}

          {/* Fix 2026-07-21 (`npm run typecheck`, TS2367): del `disabled` se quitaron
              `|| estado === 'loading' || estado === 'success'`. Eran REDUNDANTES, no un bug:
              `puedeEnviar` (linea 51) ya exige `estado === 'listo'`, asi que en
              'loading'/'success' el boton ya quedaba deshabilitado por la primera condicion.
              TypeScript las marcaba como comparaciones imposibles por narrowing de alias
              sobre `!puedeEnviar ||`. Comportamiento sin cambios. */}
          <button
            type="submit"
            disabled={!puedeEnviar}
            className="w-full py-3.5 sm:py-4 bg-tkd-red text-white rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl hover:bg-red-700 active:scale-95 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            <IconoLogin className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{estado === 'loading' ? 'Guardando...' : estado === 'success' ? 'Redirigiendo...' : 'Aceptar'}</span>
          </button>
        </form>
      )}

      <p className="text-[9px] font-bold text-gray-400 text-center pt-2">
        Este enlace es personal, temporal y de un solo uso. No compartas tu contraseña por ningún canal.
      </p>
    </AuthCardShell>
  );
};

export default VistaRestablecerClave;
