import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion, TipoToast } from '../../context/NotificacionContext';
import { useEstudiantes } from '../../context/DataContext';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  InvitacionUsuario
} from '../../servicios/academico/invitacionService';
import { enviarCorreoRecuperacion } from '../../servicios/usuariosApi';
import { vincularTutorAEstudiantes, desvincularTutorDeEstudiante } from '../../servicios/estudiantesApi';
import { RolAcademico } from '../../models/academico';
import type { Estudiante } from '../../tipos';

type Tutor = NonNullable<Estudiante['tutor']>;

interface EstudianteResumen {
  id: string;
  nombres: string;
  apellidos: string;
}

interface GrupoTutor {
  correo: string;
  tutor: Tutor;
  estudiantes: EstudianteResumen[];
}

interface FilaTutor {
  email: string;
  invitacion: InvitacionUsuario | null;
  grupo: GrupoTutor | null;
}

// Devuelve las clases del badge de estado (verde=aceptada, amarillo=pendiente,
// rojo=vencida, gris=otro/sin invitación). Compartida entre filas Estudiante y Tutor.
const clasesBadgeEstado = (estado: InvitacionUsuario['estado']) => {
  const base = 'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider';
  if (estado === 'aceptada') return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`;
  if (estado === 'pendiente') return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`;
  if (estado === 'vencida') return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
  return `${base} bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400`;
};

interface FilaVinculacionTutorProps {
  email: string;
  grupo: GrupoTutor | null;
  estudiantes: Estudiante[];
  cargarEstudiantes: () => Promise<void>;
  mostrarNotificacion: (mensaje: string, tipo?: TipoToast) => void;
}

