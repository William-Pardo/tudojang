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
  cerrarJornada,
  marcarPendienteCierre,
  cancelarJornada,
  reprogramarJornada,
} from '../../servicios/academico/jornadaService';
import {
  asistenciaRepository as asistenciaRepositoryPorDefecto,
  type AsistenciaRepository,
} from '../../servicios/academico/asistenciaRepository';
import { contarCheckIns } from '../../servicios/academico/asistenciaService';
import { IconoCalendario, IconoReloj, IconoAprobar, IconoEditar, IconoReprogramar, IconoEliminar } from '../../components/Iconos';
import {
  checkpointMaterialService as checkpointMaterialServicePorDefecto,
  type CheckpointMaterialService,
} from '../../servicios/academico/checkpointMaterialService';
import { resumirCoberturaClase, type ResumenCoberturaClase } from '../../models/academico/checkpointMaterial';

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
  // Extension posterior al cierre del modulo 12 (matriz de roles de Agenda): flag nuevo
  // de `Usuario` (tipos.ts) que un Admin le otorga a un Asistente/Editor puntual para que
  // pueda editar jornadas ajenas (no solo las suyas). Se pasa a `puedeEditarJornada` junto
  // con `rol` para que esta vista respete la MISMA matriz que AgendaView/ModalEdicionJornada
  // -- ver comentario extendido junto a `puedeEditarJornada` mas abajo.
  permisoEdicionAgenda?: boolean;
  repository?: JornadaRepository;
  // Gap #5 (auditoria de integracion Centro de Estudios/Agenda, 2026-07-18): mismo patron
  // que JornadasView.tsx -- `asistenciaRegistrada` se deriva de check-ins reales de la
  // subcoleccion `asistencias`, en vez de un checkbox manual. Opcional con default en la
  // destructuracion del componente (mismo patron que `repository`/`jornadaRepository`).
  asistenciaRepository?: AsistenciaRepository;
  // WS-4b (§9.3): resumen de cobertura de materiales, mostrado ANTES de cerrar una clase
  // en_curso (mismo criterio que cantidadCheckInsPorJornadaId: se calcula solo, no gatea el
  // cierre -- un maestro puede cerrar con 0% de cobertura si asi fue la clase real).
  checkpointMaterialService?: CheckpointMaterialService;
  // Fix 4 (persistencia/seleccion de Programa academico): contador que el padre
  // (AsignacionesView) incrementa tras guardar/eliminar un programa para forzar la
  // recarga de jornadas sin remount. Mismo patron refreshTrigger que ya usa
  // AsignacionesView con BibliotecaView para los recursos. Sin esto, si el programaId
  // no cambia (edicion in-place), cargar() jamas volvia a ejecutarse y "Mis clases"
  // quedaba desactualizado hasta navegar afuera y volver.
  refreshTrigger?: number;
  // Rediseño 2026-07-11: el icono editar (lapiz) del pill abre el asistente de material,
  // que vive en el padre (AsignacionesView, unico lugar con el wizard de 3 pasos). Esta
  // vista no conoce el wizard -- solo delega la jornada clickeada. Opcional: sin este
  // callback, el icono editar no se renderiza (mismo patron que el resto de props opcionales).
  onEditarMaterial?: (jornada: JornadaInstruccion) => void;
}

