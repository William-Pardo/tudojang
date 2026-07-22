import React, { useEffect, useMemo, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { acceptInvitation } from '../servicios/academico/invitacionService';
import { IconoCandado, IconoOjoAbierto, IconoOjoCerrado, IconoLogin } from '../components/Iconos';
import AuthCardShell from '../components/AuthCardShell';

const passwordMinLength = 8;

const VistaActivarCuenta: React.FC = () => {
  const [searchParams] = ReactRouterDOM.useSearchParams();
  const navigate = ReactRouterDOM.useNavigate();
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');

  const tenantId = searchParams.get('tenantId') || '';
  const invitacionId = searchParams.get('invitacionId') || searchParams.get('invitationId') || '';
  const token = searchParams.get('token') || '';

  const enlaceCompleto = Boolean(tenantId && invitacionId && token);

  const errorFormulario = useMemo(() => {
    if (!enlaceCompleto) return 'El enlace de activación está incompleto. Solicita una nueva invitación al administrador.';
    if (password && password.length < passwordMinLength) return 'La contraseña debe tener al menos 8 caracteres.';
    if (confirmacion && password !== confirmacion) return 'Las contraseñas no coinciden.';
    return '';
  }, [confirmacion, enlaceCompleto, password]);

  const puedeEnviar = enlaceCompleto
    && password.length >= passwordMinLength
    && password === confirmacion
    && estado !== 'loading'
    && estado !== 'success';

  // Fix tutor-role-end-to-end (2026-07-14): al activar con éxito, redirigir SOLO al login
  // automáticamente (sin un segundo botón "Ir al login" que confundía y no respondía).
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
      await acceptInvitation(tenantId, invitacionId, token, password);
      setEstado('success');
      setMensaje('Cuenta activada. Redirigiendo al inicio de sesión...');
    } catch (error) {
      setEstado('error');
      setMensaje(error instanceof Error ? error.message : 'No fue posible activar la cuenta.');
    }
  };

  // Fix consistencia UX de autenticación (2026-07-15): mismos estilos de input/botón que
  // Login.tsx (reutiliza el mismo lenguaje visual, no solo el mismo shell).
  const inputClase = (conError: boolean) =>
    `w-full py-2.5 sm:py-3 pl-10 pr-10 rounded-xl border-2 transition-all outline-none font-bold text-sm sm:text-base ${
      conError ? 'border-red-500' : 'border-gray-100 focus:border-tkd-blue dark:bg-gray-800 dark:border-gray-700 dark:text-white'
    }`;
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tkd-red">Acceso académico</p>
        <p className="text-xs font-bold text-gray-500">
          Definí tu contraseña para activar tu cuenta en Tudojang.
        </p>
      </div>

      <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">
            Contraseña
          </label>
          <div className="relative">
            <IconoCandado className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-tkd-blue" />
            <input
              id="password"
              type={verClave ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={estado === 'success'}
              className={inputClase(false)}
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
              disabled={estado === 'success'}
              className={inputClase(false)}
              placeholder="Repite la contraseña"
            />
            {OjoBtn}
          </div>
        </div>

        {(errorFormulario || mensaje) && (
          <div
            role="status"
            className={`p-2 sm:p-3 rounded-xl text-[10px] sm:text-xs font-bold text-center border uppercase ${
              estado === 'success'
                ? 'bg-green-50 text-green-700 border-green-100'
                : 'bg-red-50 text-red-600 border-red-100'
            }`}
          >
            {mensaje || errorFormulario}
          </div>
        )}

        <button
          type="submit"
          disabled={!puedeEnviar}
          className="w-full py-3.5 sm:py-4 bg-tkd-red text-white rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl hover:bg-red-700 active:scale-95 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
        >
          <IconoLogin className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{estado === 'loading' ? 'Activando...' : estado === 'success' ? 'Redirigiendo...' : 'Aceptar'}</span>
        </button>
      </form>

      <p className="text-[9px] font-bold text-gray-400 text-center pt-2">
        Este enlace es personal, temporal y de un solo uso. No compartas tu contraseña por ningún canal.
      </p>
    </AuthCardShell>
  );
};

export default VistaActivarCuenta;
