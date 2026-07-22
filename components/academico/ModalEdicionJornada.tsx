import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { RecursoAcademico } from '../../models/academico/recurso';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { ProgramaAcademico } from '../../models/academico/programa';
import { RolUsuario } from '../../tipos';
import {
  jornadaRepository,
  mensajeConflictoHorario,
  diffCambiosJornada,
  ConflictoConcurrenciaError,
  MENSAJE_ADVERTENCIA_AUDITORIA,
  MENSAJE_CONFIRMACION_ELIMINAR_CLASE,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- se mantiene importado a
// proposito: lo usa el bloque de codigo muerto comentado dentro de guardar() (ver ese
// comentario para el porque no se borro la rama completa).
import { cancelarJornada } from '../../servicios/academico/jornadaService';
import { listarRecursosAprobados } from '../../servicios/academico/bibliotecaService';
import {
  listarAsignacionesPorTenant,
  asignarMaterialAJornada,
  type AsignarMaterialAJornadaInput,
  type PublicarAsignacionResponse,
} from '../../servicios/academico/asignacionService';
import { programaRepository } from '../../servicios/academico/programaRepository';
import { puedeEditarJornada } from '../../vistas/admin/MisClasesView';
import { useEliminacionJornadaSegura } from '../../hooks/academico/useEliminacionJornadaSegura';
import PestanaProgramaJornada, { type OpcionesProgramaJornada } from './PestanaProgramaJornada';
import PestanaMaterialesJornada from './PestanaMaterialesJornada';
import type { AsignacionDraft } from './AsignarMaterialWizard';
import { IconoCerrar, IconoEliminar, IconoAprobar } from '../Iconos';

// Subtarea 12.9: modal de edicion singular de Agenda (secciones 5-10, 17, 19, 20 del
// documento "Mejora del módulo Agenda.txt"). Conecta:
//   - Componentes de 12.7: PestanaProgramaJornada (extendida en esta misma subtarea con
//     fecha/hora/estado) y PestanaMaterialesJornada (primer consumidor real).
//   - Validaciones de 12.2 (permiso "maestro asignado", re-chequeado aca en profundidad),
//     12.3 (existeConflictoHorario) y 12.4 (ConflictoConcurrenciaError).
//   - Guardas de 12.6 (eliminarJornadaSegura / EliminacionNoPermitidaError).
// Vive DENTRO de la vista de Agenda (AgendaView.tsx la monta condicionalmente sobre la
// misma pantalla, sin navegar a otra ruta ni perder el contexto semanal -- seccion 4/5).
//
// Rediseño post-cierre modulo 12 (ver CIERRE CENTRO DE ESTUDIOS.md, entrada de este mismo
// rediseño): la pestana "Programa" se reduce a Fecha/Hora inicio/Hora fin/Sede/Instructor
// (Programa, Grupo, Espacio, Estado y "Grados excluidos" dejan de editarse desde aca -- ver
// comentarios puntuales mas abajo). Las 2 pestanas ("Programa"/"Materiales") se colapsan en
// una sola vista con un boton "+ Agregar material" que dispara la MISMA maquina de estados
// interna (`pestana`) que antes disparaba el tab "Materiales".

const ETIQUETA_ESTADO: Record<JornadaInstruccion['estado'], string> = {
  borrador: 'Borrador',
  pendiente_confirmacion: 'Pendiente de confirmacion',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  pendiente_cierre: 'Pendiente de cierre',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
  parcial: 'Parcial',
  pendiente_sustitucion: 'Pendiente de sustitucion',
};

// Fase 2 del asistente de materiales espera grupos objetivo como texto libre (no ids) --
// mismo listado fijo ya usado por AsignacionesView.tsx para el mismo wizard.
const GRUPOS_OBJETIVO_MATERIAL = ['Infantil', 'Precadetes', 'Cadetes', 'Adultos', 'Todos'];

type Pestana = 'programa' | 'materiales';

export interface ModalEdicionJornadaProps {
  jornada: JornadaInstruccion;
  tenantId: string;
  usuarioId: string;
  esAdmin: boolean;
  rol: RolUsuario;
  // Extension posterior al cierre del modulo 12 (matriz de roles de Agenda): flag nuevo de
  // `Usuario` (tipos.ts) que un Admin otorga a un Asistente/Editor puntual para editar
  // jornadas ajenas. Se pasa a `puedeEditarJornada` junto con `rol` -- ver comentario
  // extendido junto a esa funcion en vistas/admin/MisClasesView.tsx.
  permisoEdicionAgenda?: boolean;
  opciones: OpcionesProgramaJornada;
  repository?: JornadaRepository;
  cargarRecursosDisponibles?: (tenantId: string) => Promise<RecursoAcademico[]>;
  cargarAsignacionesTenant?: (tenantId: string) => Promise<AsignacionAcademica[]>;
  cargarProgramasTenant?: (tenantId: string) => Promise<ProgramaAcademico[]>;
  asignarMaterial?: (input: AsignarMaterialAJornadaInput) => Promise<PublicarAsignacionResponse>;
  onCerrar: () => void;
  onGuardado: (jornadaActualizada: JornadaInstruccion) => void;
  onEliminada?: (jornadaId: string) => void;
}

// Rediseño post-cierre modulo 12: botones inferiores solo-icono (antes texto). Mismo criterio
// de color que ya usa el resto del modulo -- ver comentarios puntuales junto a cada uso.
const CLASE_BOTON_ICONO_SECUNDARIO = 'rounded-2xl border border-gray-200 p-3 text-tkd-dark transition hover:border-tkd-red hover:text-tkd-red disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white';
// Verde replicado EXACTO del patron ya usado para "Aprobar"/confirmar en
// ModalGestionarSolicitudes.tsx y components/dashboard/SolicitudesCompraPendientes.tsx
// (`bg-green-600` / `hover:bg-green-700` / `disabled:bg-green-400`, icono `IconoAprobar`).
const CLASE_BOTON_ICONO_PRIMARIO_VERDE = 'rounded-2xl bg-green-600 p-3 text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400';
const CLASE_BOTON_AGREGAR_MATERIAL = 'w-full rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-red hover:text-tkd-red dark:border-white/20 dark:text-white';

const ModalEdicionJornada: React.FC<ModalEdicionJornadaProps> = ({
  jornada,
  tenantId,
  usuarioId,
  esAdmin,
  rol,
  permisoEdicionAgenda,
  opciones,
  repository = jornadaRepository,
  cargarRecursosDisponibles = listarRecursosAprobados,
  cargarAsignacionesTenant = listarAsignacionesPorTenant,
  cargarProgramasTenant = (id: string) => programaRepository.listarProgramasPorTenant(id),
  asignarMaterial = asignarMaterialAJornada,
  onCerrar,
  onGuardado,
  onEliminada,
}) => {
  // Subtarea 12.9 (seccion 9 del documento de mejora): re-chequeo de permiso en profundidad.
  // AgendaView ya oculta el lapiz si !puedeEditarJornada, pero este modal puede abrirse desde
  // mas de un lugar en el futuro -- no confiar solo en que el boton estuvo oculto. Extension
  // posterior al cierre del modulo 12: se pasa `rol`/`permisoEdicionAgenda` para que este
  // re-chequeo respete la MISMA matriz completa (Asistente/Editor con flag, Estudiante/Tutor
  // siempre false) que ya usa AgendaView para decidir si muestra el lapiz.
  const puedeEditar = puedeEditarJornada(jornada, usuarioId, esAdmin, { rol, permisoEdicionAgenda });
  // Seccion 9/11: el maestro asignado no-admin no puede reasignar la clase a otro maestro.
  const instructorDeshabilitado = !esAdmin;
  // Ampliacion posterior al cierre inicial de esta extension (decision de producto
  // explicita del usuario, ver CIERRE CENTRO DE ESTUDIOS.md): "Eliminar clase" ya NO se
  // restringe a Admin/SuperAdmin -- usa la MISMA matriz que `puedeEditar` (Maestro solo su
  // propia clase asignada, Asistente/Editor solo con permisoEdicionAgenda). La seccion 8
  // del documento original ("Tenant/admin puede eliminar... Maestro asignado puede editar
  // su clase, pero no eliminarla salvo permiso explicito") ya contemplaba esa excepcion
  // ("salvo permiso explicito"); el flag `permisoEdicionAgenda` y el match de
  // `instructorId` son exactamente ese permiso explicito. Se colapsa a la MISMA variable
  // que `puedeEditar` (sin duplicar la logica de la matriz).
  const puedeEliminar = puedeEditar;

  const [pestana, setPestana] = React.useState<Pestana>('programa');
  const [draft, setDraft] = React.useState<JornadaInstruccion>(jornada);
  const [motivoCancelacion] = React.useState('');
  const [error, setError] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);

  // Subtarea posterior al cierre del modulo 12: flujo de eliminacion extraido a un hook
  // compartido (useEliminacionJornadaSegura) para que ModalEdicionJornada y el nuevo icono
  // de caneca de AgendaView.tsx reutilicen la MISMA logica de confirmacion + borrado seguro
  // + auditoria, sin duplicarla.
  const eliminacion = useEliminacionJornadaSegura({
    repository,
    tenantId,
    usuarioId,
    rol,
    fuente: 'agenda',
    onEliminada,
  });

  const [recursosDisponibles, setRecursosDisponibles] = React.useState<RecursoAcademico[]>([]);
  const [recursoIdsAsignados, setRecursoIdsAsignados] = React.useState<string[]>([]);
  const [tagsPrograma, setTagsPrograma] = React.useState<string[]>([]);
  // Rediseño post-cierre modulo 12 (punto 4): el titulo del modal mostraba el ID crudo de
  // programa (`PROGRAMA-...`) cuando `opciones.programas` (viene de
  // `obtenerContextoJornada`/`jornadaContextService`) no incluia el programa de esta
  // jornada -- caso confirmado en produccion por el usuario. `cargarProgramasTenant` (mismo
  // fetch que ya se usaba para `tagsPrograma`, via `programaRepository.listarProgramasPorTenant`,
  // la MISMA fuente que usa Centro de Estudios en otros lados para nombres de programa) es
  // mas confiable -- se guarda el objeto completo resuelto y se usa como fuente PRIMARIA del
  // titulo, con `opciones.programas` como fallback secundario y el ID crudo como ultimo
  // recurso.
  const [programaTenantResuelto, setProgramaTenantResuelto] = React.useState<ProgramaAcademico | null>(null);

  React.useEffect(() => {
    let activo = true;
    cargarRecursosDisponibles(tenantId)
      .then((recursos) => { if (activo) setRecursosDisponibles(recursos); })
      .catch(() => { if (activo) setRecursosDisponibles([]); });

    cargarAsignacionesTenant(tenantId)
      .then((asignaciones) => {
        if (!activo) return;
        setRecursoIdsAsignados(
          asignaciones.filter((asignacion) => asignacion.jornadaId === jornada.id).map((asignacion) => asignacion.recursoId),
        );
      })
      .catch(() => { if (activo) setRecursoIdsAsignados([]); });

    cargarProgramasTenant(tenantId)
      .then((programas) => {
        if (!activo) return;
        const programaDeLaJornada = programas.find((programa) => programa.id === jornada.programaId);
        setTagsPrograma(programaDeLaJornada?.tags ?? []);
        setProgramaTenantResuelto(programaDeLaJornada ?? null);
      })
      .catch(() => {
        if (activo) {
          setTagsPrograma([]);
          setProgramaTenantResuelto(null);
        }
      });

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, jornada.id, jornada.programaId]);

  const nombreProgramaResuelto =
    programaTenantResuelto?.nombre
    ?? opciones.programas.find((item) => item.id === jornada.programaId)?.nombre
    ?? jornada.programaId;

  const cambioHorarioSedeInstructor = (candidata: JornadaInstruccion) => (
    candidata.fecha !== jornada.fecha
    || candidata.horaInicio !== jornada.horaInicio
    || candidata.horaFin !== jornada.horaFin
    || candidata.sedeId !== jornada.sedeId
    || candidata.espacioId !== jornada.espacioId
    || candidata.instructorId !== jornada.instructorId
  );

  const persistirYAuditar = async (
    actualizada: JornadaInstruccion,
    accion: 'actualizar' | 'cancelar',
  ) => {
    await repository.guardarJornada(actualizada, { actualizadoEnEsperado: jornada.actualizadoEn });
    let advertenciaAuditoria = false;
    try {
      await repository.registrarAuditoria({
        tenantId,
        jornadaId: actualizada.id,
        usuarioId,
        rol,
        fuente: 'agenda',
        accion,
        cambios: diffCambiosJornada(jornada, actualizada),
      });
    } catch (auditError) {
      console.warn('[ModalEdicionJornada] No se pudo registrar auditoria', auditError);
      advertenciaAuditoria = true;
    }

    onGuardado(actualizada);
    // Seccion 20: "no cerrar modal si hay errores" -- si la auditoria fallo, dejamos el
    // aviso visible y NO auto-cerramos, para que el usuario lo lea antes de salir.
    if (advertenciaAuditoria) {
      setError(MENSAJE_ADVERTENCIA_AUDITORIA);
    } else {
      onCerrar();
    }
  };

  const guardar = async () => {
    if (!puedeEditar || guardando) return;
    setError('');

    if (draft.horaInicio >= draft.horaFin) {
      setError('La hora de inicio debe ser anterior a la hora de finalizacion.');
      return;
    }

    setGuardando(true);
    try {
      // Rediseño post-cierre modulo 12 (ver CIERRE CENTRO DE ESTUDIOS.md, entrada de este
      // mismo rediseño): esta rama queda MUERTA al sacar el selector de Estado de la
      // pestana Programa de este modal -- nada aca vuelve a poner `draft.estado =
      // 'cancelada'`, asi que la condicion de abajo nunca se cumple. Se deja COMENTADA (NO
      // se borra) a proposito: no se confirmo que `eliminacion.cancelarEnLugarDeEliminar`
      // (ver mas abajo, boton "Cancelar la clase en su lugar") cubra el MISMO caso de uso.
      // Ese flujo es un FALLBACK que la UI ofrece solo cuando `eliminarJornadaSegura`
      // rechaza el borrado fisico porque la clase ya se opero (asistencia registrada, etc);
      // no es equivalente a "cancelar esta clase proactivamente por cualquier motivo"
      // (feriado, instructor no disponible) en CUALQUIER estado, que es lo que este bloque
      // permitia via el selector de Estado que ya no existe aca. Esa cancelacion proactiva
      // sigue disponible en otra parte de la app (`MisClasesView.tsx` tiene su propia
      // accion "cancelar" con su propio motivo, fuente 'mis_clases') -- no se perdio la
      // capacidad general, pero especificamente DESDE el modal de edicion de Agenda ya no
      // hay una via directa para eso. Ambiguedad documentada, no asumida.
      //
      // if (draft.estado === 'cancelada' && jornada.estado !== 'cancelada') {
      //   if (!motivoCancelacion.trim()) {
      //     setError('Debes ingresar un motivo para cancelar la clase.');
      //     return;
      //   }
      //   const baseParaCancelar: JornadaInstruccion = { ...draft, estado: jornada.estado };
      //   const cancelada = cancelarJornada(baseParaCancelar, motivoCancelacion.trim());
      //   await persistirYAuditar(cancelada, 'cancelar');
      //   return;
      // }

      const candidata: JornadaInstruccion = { ...draft, actualizadoEn: new Date().toISOString() };

      if (cambioHorarioSedeInstructor(candidata)) {
        const resultadoConflicto = await repository.existeConflictoHorario(candidata);
        if (resultadoConflicto.hayConflicto) {
          setError(mensajeConflictoHorario(resultadoConflicto, candidata));
          return;
        }
      }

      await persistirYAuditar(candidata, 'actualizar');
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clase.');
    } finally {
      setGuardando(false);
    }
  };

  // Wrappers delgados sobre useEliminacionJornadaSegura: el hook no conoce `onCerrar` (prop
  // propia de este modal), asi que este componente decide cerrar SOLO cuando el hook
  // confirma exito (booleano de retorno, ver comentario del hook sobre closures
  // desactualizados). `puedeEliminar` sigue siendo la guarda de INICIO (el boton "Eliminar
  // clase" ni siquiera se renderiza si es false, ver JSX abajo).
  const confirmarEliminacion = async () => {
    if (!puedeEliminar) return;
    const exito = await eliminacion.confirmar();
    if (exito) onCerrar();
  };

  const cancelarEnLugarDeEliminar = async () => {
    const exito = await eliminacion.cancelarEnLugarDeEliminar(motivoCancelacion);
    if (exito) onCerrar();
  };

  const materialesAsignadosResumen = recursosDisponibles.filter((recurso) => recursoIdsAsignados.includes(recurso.id));

  const confirmarMaterial = async (draftMaterial: AsignacionDraft) => {
    const recurso = recursosDisponibles.find((item) => item.id === draftMaterial.recursoId);
    if (!recurso) {
      throw new Error('Selecciona un material valido para asignar.');
    }
    await asignarMaterial({
      tenantId,
      jornadaId: jornada.id,
      recurso,
      recursoId: draftMaterial.recursoId,
      tipoDestinatario: draftMaterial.destinatario,
      grupoObjetivo: draftMaterial.grupoObjetivo,
      grados: draftMaterial.grados,
      momento: draftMaterial.momento,
      criterio: draftMaterial.criterio,
      fechaApertura: draftMaterial.fechaApertura,
      fechaCierre: draftMaterial.fechaCierre || undefined,
      publicadoPorUid: usuarioId,
    });
    setRecursoIdsAsignados((actuales) => [...actuales, draftMaterial.recursoId]);
    // Fix (bug reportado: clic en "Asignar" no parecía hacer nada -- ni error, ni cambio
    // visible): tras guardar con éxito, nada volvía a `pestana: 'programa'`, así que el
    // wizard quedaba montado indefinidamente en el mismo paso 3, dando la impresión de que
    // el botón no disparaba ninguna acción aunque la asignación sí se hubiera guardado.
    setPestana('programa');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Editar clase ${jornada.horaInicio}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Agenda</p>
            <h2 className="mt-1 text-xl font-black uppercase text-tkd-dark dark:text-white">
              {nombreProgramaResuelto}
            </h2>
            <p className="mt-1 text-sm font-bold text-gray-500 dark:text-gray-400">
              {jornada.fecha} · {jornada.horaInicio} - {jornada.horaFin} · {ETIQUETA_ESTADO[jornada.estado]}
            </p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="shrink-0 text-gray-400 hover:text-tkd-red">
            <IconoCerrar className="h-5 w-5" />
          </button>
        </div>

        {!puedeEditar && (
          <p className="mt-3 rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-500 dark:bg-white/5 dark:text-gray-300">
            No tenes permiso para editar esta clase.
          </p>
        )}

        <div className="mt-4">
          {pestana === 'programa' && (
            <div className="space-y-3">
              <PestanaProgramaJornada
                jornada={draft}
                opciones={opciones}
                onSedeChange={(sedeId) => setDraft((actual) => ({ ...actual, sedeId }))}
                onInstructorChange={(instructorId) => setDraft((actual) => ({ ...actual, instructorId }))}
                instructorDeshabilitado={instructorDeshabilitado}
                fecha={draft.fecha}
                onFechaChange={(fecha) => setDraft((actual) => ({ ...actual, fecha }))}
                horaInicio={draft.horaInicio}
                onHoraInicioChange={(horaInicio) => setDraft((actual) => ({ ...actual, horaInicio }))}
                horaFin={draft.horaFin}
                onHoraFinChange={(horaFin) => setDraft((actual) => ({ ...actual, horaFin }))}
              />

              {/* Rediseño post-cierre modulo 12: bloque de "Motivo de cancelacion"
                  COMENTADO (no borrado) junto con la rama de guardar() de arriba -- misma
                  condicion muerta (draft.estado nunca vuelve a ser 'cancelada' desde este
                  modal, porque el selector de Estado que la disparaba ya no existe aca).
                  Ver el comentario extendido en guardar() para el detalle de la
                  incertidumbre sobre si cancelarEnLugarDeEliminar cubre el mismo caso de
                  uso (determinacion: NO son equivalentes).

              draft.estado === 'cancelada' && jornada.estado !== 'cancelada' && (
                <div className="grid gap-2">
                  <label htmlFor="motivo-cancelacion" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Motivo de cancelacion
                  </label>
                  <textarea
                    id="motivo-cancelacion"
                    value={motivoCancelacion}
                    onChange={(event) => setMotivoCancelacion(event.target.value)}
                    className="rounded-2xl border border-gray-200 p-3 text-sm font-medium dark:border-white/10 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              )
              */}

              <div className="grid gap-2">
                {materialesAsignadosResumen.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Materiales asignados</p>
                    <ul className="mt-2 space-y-1 text-sm font-bold text-tkd-dark dark:text-white">
                      {materialesAsignadosResumen.map((recurso) => (
                        <li key={recurso.id}>{recurso.tituloVisible || recurso.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button type="button" onClick={() => setPestana('materiales')} className={CLASE_BOTON_AGREGAR_MATERIAL}>
                  + Agregar material
                </button>
                <p className="text-xs font-medium text-gray-400">
                  La edicion de materiales se hace desde &quot;+ Agregar material&quot;.
                </p>
              </div>
            </div>
          )}

          {pestana === 'materiales' && (
            <PestanaMaterialesJornada
              jornadaId={jornada.id}
              modo="crear"
              recursosDisponibles={recursosDisponibles}
              tagsPrograma={tagsPrograma}
              gruposObjetivo={GRUPOS_OBJETIVO_MATERIAL}
              recursoIdsAsignados={recursoIdsAsignados}
              onCancelar={() => setPestana('programa')}
              onConfirmar={confirmarMaterial}
            />
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {eliminacion.error && (
          <div className="mt-3 space-y-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <p>{eliminacion.error.mensaje}</p>
            {eliminacion.error.ofrecerCancelar && (
              <button
                type="button"
                onClick={cancelarEnLugarDeEliminar}
                disabled={eliminacion.eliminando}
                className="rounded-xl bg-tkd-red px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar la clase en su lugar
              </button>
            )}
          </div>
        )}

        {eliminacion.confirmando && (
          <div className="mt-3 space-y-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            <p>{MENSAJE_CONFIRMACION_ELIMINAR_CLASE}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarEliminacion}
                disabled={eliminacion.eliminando}
                className="rounded-xl bg-tkd-red px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar eliminacion
              </button>
              <button
                type="button"
                onClick={() => eliminacion.cerrar()}
                disabled={eliminacion.eliminando}
                className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tkd-dark dark:border-white/10 dark:text-white"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {puedeEliminar && !eliminacion.confirmando && (
              <button
                type="button"
                aria-label="Eliminar clase"
                onClick={() => eliminacion.iniciar(jornada)}
                className={CLASE_BOTON_ICONO_SECUNDARIO}
              >
                <IconoEliminar className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Cancelar" onClick={onCerrar} className={CLASE_BOTON_ICONO_SECUNDARIO}>
              <IconoCerrar className="h-4 w-4" />
            </button>
            {puedeEditar && (
              <button
                type="button"
                aria-label="Guardar cambios"
                onClick={guardar}
                disabled={guardando}
                className={CLASE_BOTON_ICONO_PRIMARIO_VERDE}
              >
                <IconoAprobar className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalEdicionJornada;
