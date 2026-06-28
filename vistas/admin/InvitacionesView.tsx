import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  InvitacionUsuario
} from '../../servicios/academico/invitacionService';
import { RolAcademico } from '../../models/academico';

const InvitacionesView: React.FC = () => {
  const { usuario } = useAuth();
  const { mostrarNotificacion } = useNotificacion();
  
  const [invitaciones, setInvitaciones] = useState<InvitacionUsuario[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolAcademico>('Estudiante');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const tenantId = usuario?.tenantId || 'mock-tenant';

  const cargarInvitaciones = async () => {
    setCargando(true);
    try {
      const data = await listInvitations(tenantId);
      setInvitaciones(data);
    } catch (error: any) {
      mostrarNotificacion('Error al cargar invitaciones: ' + error.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInvitaciones();
  }, [tenantId]);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      mostrarNotificacion('Por favor ingresa un correo electrónico válido', 'info');
      return;
    }

    setEnviando(true);
    try {
      await createInvitation(tenantId, email, rol);
      mostrarNotificacion('¡Invitación creada y enviada con éxito!', 'success');
      setEmail('');
      cargarInvitaciones();
    } catch (error: any) {
      mostrarNotificacion('Error al enviar invitación: ' + error.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const handleReenviar = async (id: string) => {
    try {
      await resendInvitation(tenantId, id);
      mostrarNotificacion('¡Invitación reenviada con éxito!', 'success');
      cargarInvitaciones();
    } catch (error: any) {
      mostrarNotificacion('Error al reenviar invitación: ' + error.message, 'error');
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-gray-100 dark:border-white/5 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
          Invitaciones Académicas
        </h2>
        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
          Invita a Estudiantes y Tutores al módulo académico
        </p>
      </div>

      {/* Formulario de Invitación */}
      <form onSubmit={handleInvitar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
        <div className="space-y-1">
          <label htmlFor="invite-email" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Correo Electrónico
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="invite-rol" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Rol Académico
          </label>
          <select
            id="invite-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as RolAcademico)}
            disabled={enviando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          >
            <option value="Estudiante">Estudiante</option>
            <option value="Tutor">Tutor (Padre/Acudiente)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="bg-tkd-dark hover:bg-tkd-blue text-white py-3 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar Invitación'}
        </button>
      </form>

      {/* Listado de Invitaciones */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5">
              <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Email</th>
              <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Rol</th>
              <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
              <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Expira</th>
              <th className="py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                  Cargando invitaciones...
                </td>
              </tr>
            ) : invitaciones.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                  No hay invitaciones enviadas.
                </td>
              </tr>
            ) : (
              invitaciones.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5">
                  <td className="py-3 text-sm text-gray-900 dark:text-white font-medium">{inv.email}</td>
                  <td className="py-3 text-sm text-gray-500 dark:text-gray-400">{inv.rol}</td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.estado === 'aceptada'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : inv.estado === 'pendiente'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : inv.estado === 'vencida'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}
                    >
                      {inv.estado}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(inv.expiraEn).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    {(inv.estado === 'pendiente' || inv.estado === 'vencida') && (
                      <button
                        onClick={() => handleReenviar(inv.id)}
                        className="text-tkd-blue hover:text-tkd-red font-bold text-xs uppercase tracking-wider transition-colors"
                      >
                        Reenviar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvitacionesView;
