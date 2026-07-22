import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RolUsuario, type Estudiante } from '../../tipos';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import { resolveStudentsForConsultor } from '../../servicios/academico/tutorStudentResolver';
import {
  jornadaRepository,
  MENSAJE_CONFIRMACION_ELIMINAR_CLASE,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
import { puedeEditarJornada } from './MisClasesView';
import { useEliminacionJornadaSegura } from '../../hooks/academico/useEliminacionJornadaSegura';
import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import { obtenerContextoJornada, type ContextoJornada } from '../../servicios/academico/jornadaContextService';
import {
  DIAS_SEMANA,
  obtenerRangoSemana,
  sumarSemanas,
  agruparJornadasPorFecha,
  calcularFilasHorarioAgenda,
  formatearFechaIso,
  type RangoSemana,
} from '../../servicios/academico/agendaSemanalService';
import {
  calcularIndicadorClaseEnVivo,
  type IndicadorClaseEnVivo,
} from '../../servicios/academico/ventanaClaseEnVivoService';
import { IconoEditar, IconoEliminar } from '../../components/Iconos';
import ModalEdicionJornada from '../../components/academico/ModalEdicionJornada';

// Subtarea 12.9: contexto vacio por defecto para el modal de edicion (mismo shape que
// devuelve obtenerContextoJornada), usado antes de que la carga real resuelva.
const CONTEXTO_VACIO: ContextoJornada = { programas: [], grupos: [], sedes: [], espacios: [], instructores: [] };

// Subtarea 12.8 (Vista Agenda: parrilla semanal). Fuente de datos: se eligio
// `jornadaRepository.listarJornadasPorRangoFechas` (nueva, ver jornadaRepository.ts) en
// vez de `obtenerClasesAcademicasDelTenant`/`agendaAcademicaService.ts` (que sugeria el
// checklist original), porque esa funcion agrupa por `bloqueRecurrenteId` y devuelve
// SOLO la proxima ocurrencia de cada bloque -- una parrilla semanal necesita TODAS las
// ocurrencias reales dentro del rango Lunes-Domingo visible (ver comentario extendido en
// agendaSemanalService.ts).

// Subtarea 12.8: gating de rol para VER la vista (distinto del gating de EDICION por
// jornada, que usa `puedeEditarJornada`). El documento de mejora (seccion 9) dice que
// Tenant/admin ve y edita cualquier clase, el maestro asignado ve/edita la suya, y "otros
// maestros" pueden VER (no editar) si su rol lo permite; Estudiante/Tutor no editan
// Agenda. Se interpreta "otros maestros"/roles operativos como los roles que agrupa
// `isInstructor()` en firestore.rules: Admin/Editor/Asistente/Maestro/SuperAdmin. La gate
// real de la RUTA vive en App.tsx (con el mismo set de roles); este componente no
// necesita replicarla porque asume que ya paso ese gate, pero se documenta aca para que
// quede claro el criterio compartido.
// Fix 2026-07-11: RolUsuario.Maestro (rol docente real) faltaba en esta lista y en el
// gate real de App.tsx, dejando fuera al maestro asignado -- el mismo rol que
// `isInstructor()` de firestore.rules SI reconoce como instructor valido. Ver registro de
// cierre "Fix bug: rol Maestro excluido de la ruta /agenda" en CIERRE CENTRO DE ESTUDIOS.md.
//
// Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la parrilla,
// decision explicita del usuario documentada en CIERRE CENTRO DE ESTUDIOS.md): se agrega
// RolUsuario.Estudiante en modo SOLO LECTURA (ve la parrilla completa, nunca ve los
// iconos de editar/eliminar -- `puedeEditarJornada` devuelve false para Estudiante sin
// excepcion). Tutor (padre/acudiente, ver utils/roles.ts) sigue EXCLUIDO a proposito: no
// ve Agenda.
export const ROLES_CON_ACCESO_AGENDA: RolUsuario[] = [
  RolUsuario.Admin,
  RolUsuario.Editor,
  RolUsuario.Asistente,
  RolUsuario.Maestro,
  RolUsuario.SuperAdmin,
  RolUsuario.Estudiante,
];

interface AgendaViewProps {
  repository?: JornadaRepository;
}

// Simplificado 2026-07-16 (pedido explicito del usuario): la parrilla mostraba DOS badges
// por bloque -- el estado academico completo (10 valores: borrador/confirmada/en_curso/
// pendiente_cierre/cerrada/cancelada/reprogramada/parcial/pendiente_sustitucion/pendiente_
// confirmacion) MAS el indicador de Clase en Vivo -- y se sentia sobrecargada para un
// vistazo rapido. El badge de estado academico se retira de ACA (de la grilla semanal);
// sigue disponible completo al abrir/editar una clase puntual (ModalEdicionJornada), que es
// donde de verdad hace falta operar sobre el. La grilla ahora muestra SOLO el indicador de
// Clase en Vivo de abajo, ya simplificado a 4 estados (ver ventanaClaseEnVivoService.ts).
const ESTILO_POR_INDICADOR_CLASE_EN_VIVO: Record<IndicadorClaseEnVivo, { bg: string; text: string; etiqueta: string }> = {
  proxima: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-tkd-blue', etiqueta: 'Próxima' },
  activa: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', etiqueta: 'Clase activa' },
  finalizada: { bg: 'bg-gray-100 dark:bg-white/10', text: 'text-gray-500 dark:text-gray-300', etiqueta: 'Finalizada' },
  cancelada: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-tkd-red', etiqueta: 'Cancelada' },
};

// Subtarea 12.10: recalculo cada 60s, mismo intervalo ya usado por `useVentanaClaseEnVivo.ts`
// para el link de la barra lateral (`design.md`, Decision 7). NO se reutiliza ese hook
// directamente aca porque hace su PROPIO fetch de jornadas del tenant filtrado por rol
// (`listarJornadasPorTenant`), semanticamente distinto de esta vista (que ya tiene sus
// propias jornadas de la semana visible via `repository.listarJornadasPorRangoFechas`, sin
// filtro de rol) -- reusarlo duplicaria una llamada de red innecesaria. Solo se reutiliza la
// funcion PURA (`calcularIndicadorClaseEnVivo`) y las constantes del servicio, no el hook.
const INTERVALO_RECALCULO_INDICADOR_MS = 60_000;

const AgendaView: React.FC<AgendaViewProps> = ({ repository = jornadaRepository }) => {
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? 'tenant-local';
  const usuarioId = usuario?.id ?? '';
  // Subtarea 12.8: mismo criterio ya usado por AsignacionesView.tsx al embeber
  // MisClasesView (esAdmin = Admin || SuperAdmin) -- Admin/SuperAdmin pueden editar
  // cualquier jornada, el resto solo la suya (ver puedeEditarJornada, 12.2).
  const esAdmin = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin;
  const rol = usuario?.rol ?? RolUsuario.Editor;
  // Fix tutor-role-end-to-end (2026-07-14): el Tutor (padre/acudiente) ve la Agenda en modo
  // SOLO LECTURA, filtrada a las clases que aplican a su(s) hijo(s) — por sede + grupo del
  // estudiante (una jornada de grupoId/sede que le corresponde). `puedeEditarJornada` ya
  // devuelve false para Tutor, así que no ve iconos de editar/eliminar.
  const esTutor = usuario?.rol === RolUsuario.Tutor;
  // El Estudiante también ve la Agenda filtrada a SUS clases (mismo criterio, resuelto por su
  // propio `correo` en vez de `tutor.correo`). Ambos son consultores solo-lectura.
  const esConsultor = esTutor || usuario?.rol === RolUsuario.Estudiante;
  const usuarioEmail = usuario?.email ?? '';
  // Extension posterior al cierre del modulo 12 (matriz de roles de Agenda): flag nuevo de
  // `Usuario` (tipos.ts), otorgado por un Admin, que habilita a un Asistente/Editor puntual
  // a editar jornadas ajenas -- ver comentario extendido junto a `puedeEditarJornada`
  // (MisClasesView.tsx). Por defecto false/undefined hasta que Codex conecte el toggle en
  // Configuracion.tsx (ver COORDINACION CODEX ANTIGRAVITY - CENTRO ESTUDIOS.md).
  const permisoEdicionAgenda = usuario?.permisoEdicionAgenda;

  const hoyIso = React.useMemo(() => formatearFechaIso(new Date()), []);
  const [fechaReferencia, setFechaReferencia] = React.useState(hoyIso);
  const [jornadas, setJornadas] = React.useState<JornadaInstruccion[]>([]);
  const [materialPorJornadaId, setMaterialPorJornadaId] = React.useState<Record<string, string[]>>({});
  const [nombresPrograma, setNombresPrograma] = React.useState<Record<string, string>>({});
  const [nombresSede, setNombresSede] = React.useState<Record<string, string>>({});
  const [nombresInstructor, setNombresInstructor] = React.useState<Record<string, string>>({});
  // Checklist 12.8 (seccion 3 del documento de mejora): "Indicador de grados asociados".
  // El modelo real (JornadaInstruccion) no tiene un campo `grados` propio, sino `grupoId`
  // -- mismo mapeo ya establecido en 12.7 (ver PestanaProgramaJornada.tsx, campo "Grupo").
  const [nombresGrupo, setNombresGrupo] = React.useState<Record<string, string>>({});
  // Subtarea 12.9: el modal de edicion necesita las OPCIONES completas (arrays {id,nombre})
  // para los 5 selects de PestanaProgramaJornada, no solo los mapas id->nombre de arriba
  // (que alcanzan para el texto de la parrilla pero no para poblar un <select>). Se guarda
  // el `ContextoJornada` completo devuelto por obtenerContextoJornada (misma llamada que ya
  // se hace para armar los mapas de nombres, ver el useEffect de abajo -- no se duplica la
  // carga de red, solo se conserva el resultado completo ademas de los mapas derivados).
  const [contextoJornada, setContextoJornada] = React.useState<ContextoJornada>(CONTEXTO_VACIO);
  // Subtarea 12.9: jornada actualmente abierta en el modal de edicion singular (null =
  // modal cerrado). Vive en la misma vista semanal -- abrir el modal NO navega a otra ruta
  // ni pierde `fechaReferencia`/`rango` (secciones 4/5 del documento de mejora).
  const [jornadaEditando, setJornadaEditando] = React.useState<JornadaInstruccion | null>(null);
  // Subtarea 12.10: hora "actual" para el indicador de Clase en Vivo de cada bloque, ver
  // comentario de `INTERVALO_RECALCULO_INDICADOR_MS` arriba.
  const [ahoraIso, setAhoraIso] = React.useState(() => new Date().toISOString());
  // Hijos vinculados al Tutor (para filtrar la Agenda a sus clases). Vacío para no-Tutores.
  const [hijosTutor, setHijosTutor] = React.useState<Estudiante[]>([]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setAhoraIso(new Date().toISOString());
    }, INTERVALO_RECALCULO_INDICADOR_MS);
    return () => clearInterval(intervalId);
  }, []);

  // Resolver el/los estudiante(s) del consultor por su email de login (Tutor -> tutor.correo;
  // Estudiante -> correo). Mismo criterio que CentroEstudios/MiPerfil.
  React.useEffect(() => {
    if (!esConsultor || !tenantId || !usuarioEmail) return;
    let activo = true;
    resolveStudentsForConsultor(tenantId, usuarioEmail, esTutor).then((estudiantes) => {
      if (activo) setHijosTutor(estudiantes);
    });
    return () => { activo = false; };
  }, [esConsultor, esTutor, tenantId, usuarioEmail]);

  const rango: RangoSemana = React.useMemo(() => obtenerRangoSemana(fechaReferencia), [fechaReferencia]);

  // Subtarea 12.8 (rendimiento, seccion 21 del documento de mejora): se carga SOLO la
  // semana visible (rango.inicioIso/finIso), no todo el tenant.
  const cargarJornadas = React.useCallback(() => {
    repository.listarJornadasPorRangoFechas(tenantId, rango.inicioIso, rango.finIso).then((todas) => {
      // Las jornadas archivadas (2026-07-22) se ocultan de la parrilla sin borrarse: son
      // clases ya operadas que no se pueden eliminar ni cancelar y el admin decidio quitarlas
      // de la vista. El historial/reportes las siguen leyendo -- por eso el filtro va aca, en
      // la vista, y NO en el repositorio (que otros consumidores usan para leer todo).
      const datos = todas.filter((jornada) => !jornada.archivada);
      setJornadas(datos);

      // Mismo patron que MisClasesView.tsx: la carga de material es independiente de la
      // carga de jornadas, para que un fallo de permisos en asignaciones no impida
      // pintar la parrilla (que es la fuente principal de esta vista).
      listarAsignacionesPorTenant(tenantId)
        .then((asignaciones) => {
          const material: Record<string, string[]> = {};
          for (const jornada of datos) {
            material[jornada.id] = asignaciones
              .filter((asignacion) => asignacion.jornadaId === jornada.id)
              .map((asignacion) => asignacion.titulo);
          }
          setMaterialPorJornadaId(material);
        })
        .catch((materialError) => {
          console.warn('[AgendaView] No se pudo cargar el material asignado', materialError);
        });
    }).catch((jornadasError) => {
      // Hallazgo del smoke test manual (12.8): sin este catch, un fallo real de permisos
      // de Firestore en listarJornadasPorRangoFechas quedaba como promise rejection sin
      // manejar (mismo gap ya documentado para MisClasesView.cargar() en el registro de
      // cierre 11.8 de este archivo). No se crashea la vista (la grilla ya arranca vacia),
      // pero se deja constancia en consola en vez de un fallo silencioso sin traza.
      console.warn('[AgendaView] No se pudieron cargar las jornadas de la semana', jornadasError);
    });
  }, [repository, tenantId, rango.inicioIso, rango.finIso]);

  React.useEffect(() => {
    cargarJornadas();
  }, [cargarJornadas]);

  // Extension posterior al cierre del modulo 12 (icono de eliminar directo en la
  // parrilla): reutiliza el MISMO flujo de confirmacion + eliminarJornadaSegura + auditoria
  // que ya usa el boton "Eliminar clase" de ModalEdicionJornada.tsx (12.6/12.9), extraido a
  // `useEliminacionJornadaSegura` para no duplicar esa logica en dos componentes. Al exito
  // (borrado fisico o cancelacion de fallback), refresca la semana visible -- mismo patron
  // que `onGuardado`/`onEliminada` del modal (`cargarJornadas()`, no un update in-memory
  // quirurgico, decision ya documentada en el cierre de 12.9).
  const eliminacion = useEliminacionJornadaSegura({
    repository,
    tenantId,
    usuarioId,
    rol,
    fuente: 'agenda',
    onEliminada: () => cargarJornadas(),
  });

  // Nombres legibles de programa/sede/instructor: mismo servicio que ya usa JornadasView
  // (obtenerContextoJornada), para no duplicar la logica de resolucion de nombres. Si un
  // id no tiene nombre resuelto (p.ej. contexto aun cargando), se muestra el id crudo
  // como fallback -- mismo criterio que JornadasView.tsx.
  React.useEffect(() => {
    let activo = true;
    obtenerContextoJornada(tenantId)
      .then((contexto) => {
        if (!activo) return;
        setNombresPrograma(Object.fromEntries(contexto.programas.map((item) => [item.id, item.nombre])));
        setNombresSede(Object.fromEntries(contexto.sedes.map((item) => [item.id, item.nombre])));
        setNombresInstructor(Object.fromEntries(contexto.instructores.map((item) => [item.id, item.nombre])));
        setNombresGrupo(Object.fromEntries(contexto.grupos.map((item) => [item.id, item.nombre])));
        setContextoJornada(contexto);
      })
      .catch(() => {
        if (activo) {
          setNombresPrograma({});
          setNombresSede({});
          setNombresInstructor({});
          setNombresGrupo({});
          setContextoJornada(CONTEXTO_VACIO);
        }
      });
    return () => {
      activo = false;
    };
  }, [tenantId]);

  // Fix tutor-role-end-to-end (2026-07-14): para el Tutor, la Agenda muestra SOLO las
  // clases que aplican a su(s) hijo(s): misma sede y mismo grupo del estudiante, y que su
  // grado no esté excluido de esa jornada puntual. `normGrupo` tolera ambos formatos de
  // grupoId (crudo "Infantil" o derivado "grupo-infantil"). Para otros roles, sin cambios.
  const jornadasVisibles = React.useMemo(() => {
    if (!esConsultor) return jornadas;
    if (hijosTutor.length === 0) return [];
    const normGrupo = (g?: string) => String(g ?? '').toLowerCase().replace(/\s+/g, '-').replace(/^grupo-/, '');
    return jornadas.filter((j) =>
      hijosTutor.some((hijo) =>
        j.sedeId === hijo.sedeId &&
        normGrupo(j.grupoId) === normGrupo(hijo.grupo) &&
        !(j.gradosExcluidos ?? []).includes(hijo.grado)
      )
    );
  }, [esConsultor, hijosTutor, jornadas]);

  const jornadasPorFecha = React.useMemo(() => agruparJornadasPorFecha(jornadasVisibles), [jornadasVisibles]);

  // Simplificado 2026-07-17, segunda vuelta (pedido explicito del usuario: "que no queden
  // espacios en blanco como vacios"). La grilla ya NO es un eje continuo de horas -- es un
  // conjunto de FILAS DISCRETAS, una por cada franja horaria exacta que realmente tiene
  // alguna jornada ACTIVA esa semana (para ESTE usuario: ya filtradas por jornadasVisibles,
  // asi que un Tutor ve solo las franjas de las clases de su hijo, no las del tenant
  // completo). Sin jornadas esa semana -> lista vacia, la vista muestra un estado vacio
  // explicito en vez de una grilla fija sin contenido.
  const filasHorario = React.useMemo(() => calcularFilasHorarioAgenda(jornadasVisibles), [jornadasVisibles]);

  const irSemanaAnterior = () => setFechaReferencia((actual) => sumarSemanas(actual, -1));
  const irSemanaSiguiente = () => setFechaReferencia((actual) => sumarSemanas(actual, 1));
  const irSemanaActual = () => setFechaReferencia(hoyIso);

  return (
    <section aria-label="Agenda semanal" className="p-6 sm:p-10 space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Centro de Estudios
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Agenda
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Parrilla semanal de clases programadas.
        </p>
        {/* Referencia visual pedida explicitamente por el usuario (2026-07-17): que quede
            claro que esto es una vista COMPACTA -- solo se muestran las franjas horarias
            que realmente tienen clases activas esa semana, no el dia completo. */}
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-tkd-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-tkd-blue">
          ● Vista compacta — solo horarios con clases activas esta semana
        </span>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={irSemanaAnterior}
            aria-label="Semana anterior"
            className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-red hover:text-tkd-red dark:border-white/10 dark:text-white"
          >
            &larr; Semana anterior
          </button>
          <button
            type="button"
            onClick={irSemanaActual}
            aria-label="Semana actual"
            className="rounded-xl bg-tkd-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-700"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={irSemanaSiguiente}
            aria-label="Semana siguiente"
            className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-red hover:text-tkd-red dark:border-white/10 dark:text-white"
          >
            Semana siguiente &rarr;
          </button>
        </div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
          {rango.inicioIso} - {rango.finIso}
        </p>
      </div>

      {/* Simplificado 2026-07-17, segunda vuelta (pedido explicito del usuario: nada de eje
          continuo de horas con huecos vacios en el medio -- una FILA por franja horaria
          exacta que realmente tiene clases esa semana, ver agendaSemanalService.ts). */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px] space-y-2">
          <div className="grid grid-cols-[110px_repeat(7,1fr)] gap-2">
            <div />
            {DIAS_SEMANA.map((dia, indice) => (
              <div key={dia.etiqueta} className="text-center">
                <p className="text-xs font-black uppercase tracking-widest text-tkd-dark dark:text-white">
                  {dia.etiqueta}
                </p>
                <p className="text-[10px] font-bold text-gray-400">{rango.diasIso[indice]}</p>
              </div>
            ))}
          </div>

          {filasHorario.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-bold text-gray-400">No hay clases activas programadas esta semana.</p>
            </div>
          ) : (
            filasHorario.map((franja) => (
              <div key={`${franja.horaInicio}-${franja.horaFin}`} className="grid grid-cols-[110px_repeat(7,1fr)] gap-2">
                <div className="flex items-center justify-end pr-2 text-right text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {franja.horaInicio} - {franja.horaFin}
                </div>

                {DIAS_SEMANA.map((_, indice) => {
                  const fechaIso = rango.diasIso[indice];
                  // Solo las jornadas de ESTE dia que caen EXACTO en esta franja -- si hay
                  // 2+ (mismo dia, mismo horario exacto, distinto programa/grupo), se
                  // layoutean lado a lado abajo, nunca superpuestas.
                  const jornadasDeLaCelda = (jornadasPorFecha[fechaIso] ?? []).filter(
                    (jornada) => jornada.horaInicio === franja.horaInicio && jornada.horaFin === franja.horaFin,
                  );
                  const haySimultaneas = jornadasDeLaCelda.length > 1;

                  return (
                    <div
                      key={fechaIso}
                      className="flex gap-1 rounded-2xl border border-gray-100 bg-gray-50 p-1 dark:border-white/10 dark:bg-white/5"
                    >
                      {jornadasDeLaCelda.map((jornada) => {
                        // Extension posterior al cierre del modulo 12 (matriz de roles de
                        // Agenda): `puedeEditar` usa la matriz completa (Admin/SuperAdmin
                        // siempre, Maestro solo su clase, Asistente/Editor solo con
                        // permisoEdicionAgenda, Estudiante/Tutor nunca) en vez de solo
                        // esAdmin/instructorId.
                        const puedeEditar = puedeEditarJornada(jornada, usuarioId, esAdmin, { rol, permisoEdicionAgenda });
                        // Ampliacion posterior al cierre inicial de esta extension (decision
                        // de producto explicita del usuario, ver CIERRE CENTRO DE
                        // ESTUDIOS.md): el icono de eliminar de la parrilla ya NO se
                        // restringe a esAdmin -- usa la MISMA matriz completa que
                        // `puedeEditar`. Se colapsa a la MISMA variable (no se duplica la
                        // logica): editar y eliminar comparten criterio.
                        const puedeEliminarDesdeParrilla = puedeEditar;
                        const nombrePrograma = nombresPrograma[jornada.programaId] ?? jornada.programaId;
                        const nombreSede = nombresSede[jornada.sedeId] ?? jornada.sedeId;
                        const nombreInstructor = nombresInstructor[jornada.instructorId] ?? jornada.instructorId;
                        const nombreGrupo = nombresGrupo[jornada.grupoId] ?? jornada.grupoId;
                        const material = materialPorJornadaId[jornada.id] ?? [];
                        // Subtarea 12.8: decision documentada -- las clases canceladas NO se
                        // excluyen del render (se pierde visibilidad de que existio/se
                        // cancelo una clase esa fecha/hora), se muestran atenuadas (opacity
                        // reducida) con el badge "Cancelada" del indicador de Clase en Vivo.
                        const esCancelada = jornada.estado === 'cancelada';
                        const indicadorClaseEnVivo = calcularIndicadorClaseEnVivo(
                          { fecha: jornada.fecha, horaInicio: jornada.horaInicio, horaFin: jornada.horaFin, estado: jornada.estado },
                          ahoraIso,
                        );
                        const estiloIndicadorClaseEnVivo = ESTILO_POR_INDICADOR_CLASE_EN_VIVO[indicadorClaseEnVivo];

                        return (
                          <article
                            key={jornada.id}
                            data-testid={`bloque-jornada-${jornada.id}`}
                            // Simplificado 2026-07-17: sin posicion CSS absoluta -- cada
                            // bloque es un hijo flex normal. Si hay 2+ jornadas simultaneas
                            // en la misma celda (mismo dia+franja), min-w-0 deja que cada
                            // una se achique al 50% en vez de desbordar, y el borde
                            // izquierdo ambar + el badge "Simultanea" marcan la distincion
                            // visual pedida explicitamente (que no se tapen ni se anulen).
                            className={`min-w-0 flex-1 flex flex-col gap-0.5 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 text-[10px] shadow-sm dark:border-white/10 dark:bg-gray-900 ${esCancelada ? 'opacity-50' : ''} ${haySimultaneas ? 'border-l-4 border-l-amber-400 dark:border-l-amber-500' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-black text-tkd-dark dark:text-white truncate">{nombrePrograma}</p>
                              {/* Extension posterior al cierre del modulo 12: editar+eliminar
                                  en una misma linea horizontal, a la altura del encabezado
                                  (nombre del programa) del bloque -- especificacion explicita
                                  del usuario. */}
                              {(puedeEditar || puedeEliminarDesdeParrilla) && (
                                <div className="flex shrink-0 items-center gap-1">
                                  {puedeEditar && (
                                    <button
                                      type="button"
                                      aria-label={`Editar clase ${jornada.horaInicio}`}
                                      // Subtarea 12.9: abre el modal de edicion singular sobre
                                      // la misma jornada clickeada, sin salir de la vista
                                      // semanal.
                                      onClick={() => setJornadaEditando(jornada)}
                                      className="text-gray-400 hover:text-tkd-red"
                                    >
                                      <IconoEditar className="h-3 w-3" />
                                    </button>
                                  )}
                                  {puedeEliminarDesdeParrilla && (
                                    <button
                                      type="button"
                                      aria-label={`Eliminar clase ${jornada.horaInicio}`}
                                      // Icono nuevo (desviacion consciente de la seccion 4 del
                                      // documento original, pedida explicitamente por el
                                      // usuario): dispara el MISMO flujo de confirmacion +
                                      // eliminarJornadaSegura + auditoria que ya vivia dentro
                                      // de ModalEdicionJornada.tsx, via el hook compartido
                                      // useEliminacionJornadaSegura -- sin necesidad de abrir
                                      // el modal completo de 2 pestanas. Visible para
                                      // Maestro/Asistente-Editor bajo la matriz ampliada de
                                      // `puedeEliminarDesdeParrilla` de arriba;
                                      // `eliminarJornadaSegura` sigue aplicando la guarda de
                                      // 12.6 (asistencia/clase operada) antes de tocar
                                      // Firestore, sin importar quien la invoque.
                                      onClick={() => eliminacion.iniciar(jornada)}
                                      className="text-gray-400 hover:text-tkd-red"
                                    >
                                      <IconoEliminar className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {haySimultaneas && (
                              <span className="w-fit rounded-full bg-amber-100 px-1.5 py-0.5 font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                ⚡ Simultánea
                              </span>
                            )}
                            <p className="text-gray-500 dark:text-gray-300">{jornada.horaInicio} - {jornada.horaFin}</p>
                            <p className="truncate text-gray-500 dark:text-gray-300">Sede: {nombreSede}</p>
                            <p className="truncate text-gray-500 dark:text-gray-300">Maestro: {nombreInstructor}</p>
                            <p className="truncate text-gray-500 dark:text-gray-300">Grupo: {nombreGrupo}</p>
                            <span
                              data-testid={`indicador-clase-en-vivo-${jornada.id}`}
                              className={`w-fit rounded-full px-1.5 py-0.5 font-black uppercase tracking-widest ${estiloIndicadorClaseEnVivo.bg} ${estiloIndicadorClaseEnVivo.text}`}
                            >
                              {estiloIndicadorClaseEnVivo.etiqueta}
                            </span>
                            <p className="truncate text-gray-500 dark:text-gray-300">
                              {material.length > 0 ? `Material: ${material.join(', ')}` : 'Material pendiente'}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {jornadaEditando && (
        // Subtarea 12.9: modal dentro de la MISMA vista (seccion 4/5 del documento de
        // mejora) -- no hay navegacion de ruta, `fechaReferencia`/`rango` no se tocan.
        <ModalEdicionJornada
          jornada={jornadaEditando}
          tenantId={tenantId}
          usuarioId={usuarioId}
          esAdmin={esAdmin}
          rol={rol}
          permisoEdicionAgenda={permisoEdicionAgenda}
          opciones={contextoJornada}
          repository={repository}
          onCerrar={() => setJornadaEditando(null)}
          // Seccion 20/21: tras guardar, refrescar solo la semana visible (cargarJornadas
          // ya filtra por rango.inicioIso/finIso, que no cambian aca) en vez de recargar
          // toda la app. El propio modal decide cuándo cerrarse (se queda abierto si hubo
          // una advertencia de auditoria no bloqueante) -- por eso este handler NO cierra
          // el modal, solo refresca los datos.
          onGuardado={() => cargarJornadas()}
          onEliminada={() => cargarJornadas()}
        />
      )}

      {eliminacion.jornada && (
        // Extension posterior al cierre del modulo 12: confirmacion de eliminar disparada
        // DIRECTO desde el icono de caneca de la parrilla (sin abrir ModalEdicionJornada).
        // `role="alertdialog"` (distinto de `role="dialog"` del modal de 2 pestanas de
        // arriba) para que los tests puedan distinguir ambos flujos sin ambiguedad.
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={`Eliminar clase ${eliminacion.jornada.horaInicio}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl dark:bg-gray-900">
            {eliminacion.error ? (
              <div className="space-y-3 text-sm font-bold text-red-700">
                <p>{eliminacion.error.mensaje}</p>
                <div className="flex flex-wrap gap-2">
                  {eliminacion.error.ofrecerCancelar && (
                    <button
                      type="button"
                      onClick={() => eliminacion.cancelarEnLugarDeEliminar()}
                      disabled={eliminacion.eliminando}
                      className="rounded-xl bg-tkd-red px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar la clase en su lugar
                    </button>
                  )}
                  {/* Salida universal: si la clase ya se opero (cerrada/parcial) no se puede
                      eliminar ni cancelar. Archivar la oculta de la parrilla sin borrarla ni
                      tocar su historial. Sigue disponible aunque cancelar tambien falle. */}
                  {eliminacion.error.ofrecerArchivar && (
                    <button
                      type="button"
                      onClick={() => eliminacion.archivar()}
                      disabled={eliminacion.eliminando}
                      className="rounded-xl bg-tkd-dark px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
                    >
                      Quitar de la agenda
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminacion.cerrar()}
                    disabled={eliminacion.eliminando}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tkd-dark dark:border-white/10 dark:text-white"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-bold text-tkd-dark dark:text-white">{MENSAJE_CONFIRMACION_ELIMINAR_CLASE}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => eliminacion.confirmar()}
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
          </div>
        </div>
      )}
    </section>
  );
};

export default AgendaView;
