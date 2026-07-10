import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import { RolUsuario } from '../../tipos';
import {
  jornadaRepository,
  mensajeConflictoHorario,
  ConflictoConcurrenciaError,
  diffCambiosJornada,
  MENSAJE_ADVERTENCIA_AUDITORIA,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import {
  confirmarJornada,
  iniciarJornada,
  cerrarJornada,
  marcarPendienteCierre,
  cancelarJornada,
  reprogramarJornada,
} from '../../servicios/academico/jornadaService';
import { IconoCalendario, IconoReloj } from '../../components/Iconos';

interface MisClasesViewProps {
  tenantId: string;
  programaId: string;
  usuarioId?: string;
  // Subtarea 12.2: true para Admin/SuperAdmin del tenant, que pueden editar cualquier
  // jornada sin ser el maestro asignado. El resto (Editor/Asistente) solo puede editar
  // las jornadas donde figure como instructorId.
  esAdmin?: boolean;
  // Subtarea 12.5: rol de quien esta operando, para la auditoria (seccion 19 del
  // documento de mejora). Esta vista no llama useAuth() directamente (a diferencia de
  // JornadasView) -- recibe usuarioId/esAdmin por prop, asi que el rol tambien se recibe
  // por prop desde quien la embebe (AsignacionesView, con usuario.rol de useAuth()).
  rol?: RolUsuario;
  repository?: JornadaRepository;
  // Fix 4 (persistencia/seleccion de Programa academico): contador que el padre
  // (AsignacionesView) incrementa tras guardar/eliminar un programa para forzar la
  // recarga de jornadas sin remount. Mismo patron refreshTrigger que ya usa
  // AsignacionesView con BibliotecaView para los recursos. Sin esto, si el programaId
  // no cambia (edicion in-place), cargar() jamas volvia a ejecutarse y "Mis clases"
  // quedaba desactualizado hasta navegar afuera y volver.
  refreshTrigger?: number;
}

// Subtarea 12.2 — permiso "maestro asignado". Solo el maestro asignado
// (jornada.instructorId === usuarioId) o un Admin/SuperAdmin (esAdmin) puede
// editar/cancelar/reprogramar una jornada. Esta es la guarda de UI; el backend
// (firestore.rules, match /tenants/{tenantId}/jornadas/{jornadaId}) impone la misma
// regla en `update`, por lo que ocultar el boton no es la unica defensa.
// Subtarea 12.8: exportada (antes privada de este archivo) para que la parrilla semanal
// de Agenda (vistas/admin/AgendaView.tsx) reutilice el MISMO criterio de permiso para
// mostrar/ocultar el icono de edicion, en vez de duplicar la logica en un segundo lugar.
export function puedeEditarJornada(jornada: JornadaInstruccion, usuarioId: string, esAdmin: boolean): boolean {
  return esAdmin || jornada.instructorId === usuarioId;
}

type ClaveAccion = 'confirmar' | 'iniciar' | 'cerrar' | 'cancelar' | 'reprogramar';

interface CambiosReprogramacion {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

// Fase 3.7 (2026-07-07): tarjetas por pagina en la grilla 3x3 de "Mis clases".
const porPagina = 9;

// Fase 3.7 (2026-07-07): convencion de color por estado de jornada — no existia antes en el
// proyecto (confirmado por busqueda: ninguna otra vista mapea EstadoJornada a color). Eleccion:
// borrador=gris (aun sin confirmar) · confirmada/reprogramada=azul (agendada) ·
// en_curso/pendiente_cierre/parcial/pendiente_sustitucion=ambar (requiere atencion) ·
// cerrada=verde (completada) · cancelada=rojo (no se dicto). Record exhaustivo por tipos, aunque
// este flujo (ver transicionar()/cancelarClase()/reprogramarClase() abajo) hoy solo produce
// borrador/confirmada/en_curso/cerrada/cancelada.
const ESTILO_POR_ESTADO: Record<JornadaInstruccion['estado'], { bg: string; text: string; etiqueta: string }> = {
  borrador: { bg: 'bg-gray-100 dark:bg-white/10', text: 'text-gray-500 dark:text-gray-300', etiqueta: 'Borrador' },
  pendiente_confirmacion: { bg: 'bg-gray-100 dark:bg-white/10', text: 'text-gray-500 dark:text-gray-300', etiqueta: 'Pendiente de confirmacion' },
  confirmada: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-tkd-blue', etiqueta: 'Confirmada' },
  en_curso: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', etiqueta: 'En curso' },
  pendiente_cierre: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', etiqueta: 'Pendiente de cierre' },
  cerrada: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', etiqueta: 'Cerrada' },
  cancelada: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-tkd-red', etiqueta: 'Cancelada' },
  reprogramada: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-tkd-blue', etiqueta: 'Reprogramada' },
  parcial: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', etiqueta: 'Parcial' },
  pendiente_sustitucion: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', etiqueta: 'Pendiente de sustitucion' },
};

function accionesDisponibles(estado: JornadaInstruccion['estado']): { clave: ClaveAccion; etiqueta: string }[] {
  switch (estado) {
    case 'borrador':
      return [{ clave: 'confirmar', etiqueta: 'Confirmar' }];
    case 'confirmada':
      return [
        { clave: 'iniciar', etiqueta: 'Iniciar' },
        { clave: 'reprogramar', etiqueta: 'Reprogramar' },
        { clave: 'cancelar', etiqueta: 'Cancelar' },
      ];
    case 'en_curso':
      return [
        { clave: 'cerrar', etiqueta: 'Cerrar' },
        { clave: 'cancelar', etiqueta: 'Cancelar' },
      ];
    default:
      return [];
  }
}

function esFechaHoraPasada(fecha: string, horaFin: string): boolean {
  const ahora = new Date();
  const hoyIso = ahora.toISOString().slice(0, 10);
  if (fecha < hoyIso) return true;
  if (fecha > hoyIso) return false;
  const horaActual = ahora.toTimeString().slice(0, 5); // "HH:MM"
  return horaFin < horaActual;
}

const MisClasesView: React.FC<MisClasesViewProps> = ({
  tenantId,
  programaId,
  usuarioId = 'maestro-local',
  esAdmin = false,
  // Subtarea 12.5: mismo fallback que usuarioId ('maestro-local'/Editor) para no romper
  // los call sites/tests existentes que todavia no pasan rol explicitamente.
  rol = RolUsuario.Editor,
  repository = jornadaRepository,
  refreshTrigger = 0,
}) => {
  const [jornadas, setJornadas] = React.useState<JornadaInstruccion[]>([]);
  const [materialPorJornadaId, setMaterialPorJornadaId] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState('');
  // Mismo patron que JornadasView.tsx: una jornada en_curso no se puede cerrar
  // sin registrar antes asistencia y objetivos impartidos (cerrarJornada() los exige).
  const [asistenciaPorJornadaId, setAsistenciaPorJornadaId] = React.useState<Record<string, boolean>>({});
  const [objetivosImpartidosPorJornadaId, setObjetivosImpartidosPorJornadaId] = React.useState<Record<string, boolean>>({});
  // Accion de cancelar/reprogramar expandida en linea, por fila (una a la vez por jornada).
  const [accionExpandidaPorJornadaId, setAccionExpandidaPorJornadaId] = React.useState<Record<string, ClaveAccion | null>>({});
  const [motivoPorJornadaId, setMotivoPorJornadaId] = React.useState<Record<string, string>>({});
  const [cambiosReprogramacionPorJornadaId, setCambiosReprogramacionPorJornadaId] = React.useState<Record<string, CambiosReprogramacion>>({});
  // Fase 3.7: pagina actual de la grilla 3x3 (0-indexada).
  const [paginaActual, setPaginaActual] = React.useState(0);
  // C1: previene doble escritura si el usuario hace clic rapido mientras
  // una operacion async ya esta en vuelo.
  const [guardando, setGuardando] = React.useState(false);

  const cargar = React.useCallback(() => {
    // Las jornadas y las asignaciones (material) se cargan de forma independiente:
    // un fallo en listarAsignacionesPorTenant (p.ej. permisos insuficientes en
    // Firestore real) no debe impedir que las jornadas se pinten, ya que son la
    // fuente principal de esta vista de gestion de clases. El material simplemente
    // degrada a "Sin material asignado" si su carga falla.
    repository.listarJornadasPorTenant(tenantId).then((todasLasJornadas) => {
      const delPrograma = todasLasJornadas
        .filter((jornada) => jornada.programaId === programaId)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      setJornadas(delPrograma);
      // Fase 3.7: cada recarga vuelve a la primera pagina, para que una pagina vieja
      // nunca quede apuntando mas alla del nuevo total de jornadas.
      setPaginaActual(0);

      listarAsignacionesPorTenant(tenantId)
        .then((asignaciones) => {
          const material: Record<string, string[]> = {};
          for (const jornada of delPrograma) {
            material[jornada.id] = asignaciones
              .filter((asignacion) => asignacion.jornadaId === jornada.id)
              .map((asignacion) => asignacion.titulo);
          }
          setMaterialPorJornadaId(material);
        })
        .catch((materialError) => {
          console.warn('[MisClasesView] No se pudo cargar el material asignado', materialError);
        });
    });
  // Fix 4: refreshTrigger en las deps para que un incremento del padre re-dispare
  // cargar() aunque tenantId/programaId/repository no hayan cambiado.
  }, [tenantId, programaId, repository, refreshTrigger]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const transicionar = async (jornada: JornadaInstruccion) => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      let actualizada: JornadaInstruccion;
      if (jornada.estado === 'borrador') {
        const resultadoConflicto = await repository.existeConflictoHorario(jornada);
        if (resultadoConflicto.hayConflicto) {
          setError(mensajeConflictoHorario(resultadoConflicto, jornada));
          return;
        }
        actualizada = confirmarJornada(jornada);
      } else if (jornada.estado === 'confirmada') {
        actualizada = iniciarJornada(jornada);
      } else if (jornada.estado === 'en_curso') {
        const pendiente = marcarPendienteCierre(jornada, {
          asistenciaRegistrada: Boolean(asistenciaPorJornadaId[jornada.id]),
          objetivosImpartidos: objetivosImpartidosPorJornadaId[jornada.id] ? jornada.objetivosPlaneados : [],
        });
        actualizada = cerrarJornada(pendiente);
      } else {
        return;
      }

      // Subtarea 12.4: pasamos el actualizadoEn que teniamos al leer la jornada para que el
      // repositorio rechace el guardado si otro usuario la modifico entremedio.
      await repository.guardarJornada(actualizada, { actualizadoEnEsperado: jornada.actualizadoEn });
      try {
        await repository.registrarAuditoria({
          tenantId,
          jornadaId: actualizada.id,
          usuarioId,
          // Subtarea 12.5: rol de quien hizo el cambio (recibido por prop) y fuente
          // (esta vista es "mis_clases").
          rol,
          fuente: 'mis_clases',
          accion: actualizada.estado === 'confirmada' ? 'confirmar' : actualizada.estado === 'en_curso' ? 'iniciar' : 'cerrar',
          // Subtarea 12.5: diff campo por campo (anterior/nuevo) en vez del estado
          // resultante plano.
          cambios: diffCambiosJornada(jornada, actualizada),
        });
      } catch (auditError) {
        console.warn('[MisClasesView] No se pudo registrar auditoria', auditError);
        // Subtarea 12.5: el guardado principal ya se aplico y no se revierte (no hay
        // transaccion/rollback), pero el fallo de auditoria ya no queda silencioso.
        setError(MENSAJE_ADVERTENCIA_AUDITORIA);
      }

      setJornadas((actuales) => actuales.map((item) => (item.id === actualizada.id ? actualizada : item)));
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la clase.');
    } finally {
      setGuardando(false);
    }
  };

  const cerrarAccionExpandida = (jornadaId: string) => {
    setAccionExpandidaPorJornadaId((actual) => ({ ...actual, [jornadaId]: null }));
  };

  const handleAccionClick = (jornada: JornadaInstruccion, clave: ClaveAccion) => {
    if (clave === 'cancelar' || clave === 'reprogramar') {
      setAccionExpandidaPorJornadaId((actual) => ({
        ...actual,
        [jornada.id]: actual[jornada.id] === clave ? null : clave,
      }));
      return;
    }
    transicionar(jornada);
  };

  const cancelarClase = async (jornada: JornadaInstruccion, motivo: string) => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      const actualizada = cancelarJornada(jornada, motivo);
      await repository.guardarJornada(actualizada, { actualizadoEnEsperado: jornada.actualizadoEn });
      try {
        await repository.registrarAuditoria({
          tenantId,
          jornadaId: actualizada.id,
          usuarioId,
          rol,
          fuente: 'mis_clases',
          accion: 'cancelar',
          cambios: diffCambiosJornada(jornada, actualizada),
        });
      } catch (auditError) {
        console.warn('[MisClasesView] No se pudo registrar auditoria', auditError);
        setError(MENSAJE_ADVERTENCIA_AUDITORIA);
      }

      setJornadas((actuales) => actuales.map((item) => (item.id === actualizada.id ? actualizada : item)));
      cerrarAccionExpandida(jornada.id);
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la clase.');
    } finally {
      setGuardando(false);
    }
  };

  const reprogramarClase = async (jornada: JornadaInstruccion, cambios: CambiosReprogramacion) => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      const candidata: JornadaInstruccion = { ...jornada, ...cambios };
      const resultadoConflicto = await repository.existeConflictoHorario(candidata);
      if (resultadoConflicto.hayConflicto) {
        setError(mensajeConflictoHorario(resultadoConflicto, candidata));
        return;
      }

      const actualizada = reprogramarJornada(jornada, cambios);
      await repository.guardarJornada(actualizada, { actualizadoEnEsperado: jornada.actualizadoEn });
      try {
        await repository.registrarAuditoria({
          tenantId,
          jornadaId: actualizada.id,
          usuarioId,
          rol,
          fuente: 'mis_clases',
          accion: 'actualizar',
          cambios: diffCambiosJornada(jornada, actualizada),
        });
      } catch (auditError) {
        console.warn('[MisClasesView] No se pudo registrar auditoria', auditError);
        setError(MENSAJE_ADVERTENCIA_AUDITORIA);
      }

      setJornadas((actuales) => actuales.map((item) => (item.id === actualizada.id ? actualizada : item)));
      cerrarAccionExpandida(jornada.id);
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo reprogramar la clase.');
    } finally {
      setGuardando(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(jornadas.length / porPagina));
  const jornadasPagina = React.useMemo(() => {
    const inicio = paginaActual * porPagina;
    return jornadas.slice(inicio, inicio + porPagina);
  }, [jornadas, paginaActual]);

  return (
    <section aria-label="Mis clases">
      <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white">Mis clases</h2>

      {error && <p className="mt-2 text-sm font-bold text-tkd-red">{error}</p>}

      {jornadas.length === 0 ? (
        <p className="mt-4 text-sm font-bold text-gray-400">Este programa todavia no tiene clases generadas.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jornadasPagina.map((jornada) => {
              const material = materialPorJornadaId[jornada.id] ?? [];
              const acciones = accionesDisponibles(jornada.estado);
              const accionExpandida = accionExpandidaPorJornadaId[jornada.id] ?? null;
              const cambiosReprogramacion = cambiosReprogramacionPorJornadaId[jornada.id] ?? {
                fecha: jornada.fecha,
                horaInicio: jornada.horaInicio,
                horaFin: jornada.horaFin,
              };
              const estilo = ESTILO_POR_ESTADO[jornada.estado];
              const puedeEditar = puedeEditarJornada(jornada, usuarioId, esAdmin);

              return (
                <article
                  key={jornada.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm font-bold text-tkd-dark dark:text-white">
                        <IconoCalendario aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{jornada.fecha}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <IconoReloj aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{jornada.horaInicio} - {jornada.horaFin}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${estilo.bg} ${estilo.text}`}
                    >
                      {estilo.etiqueta}
                    </span>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Material asignado</p>
                    <p className="mt-1 text-sm font-bold text-tkd-dark dark:text-white">
                      {material.length > 0 ? material.join(', ') : 'Sin material asignado'}
                    </p>
                  </div>

                  {puedeEditar && jornada.estado === 'en_curso' && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                      {esFechaHoraPasada(jornada.fecha, jornada.horaFin) && (
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 mb-1">
                          ⚠️ Clase expirada. Podés cerrarla con asistencia o usar Forzar Cierre.
                        </p>
                      )}
                      <label className="flex items-center gap-2 text-xs font-bold text-tkd-dark dark:text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(asistenciaPorJornadaId[jornada.id])}
                          onChange={(event) => setAsistenciaPorJornadaId((actual) => ({
                            ...actual,
                            [jornada.id]: event.target.checked,
                          }))}
                        />
                        Asistencia registrada
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-tkd-dark dark:text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(objetivosImpartidosPorJornadaId[jornada.id])}
                          onChange={(event) => setObjetivosImpartidosPorJornadaId((actual) => ({
                            ...actual,
                            [jornada.id]: event.target.checked,
                          }))}
                        />
                        Objetivos impartidos
                      </label>
                    </div>
                  )}

                  {puedeEditar && acciones.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {acciones.map((accion) => (
                        <button
                          key={accion.clave}
                          type="button"
                          disabled={guardando}
                          onClick={() => handleAccionClick(jornada, accion.clave)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-red hover:text-tkd-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white"
                        >
                          {accion.etiqueta}
                        </button>
                      ))}
                      {jornada.estado === 'en_curso' && esFechaHoraPasada(jornada.fecha, jornada.horaFin) && (
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => cancelarClase(jornada, 'Cierre administrativo: Clase expirada en curso')}
                          className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Forzar Cierre
                        </button>
                      )}
                    </div>
                  )}

                  {puedeEditar && accionExpandida === 'cancelar' && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                      <textarea
                        aria-label="Motivo de cancelacion"
                        placeholder="Ingresa el motivo de cancelacion..."
                        className="rounded-xl border border-gray-200 p-2 text-xs font-medium text-tkd-dark dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        value={motivoPorJornadaId[jornada.id] ?? ''}
                        onChange={(event) => setMotivoPorJornadaId((actual) => ({
                          ...actual,
                          [jornada.id]: event.target.value,
                        }))}
                      />
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => {
                          const motivo = (motivoPorJornadaId[jornada.id] ?? '').trim();
                          if (!motivo) {
                            setError('Debes ingresar un motivo para cancelar la clase.');
                            return;
                          }
                          cancelarClase(jornada, motivo);
                        }}
                        className="rounded-xl bg-tkd-red px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirmar cancelacion
                      </button>
                    </div>
                  )}

                  {puedeEditar && accionExpandida === 'reprogramar' && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                      <input
                        type="date"
                        aria-label="Nueva fecha"
                        className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs font-medium text-tkd-dark dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        value={cambiosReprogramacion.fecha}
                        onChange={(event) => setCambiosReprogramacionPorJornadaId((actual) => ({
                          ...actual,
                          [jornada.id]: { ...cambiosReprogramacion, fecha: event.target.value },
                        }))}
                      />
                      <input
                        type="time"
                        aria-label="Nueva hora de inicio"
                        className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs font-medium text-tkd-dark dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        value={cambiosReprogramacion.horaInicio}
                        onChange={(event) => setCambiosReprogramacionPorJornadaId((actual) => ({
                          ...actual,
                          [jornada.id]: { ...cambiosReprogramacion, horaInicio: event.target.value },
                        }))}
                      />
                      <input
                        type="time"
                        aria-label="Nueva hora de fin"
                        className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs font-medium text-tkd-dark dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        value={cambiosReprogramacion.horaFin}
                        onChange={(event) => setCambiosReprogramacionPorJornadaId((actual) => ({
                          ...actual,
                          [jornada.id]: { ...cambiosReprogramacion, horaFin: event.target.value },
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => reprogramarClase(jornada, cambiosReprogramacion)}
                        className="rounded-xl bg-tkd-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
                      >
                        Guardar reprogramacion
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {jornadas.length > porPagina && (
            <nav aria-label="Paginacion de clases" className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: totalPaginas }, (_, indice) => (
                <button
                  key={indice}
                  type="button"
                  onClick={() => setPaginaActual(indice)}
                  aria-current={indice === paginaActual ? 'page' : undefined}
                  className={`h-9 min-w-[2.25rem] rounded-xl px-3 text-xs font-black transition ${
                    indice === paginaActual
                      ? 'bg-tkd-red text-white'
                      : 'border border-gray-200 bg-white text-gray-500 hover:border-tkd-red hover:text-tkd-red dark:border-white/10 dark:bg-gray-900 dark:text-gray-300'
                  }`}
                >
                  {indice + 1}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </section>
  );
};

export default MisClasesView;