// Subtarea 12.2 — permiso "maestro asignado". Solo el maestro asignado
// (jornada.instructorId === usuarioId) o un Admin/SuperAdmin (esAdmin) puede
// editar/cancelar/reprogramar una jornada. Esta es la guarda de UI; el backend
// (firestore.rules, match /tenants/{tenantId}/jornadas/{jornadaId}) impone la misma
// regla en `update`, por lo que ocultar el boton no es la unica defensa.
// Subtarea 12.8: exportada (antes privada de este archivo) para que la parrilla semanal
// de Agenda (vistas/admin/AgendaView.tsx) reutilice el MISMO criterio de permiso para
// mostrar/ocultar el icono de edicion, en vez de duplicar la logica en un segundo lugar.
//
// Extension posterior al cierre del modulo 12 (matriz de roles de Agenda, ver CIERRE
// CENTRO DE ESTUDIOS.md): se agrega un 4to parametro OPCIONAL `contexto` con el rol de
// quien opera y el flag `permisoEdicionAgenda` (nuevo en `Usuario`, tipos.ts). Es
// opcional a proposito -- retrocompatible con cualquier call site que todavia no lo pase,
// que sigue comportandose EXACTO igual que antes (esAdmin || instructorId === usuarioId).
// Con `contexto.rol` informado, la matriz completa es:
//   - Admin/SuperAdmin (esAdmin=true): siempre true.
//   - Estudiante/Tutor: siempre false (nunca editan Agenda, sin excepcion).
//   - Asistente/Editor: true SOLO si `contexto.permisoEdicionAgenda === true` (otorgado
//     por un Admin; el toggle de UI para activarlo queda pendiente de Codex).
//   - Maestro (o rol no informado, retrocompatibilidad): solo el instructor asignado.
export interface ContextoPermisoEdicionJornada {
  rol?: RolUsuario;
  permisoEdicionAgenda?: boolean;
}

export function puedeEditarJornada(
  jornada: JornadaInstruccion,
  usuarioId: string,
  esAdmin: boolean,
  contexto?: ContextoPermisoEdicionJornada,
): boolean {
  if (esAdmin) return true;

  const rol = contexto?.rol;
  // Estudiante/Tutor nunca editan, sin excepcion -- se chequea ANTES que el match de
  // instructor para blindar el caso raro de datos donde instructorId coincidiera con un
  // uid de un rol no docente.
  if (rol === RolUsuario.Estudiante || rol === RolUsuario.Tutor) return false;

  // El instructor asignado de la jornada siempre puede editar SU clase, sin importar el
  // rol exacto -- Maestro es el caso tipico, pero call sites/tests preexistentes (12.2-12.9)
  // tambien usan roles operativos (Editor/Asistente) como "el maestro asignado" en datos de
  // transicion (ver DT-0019 en firestore.rules sobre la separacion tardia del rol Maestro).
  // Este chequeo va ANTES del gate de flag de abajo a proposito: no reinventa el criterio
  // ya establecido en 12.2, solo lo preserva mientras se agrega el caso NUEVO (Asistente/
  // Editor NO asignado, con permiso explicito).
  if (jornada.instructorId === usuarioId) return true;

  // Asistente/Editor NO asignados a esta jornada: solo editan si el Admin les otorgo el
  // permiso explicito (`permisoEdicionAgenda`, ver tipos.ts).
  if (rol === RolUsuario.Asistente || rol === RolUsuario.Editor) {
    return contexto?.permisoEdicionAgenda === true;
  }

  return false;
}

type ClaveAccion = 'cerrar' | 'cancelar' | 'reprogramar' | 'restaurar';

