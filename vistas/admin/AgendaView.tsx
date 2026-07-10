import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RolUsuario } from '../../tipos';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import {
  jornadaRepository,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
import { puedeEditarJornada } from './MisClasesView';
import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import { obtenerContextoJornada } from '../../servicios/academico/jornadaContextService';
import {
  DIAS_SEMANA,
  obtenerHorasGrilla,
  obtenerRangoSemana,
  sumarSemanas,
  agruparJornadasPorFecha,
  calcularPosicionBloque,
  formatearFechaIso,
  type RangoSemana,
} from '../../servicios/academico/agendaSemanalService';
import { IconoEditar } from '../../components/Iconos';

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
// `isInstructor()` en firestore.rules: Admin/Editor/Asistente/SuperAdmin. La gate real de
// la RUTA vive en App.tsx (con el mismo set de roles); este componente no necesita
// replicarla porque asume que ya paso ese gate, pero se documenta aca para que quede
// claro el criterio compartido.
export const ROLES_CON_ACCESO_AGENDA: RolUsuario[] = [
  RolUsuario.Admin,
  RolUsuario.Editor,
  RolUsuario.Asistente,
  RolUsuario.SuperAdmin,
];

interface AgendaViewProps {
  repository?: JornadaRepository;
}

// Subtarea 12.8: mismo mapeo de color por estado ya usado en MisClasesView.tsx (Fase
// 3.7), reutilizado aca para consistencia visual entre las dos vistas de jornadas.
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

const AgendaView: React.FC<AgendaViewProps> = ({ repository = jornadaRepository }) => {
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? 'tenant-local';
  const usuarioId = usuario?.id ?? '';
  // Subtarea 12.8: mismo criterio ya usado por AsignacionesView.tsx al embeber
  // MisClasesView (esAdmin = Admin || SuperAdmin) -- Admin/SuperAdmin pueden editar
  // cualquier jornada, el resto solo la suya (ver puedeEditarJornada, 12.2).
  const esAdmin = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin;

  const hoyIso = React.useMemo(() => formatearFechaIso(new Date()), []);
  const [fechaReferencia, setFechaReferencia] = React.useState(hoyIso);
  const [jornadas, setJornadas] = React.useState<JornadaInstruccion[]>([]);
  const [materialPorJornadaId, setMaterialPorJornadaId] = React.useState<Record<string, string[]>>({});
  const [nombresPrograma, setNombresPrograma] = React.useState<Record<string, string>>({});
  const [nombresSede, setNombresSede] = React.useState<Record<string, string>>({});
  const [nombresInstructor, setNombresInstructor] = React.useState<Record<string, string>>({});

  const rango: RangoSemana = React.useMemo(() => obtenerRangoSemana(fechaReferencia), [fechaReferencia]);
  const horas = React.useMemo(() => obtenerHorasGrilla(), []);

  // Subtarea 12.8 (rendimiento, seccion 21 del documento de mejora): se carga SOLO la
  // semana visible (rango.inicioIso/finIso), no todo el tenant.
  const cargarJornadas = React.useCallback(() => {
    repository.listarJornadasPorRangoFechas(tenantId, rango.inicioIso, rango.finIso).then((datos) => {
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
      })
      .catch(() => {
        if (activo) {
          setNombresPrograma({});
          setNombresSede({});
          setNombresInstructor({});
        }
      });
    return () => {
      activo = false;
    };
  }, [tenantId]);

  const jornadasPorFecha = React.useMemo(() => agruparJornadasPorFecha(jornadas), [jornadas]);

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

      {/* Subtarea 12.8: filas horarias 7:00-22:00 fijas, intervalo de 60 min fijo (ver
          agendaSemanalService.ts para la justificacion documentada de estos atajos). */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[64px_repeat(7,1fr)] gap-2">
          <div />
          {DIAS_SEMANA.map((dia, indice) => (
            <div key={dia.etiqueta} className="text-center">
              <p className="text-xs font-black uppercase tracking-widest text-tkd-dark dark:text-white">
                {dia.etiqueta}
              </p>
              <p className="text-[10px] font-bold text-gray-400">{rango.diasIso[indice]}</p>
            </div>
          ))}

          <div className="relative" style={{ height: `${horas.length * 48}px` }}>
            {horas.map((hora) => (
              <div
                key={hora}
                className="absolute right-1 -translate-y-1/2 text-[10px] font-bold text-gray-400"
                style={{ top: `${(horas.indexOf(hora) / (horas.length - 1)) * 100}%` }}
              >
                {hora}
              </div>
            ))}
          </div>

          {DIAS_SEMANA.map((_, indice) => {
            const fechaIso = rango.diasIso[indice];
            const jornadasDia = jornadasPorFecha[fechaIso] ?? [];

            return (
              <div
                key={fechaIso}
                className="relative rounded-2xl border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5"
                style={{ height: `${horas.length * 48}px` }}
              >
                {jornadasDia.map((jornada) => {
                  const posicion = calcularPosicionBloque(jornada.horaInicio, jornada.horaFin);
                  const puedeEditar = puedeEditarJornada(jornada, usuarioId, esAdmin);
                  const nombrePrograma = nombresPrograma[jornada.programaId] ?? jornada.programaId;
                  const nombreSede = nombresSede[jornada.sedeId] ?? jornada.sedeId;
                  const nombreInstructor = nombresInstructor[jornada.instructorId] ?? jornada.instructorId;
                  const material = materialPorJornadaId[jornada.id] ?? [];
                  const estilo = ESTILO_POR_ESTADO[jornada.estado];
                  // Subtarea 12.8: decision documentada -- las clases canceladas NO se
                  // excluyen del render (se pierde visibilidad de que existio/se cancelo
                  // una clase esa fecha/hora), se muestran atenuadas (opacity reducida)
                  // con el badge de estado "Cancelada" ya presente en ESTILO_POR_ESTADO.
                  const esCancelada = jornada.estado === 'cancelada';

                  return (
                    <article
                      key={jornada.id}
                      data-testid={`bloque-jornada-${jornada.id}`}
                      className={`absolute left-1 right-1 flex flex-col gap-0.5 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 text-[10px] shadow-sm dark:border-white/10 dark:bg-gray-900 ${esCancelada ? 'opacity-50' : ''}`}
                      style={{ top: `${posicion.topPercent}%`, height: `${posicion.heightPercent}%` }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-black text-tkd-dark dark:text-white truncate">{nombrePrograma}</p>
                        {puedeEditar && (
                          <button
                            type="button"
                            aria-label={`Editar clase ${jornada.horaInicio}`}
                            // Subtarea 12.9 conecta esto al modal de edicion singular de
                            // Agenda (todavia no existe). Por ahora, sin accion real: el
                            // icono solo refleja el gating de permisos de 12.2.
                            onClick={() => {}}
                            className="shrink-0 text-gray-400 hover:text-tkd-red"
                          >
                            <IconoEditar className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-300">{jornada.horaInicio} - {jornada.horaFin}</p>
                      <p className="truncate text-gray-500 dark:text-gray-300">Sede: {nombreSede}</p>
                      <p className="truncate text-gray-500 dark:text-gray-300">Maestro: {nombreInstructor}</p>
                      <span className={`w-fit rounded-full px-1.5 py-0.5 font-black uppercase tracking-widest ${estilo.bg} ${estilo.text}`}>
                        {estilo.etiqueta}
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
      </div>
    </section>
  );
};

export default AgendaView;