// Fila expandible bajo cada tutor de la tabla de invitaciones (merge 2026-07-30 de
// VincularTutorView.tsx dentro de InvitacionesView.tsx): reutiliza la misma lógica de
// búsqueda/checklist que tenía VincularTutorView, pero además permite construir la
// identidad del tutor desde cero cuando todavía no tiene ningún estudiante vinculado
// (caso: tutor conocido solo por invitación, nunca se guardó su `tutor` completo).
const FilaVinculacionTutor: React.FC<FilaVinculacionTutorProps> = ({
  email,
  grupo,
  estudiantes,
  cargarEstudiantes,
  mostrarNotificacion
}) => {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [idsSeleccionados, setIdsSeleccionados] = useState<string[]>([]);
  const [identidad, setIdentidad] = useState({ nombres: '', apellidos: '', numeroIdentificacion: '', telefono: '' });
  const [vinculando, setVinculando] = useState(false);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);

  const tieneVinculados = !!grupo && grupo.estudiantes.length > 0;

  const estudiantesDisponibles = useMemo(() => {
    return estudiantes.filter((e) => {
      const correoActual = e.tutor?.correo?.trim().toLowerCase();
      if (correoActual === email) return false;
      if (busqueda === '') return true;
      const nombreCompleto = `${e.nombres} ${e.apellidos}`.toLowerCase();
      return nombreCompleto.includes(busqueda.toLowerCase()) || e.numeroIdentificacion.includes(busqueda);
    });
  }, [estudiantes, email, busqueda]);

  const toggleSeleccionado = (id: string) => {
    setIdsSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const identidadCompleta =
    identidad.nombres.trim() !== '' &&
    identidad.apellidos.trim() !== '' &&
    identidad.numeroIdentificacion.trim() !== '' &&
    identidad.telefono.trim() !== '';

  const puedeVincular = idsSeleccionados.length > 0 && (tieneVinculados || identidadCompleta) && !vinculando;

  const handleVincular = async () => {
    if (!puedeVincular) return;
    setVinculando(true);
    try {
      const tutor: Tutor =
        tieneVinculados && grupo
          ? grupo.tutor
          : {
              nombres: identidad.nombres.trim(),
              apellidos: identidad.apellidos.trim(),
              numeroIdentificacion: identidad.numeroIdentificacion.trim(),
              telefono: identidad.telefono.trim(),
              correo: email
            };
      await vincularTutorAEstudiantes(idsSeleccionados, tutor);
      mostrarNotificacion(`¡Tutor vinculado a ${idsSeleccionados.length} estudiante(s) con éxito!`, 'success');
      setIdsSeleccionados([]);
      setIdentidad({ nombres: '', apellidos: '', numeroIdentificacion: '', telefono: '' });
      setBusqueda('');
      setAbierto(false);
      await cargarEstudiantes();
    } catch (error: any) {
      mostrarNotificacion('Error al vincular tutor: ' + error.message, 'error');
    } finally {
      setVinculando(false);
    }
  };

  const handleQuitar = async (estudianteId: string) => {
    setQuitandoId(estudianteId);
    try {
      await desvincularTutorDeEstudiante(estudianteId);
      mostrarNotificacion('¡Tutor desvinculado con éxito!', 'success');
      await cargarEstudiantes();
    } catch (error: any) {
      mostrarNotificacion('Error al desvincular tutor: ' + error.message, 'error');
    } finally {
      setQuitandoId(null);
    }
  };

  return (
    <tr className="border-b border-gray-50 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.02]">
      <td colSpan={5} className="py-4 px-3 space-y-3">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estudiantes vinculados:</p>
          {!grupo || grupo.estudiantes.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin estudiantes vinculados todavía</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {grupo.estudiantes.map((est) => (
                <span
                  key={est.id}
                  className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-full pl-3 pr-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-200"
                >
                  {est.nombres} {est.apellidos}
                  <button
                    type="button"
                    onClick={() => handleQuitar(est.id)}
                    disabled={quitandoId === est.id}
                    aria-label={`Quitar ${est.nombres} ${est.apellidos}`}
                    className="text-gray-400 hover:text-tkd-red font-black transition-colors disabled:opacity-50"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAbierto((prev) => !prev)}
          className="text-tkd-blue hover:text-tkd-red font-black text-[10px] uppercase tracking-widest transition-colors"
        >
          {abierto ? 'Cerrar formulario' : '+ Agregar estudiante'}
        </button>

        {abierto && (
          <div className="space-y-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 rounded-2xl p-4 animate-fade-in">
            {!tieneVinculados && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombres"
                  aria-label={`Nombres del tutor ${email}`}
                  value={identidad.nombres}
                  onChange={(e) => setIdentidad((prev) => ({ ...prev, nombres: e.target.value }))}
                  disabled={vinculando}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
                />
                <input
                  type="text"
                  placeholder="Apellidos"
                  aria-label={`Apellidos del tutor ${email}`}
                  value={identidad.apellidos}
                  onChange={(e) => setIdentidad((prev) => ({ ...prev, apellidos: e.target.value }))}
                  disabled={vinculando}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
                />
                <input
                  type="text"
                  placeholder="N° Identificación"
                  aria-label={`Número de identificación del tutor ${email}`}
                  value={identidad.numeroIdentificacion}
                  onChange={(e) => setIdentidad((prev) => ({ ...prev, numeroIdentificacion: e.target.value }))}
                  disabled={vinculando}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
                />
                <input
                  type="text"
                  placeholder="Teléfono"
                  aria-label={`Teléfono del tutor ${email}`}
                  value={identidad.telefono}
                  onChange={(e) => setIdentidad((prev) => ({ ...prev, telefono: e.target.value }))}
                  disabled={vinculando}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
                />
              </div>
            )}

            <input
              type="text"
              placeholder="Nombre o identificación..."
              aria-label={`Buscar estudiante para vincular a ${email}`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              disabled={vinculando}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue disabled:opacity-50"
            />

            <div
              data-testid={`checklist-vincular-tutor-${email}`}
              className="max-h-56 overflow-y-auto border border-gray-100 dark:border-white/10 rounded-2xl divide-y divide-gray-100 dark:divide-white/5"
            >
              {estudiantesDisponibles.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-400">No hay estudiantes disponibles para vincular.</div>
              ) : (
                estudiantesDisponibles.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={idsSeleccionados.includes(e.id)}
                      onChange={() => toggleSeleccionado(e.id)}
                      disabled={vinculando}
                      className="w-4 h-4 accent-tkd-blue"
                    />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {e.nombres} {e.apellidos}
                    </span>
                    <span className="text-xs text-gray-400">{e.numeroIdentificacion}</span>
                  </label>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleVincular}
              disabled={!puedeVincular}
              className="bg-tkd-dark hover:bg-tkd-blue text-white py-2 px-5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              {vinculando ? 'Vinculando...' : `Vincular a ${idsSeleccionados.length} estudiante(s)`}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

const InvitacionesView: React.FC = () => {
  const { usuario } = useAuth();
  const { mostrarNotificacion } = useNotificacion();
  const { estudiantes, cargarEstudiantes } = useEstudiantes();

  const [invitaciones, setInvitaciones] = useState<InvitacionUsuario[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolAcademico>('Estudiante');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [invitandoEmail, setInvitandoEmail] = useState<string | null>(null);

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

  // Una fila por correo (la mas reciente): reenviar una invitacion de Estudiante deja el
  // mismo rastro que la de Tutor -- vieja `revocada` + nueva `pendiente` en `invitaciones`.
  // `listInvitations` ya entrega el arreglo ordenado por creadoEn desc, asi que quedarse con
  // la primera aparicion de cada correo es quedarse con la mas reciente.
  const invitacionesEstudiante = useMemo(() => {
    const correosVistos = new Set<string>();
    return invitaciones.filter((i) => {
      if (i.rol !== 'Estudiante') return false;
      const correo = i.email.trim().toLowerCase();
      if (correosVistos.has(correo)) return false;
      correosVistos.add(correo);
      return true;
    });
  }, [invitaciones]);

  const invitacionesTutor = useMemo(
    () => invitaciones.filter((i) => i.rol === 'Tutor'),
    [invitaciones]
  );

  // Misma lógica de agrupación que tenía VincularTutorView.tsx: un grupo por
  // Estudiante.tutor.correo, con el objeto `tutor` completo + los estudiantes vinculados.
  const gruposTutor = useMemo<GrupoTutor[]>(() => {
    const grupos = new Map<string, GrupoTutor>();
    estudiantes.forEach((e) => {
      const correo = e.tutor?.correo?.trim().toLowerCase();
      if (!correo) return;
      const resumen: EstudianteResumen = { id: e.id, nombres: e.nombres, apellidos: e.apellidos };
      const existente = grupos.get(correo);
      if (existente) {
        existente.estudiantes.push(resumen);
      } else {
        grupos.set(correo, { correo, tutor: e.tutor as Tutor, estudiantes: [resumen] });
      }
    });
    return Array.from(grupos.values());
  }, [estudiantes]);

  // Unión de (a) correos distintos de invitaciones rol Tutor y (b) correos distintos de
  // tutor.correo en estudiantes -- una fila por correo único, con la invitación real (si
  // existe) y el grupo de estudiantes vinculados (si existe).
  const filasTutor = useMemo<FilaTutor[]>(() => {
    const correos = new Set<string>();
    invitacionesTutor.forEach((inv) => correos.add(inv.email.trim().toLowerCase()));
    gruposTutor.forEach((g) => correos.add(g.correo));

    return Array.from(correos)
      .sort()
      .map((correo) => ({
        email: correo,
        invitacion: invitacionesTutor.find((inv) => inv.email.trim().toLowerCase() === correo) || null,
        grupo: gruposTutor.find((g) => g.correo === correo) || null
      }));
  }, [invitacionesTutor, gruposTutor]);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      mostrarNotificacion('Ingresa un correo electrónico válido.', 'info');
      return;
    }

    setEnviando(true);
    try {
      await createInvitation(tenantId, email, rol);
      mostrarNotificacion('Invitación creada y enviada con éxito.', 'success');
      setEmail('');
      cargarInvitaciones();
    } catch (error: any) {
      mostrarNotificacion('Error al enviar invitación: ' + error.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const handleInvitarTutor = async (correoTutor: string, nombreDestinatario: string) => {
    setInvitandoEmail(correoTutor);
    try {
      await createInvitation(tenantId, correoTutor, 'Tutor', { nombreDestinatario });
      mostrarNotificacion('Invitación creada y enviada con éxito.', 'success');
      await cargarInvitaciones();
    } catch (error: any) {
      mostrarNotificacion('Error al enviar invitación: ' + error.message, 'error');
    } finally {
      setInvitandoEmail(null);
    }
  };

  const handleReenviar = async (id: string, email: string) => {
    try {
      const resultado = await resendInvitation(tenantId, id);
      if (resultado.emailEnviado) {
        mostrarNotificacion('Invitación reenviada por correo con éxito.', 'success');
      } else if (resultado.activationLink) {
        // El correo no salió, pero la invitación nueva quedó creada y válida. Copiamos el
        // enlace para que el admin lo comparta manualmente (WhatsApp, etc.) sin depender del
        // correo -- misma mitigación que "Copiar enlace" en la tabla.
        try {
          await navigator.clipboard.writeText(resultado.activationLink);
          mostrarNotificacion('El correo no salió, pero el enlace de activación se copió al portapapeles.', 'info');
        } catch {
          mostrarNotificacion('El correo no salió. Usa "Copiar enlace" en la fila para compartirlo manualmente.', 'info');
        }
      } else {
        mostrarNotificacion('Invitación reenviada, pero no se pudo confirmar el envío del correo.', 'info');
      }
      cargarInvitaciones();
    } catch (error: any) {
      // Mitigación de login (2026-07-15): "Ya existe un usuario con el email X" significa que
      // esta persona YA activó su cuenta (o se creó por otro medio). Reenviar la invitación
      // NUNCA va a funcionar en ese caso -- lo correcto es restablecer su contraseña, no crear
      // una cuenta nueva. En vez de dejar al admin con un error confuso, disparamos el reset
      // de contraseña automáticamente (mismo mecanismo nativo de Firebase que "¿Olvidaste tu
      // acceso?" en el Login) y se lo explicamos.
      if (typeof error?.message === 'string' && error.message.includes('Ya existe un usuario')) {
        try {
          await enviarCorreoRecuperacion(email);
          mostrarNotificacion(
            `${email} ya tiene una cuenta activa. Le enviamos un correo para restablecer su contraseña en su lugar.`,
            'info'
          );
        } catch (resetError: any) {
          mostrarNotificacion('No se pudo enviar el correo de restablecimiento: ' + resetError.message, 'error');
        }
        return;
      }
      mostrarNotificacion('Error al reenviar invitación: ' + error.message, 'error');
    }
  };

  const handleCopiarEnlace = async (activationLink?: string) => {
    if (!activationLink) {
      mostrarNotificacion('Esta invitación no tiene enlace de activación disponible.', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(activationLink);
      mostrarNotificacion('Enlace de activación copiado.', 'success');
    } catch {
      mostrarNotificacion('No fue posible copiar el enlace. Usa el correo enviado.', 'error');
    }
  };

  const sinFilas = invitacionesEstudiante.length === 0 && filasTutor.length === 0;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-gray-100 dark:border-white/5 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
          Cuentas Externas
        </h2>
        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
          Envía invitaciones oficiales para que alumnos y tutores creen su login externo. Para tutores, además
          podés vincular sus estudiantes desde la misma fila.
        </p>
      </div>

      <form onSubmit={handleInvitar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
        <div className="space-y-1">
          <label htmlFor="invite-email" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Correo electrónico
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="estudiante@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="invite-rol" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Rol académico
          </label>
          <select
            id="invite-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as RolAcademico)}
            disabled={enviando}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-tkd-blue"
          >
            <option value="Estudiante">Estudiante</option>
            <option value="Tutor">Tutor / acudiente</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="bg-tkd-dark hover:bg-tkd-blue text-white py-3 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar invitación'}
        </button>
      </form>

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
            ) : sinFilas ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                  No hay invitaciones enviadas.
                </td>
              </tr>
            ) : (
              <>
                {invitacionesEstudiante.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5">
                    <td className="py-3 text-sm text-gray-900 dark:text-white font-medium">{inv.email}</td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">{inv.rol}</td>
                    <td className="py-3">
                      <span className={clasesBadgeEstado(inv.estado)}>{inv.estado}</span>
                    </td>
                    <td className="py-3 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(inv.expiraEn).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      {(inv.estado === 'pendiente' || inv.estado === 'vencida') && (
                        <div className="flex justify-end gap-3">
                          {inv.activationLink && (
                            <button
                              type="button"
                              onClick={() => handleCopiarEnlace(inv.activationLink)}
                              className="text-gray-500 hover:text-tkd-blue font-bold text-xs uppercase tracking-wider transition-colors"
                            >
                              Copiar enlace
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleReenviar(inv.id, inv.email)}
                            className="text-tkd-blue hover:text-tkd-red font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Reenviar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {filasTutor.map((fila) => (
                  <React.Fragment key={fila.email}>
                    <tr className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <td className="py-3 text-sm text-gray-900 dark:text-white font-medium">{fila.email}</td>
                      <td className="py-3 text-sm text-gray-500 dark:text-gray-400">Tutor</td>
                      <td className="py-3">
                        {fila.invitacion ? (
                          <span className={clasesBadgeEstado(fila.invitacion.estado)}>{fila.invitacion.estado}</span>
                        ) : (
                          <span className={clasesBadgeEstado('revocada')}>Sin invitación</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-gray-500 dark:text-gray-400">
                        {fila.invitacion ? new Date(fila.invitacion.expiraEn).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-right">
                        {fila.invitacion ? (
                          (fila.invitacion.estado === 'pendiente' || fila.invitacion.estado === 'vencida') && (
                            <div className="flex justify-end gap-3">
                              {fila.invitacion.activationLink && (
                                <button
                                  type="button"
                                  onClick={() => handleCopiarEnlace(fila.invitacion!.activationLink)}
                                  className="text-gray-500 hover:text-tkd-blue font-bold text-xs uppercase tracking-wider transition-colors"
                                >
                                  Copiar enlace
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleReenviar(fila.invitacion!.id, fila.invitacion!.email)}
                                className="text-tkd-blue hover:text-tkd-red font-bold text-xs uppercase tracking-wider transition-colors"
                              >
                                Reenviar
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInvitarTutor(fila.email, fila.grupo?.tutor.nombres || '')}
                            disabled={invitandoEmail === fila.email}
                            className="text-tkd-blue hover:text-tkd-red font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                          >
                            {invitandoEmail === fila.email ? 'Invitando...' : 'Invitar'}
                          </button>
                        )}
                      </td>
                    </tr>
                    <FilaVinculacionTutor
                      email={fila.email}
                      grupo={fila.grupo}
                      estudiantes={estudiantes}
                      cargarEstudiantes={cargarEstudiantes}
                      mostrarNotificacion={mostrarNotificacion}
                    />
                  </React.Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvitacionesView;