interface CambiosReprogramacion {
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

// Fase 3.7 (2026-07-07): tarjetas por pagina en la grilla de "Mis clases".
// Rediseño 2026-07-12 (pedido explicito del usuario): grilla 3x3 (9) -> 4x3 (12).
const porPagina = 12;

// Fase 3.7 (2026-07-07): convencion de color por estado de jornada — no existia antes en el
// proyecto (confirmado por busqueda: ninguna otra vista mapea EstadoJornada a color). Eleccion:
// borrador=gris (aun sin confirmar) · confirmada/reprogramada=azul (agendada) ·
// en_curso/pendiente_cierre/parcial/pendiente_sustitucion=ambar (requiere atencion) ·
// cerrada=verde (completada) · cancelada=rojo (no se dicto). Record exhaustivo por tipos, aunque
// este flujo (ver transicionar()/cancelarClase()/reprogramarClase() abajo) hoy solo produce
// borrador/confirmada/en_curso/cerrada/cancelada.
const ESTILO_POR_ESTADO: Record<JornadaInstruccion['estado'], { bg: string; text: string; etiqueta: string }> = {
  // Rediseño 2026-07-13 (pedido explicito del usuario: "borra el estado borrador, tanto
  // de los estados como de la visualizacion del contenedor"): borrador ya no se muestra
  // distinto de confirmada -- mismo color, misma etiqueta ("Confirmada").
  borrador: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-tkd-blue', etiqueta: 'Confirmada' },
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
    // Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no
    // deberia existir... la idea es hacer maleable cada clase, donde por default todo
    // quede tal como se muestra en el contenedor"): borrador ofrece EXACTAMENTE las
    // mismas acciones que confirmada -- ya no existe un paso manual de "Confirmar"
    // (jornadaService.ts ya permite reprogramar directo desde borrador, ver
    // transicionesPermitidas). El estado sigue mostrandose como texto informativo, solo
    // dejan de variar las acciones disponibles.
    case 'borrador':
    case 'confirmada':
      // Rediseño 2026-07-11 (pedido explicito del usuario): "Iniciar" ya no existe -- la
      // transicion confirmada -> en_curso ahora es automatica por horario (ver
      // functions/academico/jornadasScheduler.js, iniciarJornadasPorHorario).
      return [
        { clave: 'reprogramar', etiqueta: 'Reprogramar' },
        { clave: 'cancelar', etiqueta: 'Cancelar clase' },
      ];
    case 'en_curso':
      return [
        { clave: 'cerrar', etiqueta: 'Cerrar' },
        { clave: 'cancelar', etiqueta: 'Cancelar clase' },
      ];
    // Rediseño 2026-07-13 (pedido explicito del usuario): posibilidad de restituir una
    // clase cancelada por error. Unica accion disponible -- reagendar/editar/cancelar no
    // aplican a una clase ya cancelada.
    case 'cancelada':
      return [{ clave: 'restaurar', etiqueta: 'Restaurar' }];
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
  permisoEdicionAgenda,
  repository = jornadaRepository,
  asistenciaRepository = asistenciaRepositoryPorDefecto,
  checkpointMaterialService = checkpointMaterialServicePorDefecto,
  refreshTrigger = 0,
  onEditarMaterial,
}) => {
  const [jornadas, setJornadas] = React.useState<JornadaInstruccion[]>([]);
  const [materialPorJornadaId, setMaterialPorJornadaId] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState('');
  // Gap #5 (auditoria de integracion Centro de Estudios/Agenda, 2026-07-18): mismo patron
  // que JornadasView.tsx, adaptado a una LISTA de jornadas -- `asistenciaRegistrada` ya no
  // es un checkbox manual, se deriva del conteo real de check-ins por jornada (mapa
  // jornadaId -> cantidad, ver efecto de carga mas abajo).
  const [cantidadCheckInsPorJornadaId, setCantidadCheckInsPorJornadaId] = React.useState<Record<string, number>>({});
  // WS-4b (§9.3): resumen de cobertura de materiales por jornada en_curso.
  const [coberturaPorJornadaId, setCoberturaPorJornadaId] = React.useState<Record<string, ResumenCoberturaClase>>({});
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
  // Pedido del usuario (2026-07-11): tema editable inline directo desde el pill de la
  // tarjeta, sin salir de Mis Clases (antes solo se podia desde un panel separado en
  // AsignacionesView, navegando de a una clase). Persiste con actualizarTemaJornada,
  // que ya existe en JornadaRepository y ya es por jornada individual.
  const [temaEditandoJornadaId, setTemaEditandoJornadaId] = React.useState<string | null>(null);
  const [temaBorradorPorJornadaId, setTemaBorradorPorJornadaId] = React.useState<Record<string, string>>({});

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

  // Gap #5: solo las jornadas 'en_curso' necesitan el conteo de check-ins (son las unicas
  // que se pueden cerrar, y cerrarJornada() exige asistenciaRegistrada) -- cargar check-ins
  // de jornadas ya cerradas/programadas/canceladas seria trabajo innecesario. `jornadas`
  // como array completo no sirve de dependencia estable (nueva referencia en cada
  // setJornadas, incluso cuando el conjunto en_curso no cambio), asi que se deriva una key
  // estable (ids en_curso unidos con coma) para evitar loops/pedidos redundantes.
  const idsEnCursoKey = jornadas
    .filter((jornada) => jornada.estado === 'en_curso')
    .map((jornada) => jornada.id)
    .join(',');

  React.useEffect(() => {
    const idsEnCurso = idsEnCursoKey ? idsEnCursoKey.split(',') : [];
    if (idsEnCurso.length === 0) {
      setCantidadCheckInsPorJornadaId({});
      return;
    }

    let activo = true;
    Promise.all(
      idsEnCurso.map((jornadaId) =>
        asistenciaRepository.listarPorJornada(tenantId, jornadaId)
          .then((registros): [string, number] => [jornadaId, contarCheckIns(registros)])
          // Un fallo puntual no debe impedir que las demas jornadas se pinten (mismo
          // criterio que ya usa cargar() para el material, lineas de arriba): esa jornada
          // queda en 0 check-ins en el mapa.
          .catch((): [string, number] => [jornadaId, 0]),
      ),
    ).then((resultados) => {
      if (!activo) return;
      setCantidadCheckInsPorJornadaId(Object.fromEntries(resultados));
    });

    return () => {
      activo = false;
    };
  }, [idsEnCursoKey, asistenciaRepository, tenantId]);

  // WS-4b (§9.3): mismo criterio que el efecto de check-ins de arriba -- solo las jornadas
  // en_curso necesitan el resumen (es lo que se muestra antes de cerrarlas), y un fallo en
  // una jornada puntual no debe impedir que las demas calculen su cobertura.
  React.useEffect(() => {
    const idsEnCurso = idsEnCursoKey ? idsEnCursoKey.split(',') : [];
    if (idsEnCurso.length === 0) {
      setCoberturaPorJornadaId({});
      return;
    }

    let activo = true;
    Promise.all(
      idsEnCurso.map((jornadaId) =>
        Promise.all([
          checkpointMaterialService.listarMaterialesDeJornada(tenantId, jornadaId),
          checkpointMaterialService.listarCheckpoints(tenantId, jornadaId),
        ])
          .then(([materiales, checkpoints]): [string, ResumenCoberturaClase] => [
            jornadaId,
            resumirCoberturaClase(materiales, checkpoints),
          ])
          .catch((): [string, ResumenCoberturaClase] => [
            jornadaId,
            resumirCoberturaClase([], []),
          ]),
      ),
    ).then((resultados) => {
      if (!activo) return;
      setCoberturaPorJornadaId(Object.fromEntries(resultados));
    });

    return () => {
      activo = false;
    };
  }, [idsEnCursoKey, checkpointMaterialService, tenantId]);

  const transicionar = async (jornada: JornadaInstruccion) => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      let actualizada: JornadaInstruccion;
      if (jornada.estado === 'en_curso') {
        const pendiente = marcarPendienteCierre(jornada, {
          asistenciaRegistrada: (cantidadCheckInsPorJornadaId[jornada.id] ?? 0) > 0,
          objetivosImpartidos: objetivosImpartidosPorJornadaId[jornada.id] ? jornada.objetivosPlaneados : [],
        });
        actualizada = cerrarJornada(pendiente);
      } else if (jornada.estado === 'cancelada') {
        // Rediseño 2026-07-13: "restaurar" reutiliza confirmarJornada -- unico camino de
        // salida de 'cancelada' (jornadaService.ts, transicionesPermitidas.cancelada).
        actualizada = confirmarJornada(jornada);
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
          // Rediseño 2026-07-13: transicionar() ahora cubre 'cerrar' (en_curso) y
          // 'restaurar' (cancelada -> confirmada).
          accion: actualizada.estado === 'confirmada' ? 'restaurar' : 'cerrar',
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

  const abrirEdicionTemaInline = (jornada: JornadaInstruccion) => {
    setTemaBorradorPorJornadaId((actual) => ({ ...actual, [jornada.id]: jornada.tema ?? '' }));
    setTemaEditandoJornadaId(jornada.id);
  };

  const cancelarEdicionTemaInline = () => {
    setTemaEditandoJornadaId(null);
  };

  const guardarTemaInline = async (jornada: JornadaInstruccion) => {
    setTemaEditandoJornadaId(null);
    const nuevoTema = (temaBorradorPorJornadaId[jornada.id] ?? '').trim();
    if (nuevoTema === (jornada.tema ?? '')) return;
    setJornadas((actuales) => actuales.map((item) => (item.id === jornada.id ? { ...item, tema: nuevoTema } : item)));
    try {
      await repository.actualizarTemaJornada(tenantId, jornada.id, nuevoTema);
    } catch (err) {
      console.warn('[MisClasesView] No se pudo guardar el tema de la jornada', err);
    }
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jornadasPagina.map((jornada) => {
              const material = materialPorJornadaId[jornada.id] ?? [];
              const cantidadCheckIns = cantidadCheckInsPorJornadaId[jornada.id] ?? 0;
              const cobertura = coberturaPorJornadaId[jornada.id];
              const acciones = accionesDisponibles(jornada.estado);
              const accionExpandida = accionExpandidaPorJornadaId[jornada.id] ?? null;
              const cambiosReprogramacion = cambiosReprogramacionPorJornadaId[jornada.id] ?? {
                fecha: jornada.fecha,
                horaInicio: jornada.horaInicio,
                horaFin: jornada.horaFin,
              };
              const estilo = ESTILO_POR_ESTADO[jornada.estado];
              const puedeEditar = puedeEditarJornada(jornada, usuarioId, esAdmin, { rol, permisoEdicionAgenda });
              const puedeReprogramar = acciones.some((accion) => accion.clave === 'reprogramar');
              const puedeCancelar = acciones.some((accion) => accion.clave === 'cancelar');
              const puedeRestaurar = acciones.some((accion) => accion.clave === 'restaurar');

              return (
                <article
                  key={jornada.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-gray-900"
                >
                  {/* Rediseño 2026-07-12 (pedido explicito del usuario sobre un screenshot en
                      vivo): el pill queda SOLO en su propia linea arriba de la tarjeta -- los
                      iconos de accion se mueven a la fila de fecha/hora (a la derecha), y el
                      estado pasa a su propia linea debajo de esa fila de iconos. */}
                  <div>
                    {temaEditandoJornadaId === jornada.id ? (
                      <input
                        autoFocus
                        aria-label="Tema de la clase"
                        value={temaBorradorPorJornadaId[jornada.id] ?? ''}
                        onChange={(event) => setTemaBorradorPorJornadaId((actual) => ({ ...actual, [jornada.id]: event.target.value }))}
                        onBlur={() => guardarTemaInline(jornada)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); guardarTemaInline(jornada); }
                          if (event.key === 'Escape') { cancelarEdicionTemaInline(); }
                        }}
                        className={`min-w-0 max-w-full truncate rounded-full border border-tkd-blue px-3 py-1 text-xs font-black focus:outline-none ${estilo.bg} ${estilo.text}`}
                      />
                    ) : puedeEditar ? (
                      <button
                        type="button"
                        onClick={() => abrirEdicionTemaInline(jornada)}
                        className={`max-w-full truncate rounded-full px-3 py-1 text-left text-xs font-black transition hover:opacity-80 ${estilo.bg} ${estilo.text}`}
                      >
                        {jornada.tema?.trim() ? jornada.tema : 'Sin tema'}
                      </button>
                    ) : (
                      <span
                        className={`inline-block max-w-full truncate rounded-full px-3 py-1 text-xs font-black ${estilo.bg} ${estilo.text}`}
                      >
                        {jornada.tema?.trim() ? jornada.tema : 'Sin tema'}
                      </span>
                    )}
                  </div>

                  {/* Rediseño 2026-07-12 (segundo pase, pedido explicito del usuario sobre un
                      screenshot en vivo): fecha completa en su propia linea, horario en una
                      linea separada debajo (antes iban combinados en una sola linea); los
                      iconos de accion pasan de fila horizontal a COLUMNA VERTICAL a la
                      derecha, en este orden: Reagendar, Editar, Cancelar/Eliminar. */}
                  <div className="flex items-start justify-between gap-x-4">
                    <div className="flex flex-col gap-1 text-xs font-medium text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <IconoCalendario aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {jornada.fecha}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <IconoReloj aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {jornada.horaInicio} - {jornada.horaFin}
                      </span>
                    </div>
                    {puedeEditar && (puedeRestaurar || puedeReprogramar || puedeCancelar || onEditarMaterial) && (
                      <div className="flex shrink-0 flex-col gap-2">
                        {/* Rediseño 2026-07-13 (pedido explicito del usuario): "puede ser que
                            haga switch con el icono check" -- para una clase CANCELADA, el
                            check reemplaza por completo a reagendar/editar/cancelar (ninguno
                            aplica a una clase ya cancelada). */}
                        {puedeRestaurar ? (
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => handleAccionClick(jornada, 'restaurar')}
                            aria-label="Restaurar"
                            title="Restaurar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-900/20 dark:text-green-400"
                          >
                            <IconoAprobar className="h-4 w-4" />
                          </button>
                        ) : (
                          <>
                            {puedeReprogramar && (
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => handleAccionClick(jornada, 'reprogramar')}
                                aria-label="Reprogramar"
                                title="Reprogramar"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-tkd-blue transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/20 dark:text-blue-400"
                              >
                                <IconoReprogramar className="h-4 w-4" />
                              </button>
                            )}
                            {onEditarMaterial && (
                              <button
                                type="button"
                                onClick={() => onEditarMaterial(jornada)}
                                aria-label={`Editar material de la clase del ${jornada.fecha}`}
                                title="Editar material de la clase"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300"
                              >
                                <IconoEditar className="h-4 w-4" />
                              </button>
                            )}
                            {/* "Cancelar clase" es icono solo (sin texto visible), ultimo en
                                la columna -- el nombre accesible se conserva via aria-label. */}
                            {puedeCancelar && (
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => handleAccionClick(jornada, 'cancelar')}
                                aria-label="Cancelar clase"
                                title="Cancelar clase"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-tkd-red transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                              >
                                <IconoEliminar className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Estado: su propia linea, debajo de la fila de iconos. */}
                  <div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${estilo.text}`}>
                      {estilo.etiqueta}
                    </span>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Material asignado</p>
                    <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
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
                      {/* Gap #5: texto derivado del conteo real de check-ins (subcoleccion
                          `asistencias`, escrita server-side por registrarAsistenciaJornada),
                          mismo patron que JornadasView.tsx -- ya no es un checkbox manual. */}
                      <p className="text-xs font-bold text-tkd-dark dark:text-white">
                        {cantidadCheckIns > 0
                          ? `Asistencia registrada (${cantidadCheckIns} check-in${cantidadCheckIns === 1 ? '' : 's'})`
                          : 'Sin check-ins registrados aún'}
                      </p>
                      {/* WS-4b (§9.3): informativo, no bloquea el cierre -- una clase sin
                          materiales asignados no tiene nada que mostrar (cobertura?.total
                          es 0) y no aparece el bloque. */}
                      {cobertura && cobertura.total > 0 && (
                        <p className="text-xs font-bold text-tkd-dark dark:text-white">
                          Cobertura de materiales: {cobertura.coberturaPorcentaje}%{' '}
                          <span className="font-medium text-gray-400">
                            ({cobertura.total - (cobertura.porEstado.sin_marcar ?? 0)} de {cobertura.total} marcados)
                          </span>
                        </p>
                      )}
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

                  {/* Rediseño 2026-07-12: 'confirmar' ya no existe (borrador = confirmada) y
                      'reprogramar'/'cancelar' se manejan arriba como iconos junto a fecha/hora
                      -- este listado generico ahora solo cubre 'cerrar' (texto sin ambiguedad)
                      y el caso especial "Forzar Cierre". */}
                  {puedeEditar && (
                    acciones.some((accion) => accion.clave === 'cerrar')
                    || (jornada.estado === 'en_curso' && esFechaHoraPasada(jornada.fecha, jornada.horaFin))
                  ) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {acciones.filter((accion) => accion.clave === 'cerrar').map((accion) => (
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
