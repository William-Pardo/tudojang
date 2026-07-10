import React, { useMemo, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { acceptInvitation } from '../servicios/academico/invitacionService';

const passwordMinLength = 8;

const VistaActivarCuenta: React.FC = () => {
  const [searchParams] = ReactRouterDOM.useSearchParams();
  const navigate = ReactRouterDOM.useNavigate();
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
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
    && estado !== 'loading';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeEnviar) return;

    setEstado('loading');
    setMensaje('');
    try {
      await acceptInvitation(tenantId, invitacionId, token, password);
      setEstado('success');
      setMensaje('Cuenta activada correctamente. Ya puedes iniciar sesión.');
    } catch (error) {
      setEstado('error');
      setMensaje(error instanceof Error ? error.message : 'No fue posible activar la cuenta.');
    }
  };

  return (
    <main className="min-h-screen bg-tkd-blue flex items-center justify-center p-6">
      <section className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 space-y-8">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Acceso académico</p>
          <h1 className="text-3xl md:text-4xl font-black uppercase text-tkd-dark">Crear login</h1>
          <p className="text-sm font-bold text-gray-500">
            Define una contraseña segura para activar tu cuenta de estudiante o tutor en Tudojang.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-bold outline-none focus:border-tkd-blue"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmacion" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Confirmar contraseña
            </label>
            <input
              id="confirmacion"
              type="password"
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-bold outline-none focus:border-tkd-blue"
              placeholder="Repite la contraseña"
            />
          </div>

          {(errorFormulario || mensaje) && (
            <div
              role="status"
              className={`rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider ${
                estado === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-tkd-red'
              }`}
            >
              {mensaje || errorFormulario}
            </div>
          )}

          <button
            type="submit"
            disabled={!puedeEnviar}
            className="w-full rounded-2xl bg-tkd-dark px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-tkd-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            {estado === 'loading' ? 'Activando...' : 'Activar cuenta'}
          </button>

          {estado === 'success' && (
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded-2xl border border-tkd-blue px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-tkd-blue"
            >
              Ir al login
            </button>
          )}
        </form>

        <p className="text-[11px] font-bold text-gray-400">
          Este enlace es personal, temporal y de un solo uso. No compartas tu contraseña por ningún canal.
        </p>
      </section>
    </main>
  );
};

export default VistaActivarCuenta;
