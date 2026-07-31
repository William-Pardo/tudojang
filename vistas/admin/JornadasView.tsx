import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { EjecucionPrograma, ProgramaAcademico } from '../../models/academico/programa';
import { useAuth } from '../../context/AuthContext';
import { RolUsuario } from '../../tipos';
import { cerrarJornadaConPrograma } from '../../servicios/academico/closeJornada';
import {
  obtenerContextoJornada,
  type OpcionJornada,
} from '../../servicios/academico/jornadaContextService';
import {
  jornadaRepository,
  mensajeConflictoHorario,
  ConflictoConcurrenciaError,
  diffCambiosJornada,
  MENSAJE_ADVERTENCIA_AUDITORIA,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
import {
  createJornada,
  confirmarJornada,
  iniciarJornada,
  marcarPendienteCierre,
} from '../../servicios/academico/jornadaService';
import {
  asistenciaRepository as asistenciaRepositoryPorDefecto,
  type AsistenciaRepository,
} from '../../servicios/academico/asistenciaRepository';
import { contarCheckIns } from '../../servicios/academico/asistenciaService';
import {
  assignProgramaToGrupo,
  createPrograma,
  publishPrograma,
} from '../../servicios/academico/programaService';
import PestanaProgramaJornada from '../../components/academico/PestanaProgramaJornada';
import type { MarcadorSoporte } from '../../shared/soporte/tipos';

// Marcador vivo del catalogo de soporte (openspec/changes/catalogo-soporte-marcadores-vivos):
// entrada nueva -- JornadasView no tenia cobertura previa en `shared/soporte/catalogo.v1.ts`.
// Distinta de `agenda.manage` (parrilla semanal, crear/editar/eliminar/reprogramar clases desde
// `AgendaView.tsx`): esta vista opera UNA jornada puntual a lo largo de su ciclo de vida
// (confirmar -> iniciar -> cerrar), con asistencia y objetivos impartidos. `introducedIn` lo
// estampa el generador desde `catalogVersion` -- ver `MarcadorSoporte` en shared/soporte/tipos.ts.
export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'jornadas.manage',
        inventoryId: 'jornadas.manage',
        module: 'jornadas',
        label: 'Plan y cierre de clase (Jornadas)',
        intent: 'Orientar sobre plan y cierre de clase (jornadas).',
        aliases: [
            'confirmar jornada',
            'iniciar jornada',
            'cerrar jornada',
            'cerrar clase',
            'plan de clase',
            'registrar asistencia jornada',
            'objetivos impartidos',
        ],
        actions: ['confirmar', 'iniciar', 'cerrar', 'registrar'],
        negativeTerms: ['editar horario', 'eliminar clase', 'reprogramar clase', 'cancelar clase'],
        roles: ['Admin', 'Editor'],
        steps: [
            'Abre Jornadas desde el menú lateral.',
            'Revisa el programa, sede, espacio e instructor asignados y confirma la jornada.',
            'Al llegar la hora, inicia la jornada y marca el objetivo saludo impartido.',
            'Cierra la jornada al finalizar la clase; los check-ins de asistencia se cuentan automáticamente.',
        ],
        route: '/jornadas',
        sensitivity: 'privileged',
        escalationReason: 'Escalar si la pantalla, los permisos o los datos no coinciden con estos pasos.',
        sourceFiles: ['vistas/admin/JornadasView.tsx'],
        authorizationRef: 'App.tsx#/jornadas requiere RolUsuario.Admin o RolUsuario.Editor',
        owner: 'Producto y Soporte Tudojang',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

function crearProgramaBase(tenantId: string): ProgramaAcademico {
  return publishPrograma(createPrograma({
  tenantId,
  nombre: 'Programa base',
  descripcion: 'Fundamentos iniciales',
  unidades: [
    {
      id: 'unidad-1',
      nombre: 'Fundamentos',
      orden: 1,
      objetivos: [
        { id: 'obj-saludo', descripcion: 'Saludo', orden: 1 },
        { id: 'obj-patada', descripcion: 'Patada', orden: 2 },
      ],
    },
  ],
  }));
}

function crearEstadoInicialJornada(tenantId: string, instructorId: string) {
  const programa = crearProgramaBase(tenantId);
  const ejecucion = assignProgramaToGrupo(programa, {
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    fechaInicio: '2026-06-27',
  });
  const jornada = createJornada({
    tenantId,
    programaId: programa.id,
    ejecucionProgramaId: ejecucion.id,
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId,
    fecha: '2026-06-27',
    horaInicio: '08:00',
    horaFin: '09:00',
    objetivosPlaneados: ['obj-saludo', 'obj-patada'],
  });

  return { programa, ejecucion, jornada };
}

function etiquetaEstado(estado: JornadaInstruccion['estado']) {
  return estado.replace('_', ' ');
}

const gruposFallback: OpcionJornada[] = [
  { id: 'grupo-infantil', nombre: 'Grupo infantil' },
  { id: 'grupo-precadetes', nombre: 'Grupo precadetes' },
];

const sedesFallback: OpcionJornada[] = [
  { id: 'sede-principal', nombre: 'Sede principal' },
  { id: 'sede-norte', nombre: 'Sede norte' },
];

const espaciosFallback: OpcionJornada[] = [
  { id: 'tatami-1', nombre: 'Tatami 1' },
  { id: 'tatami-2', nombre: 'Tatami 2' },
];

const instructoresFallback: OpcionJornada[] = [
  { id: 'maestro-local', nombre: 'Maestro local' },
];

const programasFallback: OpcionJornada[] = [
  { id: 'programa-base', nombre: 'Programa base' },
];

interface JornadasViewProps {
  embedded?: boolean;
  repository?: JornadaRepository;
  asistenciaRepository?: AsistenciaRepository;
  onJornadaSeleccionada?: (jornada: JornadaInstruccion) => void;
}

const JornadasView: React.FC<JornadasViewProps> = ({
  embedded = false,
  repository = jornadaRepository,
  asistenciaRepository = asistenciaRepositoryPorDefecto,
  onJornadaSeleccionada,
}) => {
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? 'tenant-local';
  const instructorId = usuario?.id ?? 'maestro-local';
  const estadoInicial = React.useMemo(
    () => crearEstadoInicialJornada(tenantId, instructorId),
    [tenantId, instructorId]
  );
  const [programa] = React.useState<ProgramaAcademico>(estadoInicial.programa);
  const [jornada, setJornada] = React.useState<JornadaInstruccion>(estadoInicial.jornada);
  const [ejecucion, setEjecucion] = React.useState<EjecucionPrograma>(estadoInicial.ejecucion);
  // Fase 2: `asistenciaRegistrada` ya no es estado manual (checkbox), se deriva del
  // conteo real de check-ins en la subcoleccion `asistencias` escrita server-side por
  // el callable `registrarAsistenciaJornada` (design.md, Data Flow).
  const [cantidadCheckIns, setCantidadCheckIns] = React.useState(0);
  const asistenciaRegistrada = cantidadCheckIns > 0;
  const [objetivoSaludoImpartido, setObjetivoSaludoImpartido] = React.useState(false);
  const [refuerzosPublicados, setRefuerzosPublicados] = React.useState<string[]>([]);
  const [opciones, setOpciones] = React.useState({
    programas: programasFallback,
    grupos: gruposFallback,
    sedes: sedesFallback,
    espacios: espaciosFallback,
    instructores: instructoresFallback,
  });
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let activo = true;
    obtenerContextoJornada(tenantId)
      .then((contexto) => {
        if (!activo) return;
        setOpciones({
          programas: contexto.programas.length ? contexto.programas : programasFallback,
          grupos: contexto.grupos.length ? contexto.grupos : gruposFallback,
          sedes: contexto.sedes.length ? contexto.sedes : sedesFallback,
          espacios: contexto.espacios.length ? contexto.espacios : espaciosFallback,
          instructores: contexto.instructores.length ? contexto.instructores : instructoresFallback,
        });
      })
      .catch(() => {
        if (activo) {
          setOpciones({
            programas: programasFallback,
            grupos: gruposFallback,
            sedes: sedesFallback,
            espacios: espaciosFallback,
            instructores: instructoresFallback,
          });
        }
      });

    return () => {
      activo = false;
    };
  }, [tenantId]);

  // Fase 2: cuenta check-ins reales de la subcoleccion `asistencias` de esta jornada
  // para derivar `asistenciaRegistrada` en vez del checkbox manual anterior.
  React.useEffect(() => {
    let activo = true;
    asistenciaRepository.listarPorJornada(jornada.tenantId, jornada.id)
      .then((registros) => {
        if (activo) setCantidadCheckIns(contarCheckIns(registros));
      })
      .catch(() => {
        if (activo) setCantidadCheckIns(0);
      });

    return () => {
      activo = false;
    };
  }, [asistenciaRepository, jornada.tenantId, jornada.id]);

  const registrarCambio = async (
    jornadaActualizada: JornadaInstruccion,
    accion: 'confirmar' | 'iniciar' | 'cerrar',
    ejecucionActualizada?: EjecucionPrograma,
  ) => {
    // Subtarea 12.4: `jornada` (estado del componente) es la version que se leyo antes de
    // mutar, asi que sigue siendo la base correcta para el bloqueo optimista aca.
    await repository.guardarJornada(jornadaActualizada, { actualizadoEnEsperado: jornada.actualizadoEn });
    if (ejecucionActualizada) {
      await repository.guardarEjecucion(ejecucionActualizada);
    }
    try {
      await repository.registrarAuditoria({
        tenantId: jornadaActualizada.tenantId,
        jornadaId: jornadaActualizada.id,
        usuarioId: jornadaActualizada.instructorId,
        // Subtarea 12.5: rol de quien hizo el cambio y fuente (esta vista es "jornadas").
        rol: usuario?.rol ?? RolUsuario.Editor,
        fuente: 'jornadas',
        accion,
        // Subtarea 12.5: diff campo por campo (anterior/nuevo) contra la jornada que
        // todavia estaba en el estado del componente al momento de mutar.
        cambios: diffCambiosJornada(jornada, jornadaActualizada),
      });
    } catch (err) {
      console.warn('[CentroEstudios] No se pudo registrar auditoria de jornada', err);
      // Subtarea 12.5: el guardado principal ya se aplico y no se revierte (no hay
      // transaccion/rollback), pero el fallo de auditoria ya no queda silencioso.
      setError(MENSAJE_ADVERTENCIA_AUDITORIA);
    }
  };

  const confirmar = async () => {
    setError('');
    try {
      const resultadoConflicto = await repository.existeConflictoHorario(jornada);
      if (resultadoConflicto.hayConflicto) {
        setError(mensajeConflictoHorario(resultadoConflicto, jornada));
        return;
      }
      const confirmada = confirmarJornada({
        ...jornada,
        actualizadoEn: new Date().toISOString(),
      });
      await registrarCambio(confirmada, 'confirmar');
      setJornada(confirmada);
      onJornadaSeleccionada?.(confirmada);
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la jornada.');
    }
  };

  const iniciar = async () => {
    setError('');
    try {
      const enCurso = iniciarJornada(jornada);
      await registrarCambio(enCurso, 'iniciar');
      setJornada(enCurso);
      onJornadaSeleccionada?.(enCurso);
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la jornada.');
    }
  };

  const cerrar = async () => {
    setError('');
    try {
      const pendiente = marcarPendienteCierre(jornada, {
        asistenciaRegistrada,
        objetivosImpartidos: objetivoSaludoImpartido ? ['obj-saludo'] : [],
      });
      const resultado = cerrarJornadaConPrograma({
        jornada: pendiente,
        programa,
        ejecucion,
      });
      // Subtarea 12.5: `objetivosPendientesRefuerzo` no es un campo de JornadaInstruccion
      // (es un resultado derivado de cerrarJornadaConPrograma), asi que no forma parte del
      // diff campo por campo de la jornada. estado/asistenciaRegistrada/objetivosImpartidos
      // si son campos reales y quedan cubiertos automaticamente por diffCambiosJornada.
      await registrarCambio(resultado.jornada, 'cerrar', resultado.ejecucion);
      setJornada(resultado.jornada);
      setEjecucion(resultado.ejecucion);
      setRefuerzosPublicados(resultado.objetivosPendientesRefuerzo);
      onJornadaSeleccionada?.(resultado.jornada);
    } catch (err) {
      if (err instanceof ConflictoConcurrenciaError) {
        setError(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la jornada.');
    }
  };

  return (
    <section className={embedded ? 'space-y-6' : 'p-6 sm:p-10 space-y-8'}>
      {!embedded && (
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
            Centro de Estudios
          </p>
          <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
            Plan y cierre de clase
          </h1>
          <p className="mt-2 text-sm font-bold text-gray-400">
            Agenda operativa para confirmar, ejecutar y cerrar sesiones tecnicas.
          </p>
        </header>
      )}

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 space-y-5">
        {embedded && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
              Paso 3A · Contexto
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Elegir clase
            </h2>
            <p className="mt-2 text-sm font-bold text-gray-400">
              Selecciona la clase que recibirá o contextualizará el material.
            </p>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Estado: {etiquetaEstado(jornada.estado)}
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              {opciones.grupos.find((grupo) => grupo.id === jornada.grupoId)?.nombre ?? jornada.grupoId}
            </h2>
            <p className="mt-2 text-sm font-bold text-gray-500">
              {jornada.fecha} - {jornada.horaInicio} - {jornada.horaFin}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Programa</p>
              <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white">{opciones.programas.find((item) => item.id === jornada.programaId)?.nombre ?? jornada.programaId}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sede</p>
              <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white">{opciones.sedes.find((item) => item.id === jornada.sedeId)?.nombre ?? jornada.sedeId}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Espacio</p>
              <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white">{opciones.espacios.find((item) => item.id === jornada.espacioId)?.nombre ?? jornada.espacioId}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Instructor</p>
              <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white">{opciones.instructores.find((item) => item.id === jornada.instructorId)?.nombre ?? jornada.instructorId}</p>
            </div>
          </div>
        </div>
        {jornada.estado === 'borrador' && (
          // Subtarea 12.7 (Parte 1): el formulario inline se extrajo a PestanaProgramaJornada
          // (mismo markup/labels/ids, mismo comportamiento). La unica logica que se queda aca
          // es la del contenedor: el cambio de programa sincroniza tambien la ejecucion, que
          // es estado propio de esta vista y no del formulario presentacional.
          <PestanaProgramaJornada
            jornada={jornada}
            opciones={opciones}
            onProgramaChange={(programaId) => {
              setJornada((actual) => ({ ...actual, programaId }));
              setEjecucion((actual) => ({ ...actual, programaId }));
            }}
            onGrupoChange={(grupoId) => setJornada((actual) => ({ ...actual, grupoId }))}
            onSedeChange={(sedeId) => setJornada((actual) => ({ ...actual, sedeId }))}
            onEspacioChange={(espacioId) => setJornada((actual) => ({ ...actual, espacioId }))}
            onInstructorChange={(instructorId) => setJornada((actual) => ({ ...actual, instructorId }))}
          />
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirmar}
            disabled={jornada.estado !== 'borrador'}
            className="rounded-2xl bg-tkd-blue text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Confirmar jornada
          </button>
          <button
            type="button"
            onClick={iniciar}
            disabled={jornada.estado !== 'confirmada'}
            className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Iniciar jornada
          </button>
        </div>

        {jornada.estado === 'en_curso' && (
          <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Asistencia</p>
              <p className="mt-1 text-sm font-bold text-tkd-dark dark:text-white">
                {asistenciaRegistrada
                  ? `Asistencia registrada (${cantidadCheckIns} check-in${cantidadCheckIns === 1 ? '' : 's'})`
                  : 'Sin check-ins registrados aún'}
              </p>
            </div>
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={objetivoSaludoImpartido}
                onChange={(event) => setObjetivoSaludoImpartido(event.target.checked)}
              />
              Objetivo saludo impartido
            </label>
            <button
              type="button"
              onClick={cerrar}
              className="rounded-2xl bg-tkd-red text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
            >
              Cerrar jornada
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
            {error}
          </div>
        )}


        {refuerzosPublicados.length > 0 && (
          <div className="rounded-2xl bg-blue-50 text-tkd-blue p-4 text-sm font-black uppercase">
            Refuerzos publicados: {refuerzosPublicados.join(', ')}
          </div>
        )}
      </article>
    </section>
  );
};

export default JornadasView;
