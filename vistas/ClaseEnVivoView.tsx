// vistas/ClaseEnVivoView.tsx
//
// Reescritura Fase 3 (clase-en-vivo-checkin-trigger-agenda, Bloque A): antes
// montaba el Sistema B demo (`claseEnVivoApi.ts`/`asistenciaQrApi.ts`, nunca
// persistio en Firestore, bug de firma confirmado). Ahora carga la
// `JornadaInstruccion` real por `jornadaId` (via `jornadaRepository`, Fase 0/1),
// monta el escaner real de Clase en Vivo (`EscanerAsistenciaClase`, que a su
// vez usa el callable `registrarAsistenciaJornada` de la Fase 1) y lista los
// check-ins ya registrados en la subcoleccion `asistencias` (Fase 2,
// `asistenciaRepository`).
//
// El archivado formal del Sistema B (`git mv` de `claseEnVivoApi.ts`/
// `asistenciaQrApi.ts`, retiro de tipos en `tipos.ts`, reglas huerfanas) es
// tarea de la Fase 5 -- fuera de alcance de esta fase. Este archivo deja de
// importarlos, que es el cambio de comportamiento real que le compete a la
// Fase 3.
//
// La ventana horaria dinamica y el trigger real desde Agenda (`App.tsx`,
// `Horarios.tsx`) son Fase 4 -- fuera de alcance de esta fase. Por eso este
// componente acepta `jornadaId` tanto por prop como por parametro de ruta
// (`useParams`), y ademas conserva props opcionales `jornada`/`claseActiva`
// (Sistema B) solo para que el call site actual de `App.tsx:334`
// (`<ClaseEnVivoView jornada={{ id: 'jornada-demo', ... }} claseActiva={null} />`)
// siga compilando sin cambios hasta que la Fase 4 reemplace esa ruta por
// `/clase-en-vivo/:jornadaId` real.
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EscanerAsistenciaClase from '../components/academico/EscanerAsistenciaClase';
import { useVentanaClaseEnVivo } from '../hooks/useVentanaClaseEnVivo';
import { minutosRestantesDeVentana } from '../servicios/academico/ventanaClaseEnVivoService';
import { obtenerSedes as obtenerSedesPorDefecto } from '../servicios/sedesApi';
import { getUser as obtenerUsuarioPorDefecto } from '../servicios/usuariosApi';
import { obtenerEstudiantes as obtenerEstudiantesPorDefecto } from '../servicios/estudiantesApi';
import { perteneceAutomaticamente } from '../servicios/academico/inscripcionService';
import type { Sede, Usuario, Estudiante } from '../tipos';
import {
  jornadaRepository as jornadaRepositoryPorDefecto,
  type JornadaRepository,
} from '../servicios/academico/jornadaRepository';
import {
  asistenciaRepository as asistenciaRepositoryPorDefecto,
  type AsistenciaRepository,
} from '../servicios/academico/asistenciaRepository';
import type { JornadaInstruccion } from '../models/academico/jornada';
import type { RegistroAsistencia } from '../models/academico/asistencia';
import {
  checkpointMaterialService as checkpointMaterialServicePorDefecto,
  type MaterialDeJornada,
  type CheckpointMaterialService,
} from '../servicios/academico/checkpointMaterialService';
import type { CheckpointMaterialJornada, EstadoCheckpointMaterial } from '../models/academico/checkpointMaterial';
import { LIMITE_NOTA_CHECKPOINT } from '../models/academico/checkpointMaterial';

// WS-4b (§15.D): flujo GUIADO -- estados fijos, no texto libre. Orden: primero los de
// "durante" mas usados (usado/explicado/practicado), despues los de cobertura parcial/nula,
// y al final los dos que no describen trabajo en esta sesion (pendiente/no_aplica).
const ESTADOS_CHECKPOINT: EstadoCheckpointMaterial[] = [
  'planeado',
  'usado',
  'explicado',
  'practicado',
  'mencionado',
  'parcial',
  'no_usado',
  'pendiente',
  'no_aplica',
];

const ETIQUETA_ESTADO_CHECKPOINT: Record<EstadoCheckpointMaterial, string> = {
  planeado: 'Planeado',
  usado: 'Usado',
  explicado: 'Explicado',
  practicado: 'Practicado',
  mencionado: 'Mencionado',
  parcial: 'Parcial',
  no_usado: 'No usado',
  pendiente: 'Pendiente',
  no_aplica: 'No aplica',
};

export interface ClaseEnVivoViewProps {
  jornadaId?: string;
  /**
   * @deprecated Sistema B (Fase 4 retira este call site en App.tsx). Solo se
   * usa como fallback de `jornadaId`. Forma laxa a proposito: coincide con el
   * literal que hoy pasa `App.tsx:334` (`{ id, tenantId, estado }`), pero no
   * se lee ningun campo salvo `id`.
   */
  jornada?: { id: string; tenantId?: string; estado?: string } | null;
  /** @deprecated Sistema B, sin uso en el flujo real. */
  claseActiva?: unknown;
  repository?: JornadaRepository;
  asistenciaRepository?: AsistenciaRepository;
  /** WS-4b (§9/§15.D): checkpoint pedagogico de materiales. Inyectable para tests. */
  checkpointMaterialService?: CheckpointMaterialService;
  /** WS-6 (§15.A, header completo). Inyectables para tests, mismo criterio que el resto. */
  obtenerSedes?: (tenantId?: string) => Promise<Sede[]>;
  obtenerUsuario?: (id: string) => Promise<Usuario | null>;
  /** WS-6 (§15.C, roster esperado). Inyectable para tests. */
  obtenerEstudiantes?: () => Promise<Estudiante[]>;
}

type EstadoCarga = 'cargando' | 'no-encontrada' | 'lista';

export const ClaseEnVivoView: React.FC<ClaseEnVivoViewProps> = ({
  jornadaId: jornadaIdProp,
  jornada,
  repository = jornadaRepositoryPorDefecto,
  asistenciaRepository: asistenciaRepositorio = asistenciaRepositoryPorDefecto,
  checkpointMaterialService: checkpointMaterialServicio = checkpointMaterialServicePorDefecto,
  obtenerSedes: obtenerSedesFn = obtenerSedesPorDefecto,
  obtenerUsuario: obtenerUsuarioFn = obtenerUsuarioPorDefecto,
  obtenerEstudiantes: obtenerEstudiantesFn = obtenerEstudiantesPorDefecto,
}) => {
  const params = useParams<{ jornadaId?: string }>();
  // Sin id explicito (llegada por el link generico `/clase-en-vivo`, sin :jornadaId): puede
  // haber 0, 1 o 2+ jornadas activas ahora para este usuario.
  const jornadaIdRuta = jornadaIdProp ?? params.jornadaId ?? jornada?.id;
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? '';

  // WS-6 (§4, selector multi-clase): solo se consulta cuando NO llega un id explicito. Con
  // exactamente 1 candidata se auto-selecciona (mismo comportamiento de siempre); con 2+, se
  // ofrece el selector de abajo. Se le pasa `repository` para que los tests puedan inyectar el
  // mismo mock que ya usa el resto del componente.
  const { jornadasEnVentana, cargando: cargandoVentana } = useVentanaClaseEnVivo(repository);
  const [jornadaIdElegida, setJornadaIdElegida] = useState<string | null>(null);
  const jornadaId = jornadaIdRuta
    ?? jornadaIdElegida
    ?? (jornadasEnVentana.length === 1 ? jornadasEnVentana[0].id : undefined);
  // Con id explicito (el caso de siempre) esto es irrelevante y no debe interferir con el
  // efecto de carga de abajo -- por eso se resuelve como un render temprano (mas abajo), NO
  // como parte del efecto/estadoCarga: `useAuth()` puede devolver un objeto `usuario` nuevo en
  // cada render (asi lo hacen varios mocks de test), lo que haria que `jornadasEnVentana`
  // cambiara de referencia en cada render y, si el efecto dependiera de ella, lo re-disparara
  // en bucle y re-fetchara asistencias/checkpoints de mas.
  const esperandoSeleccionDeVentana = !jornadaIdRuta && !jornadaIdElegida;

  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [jornadaActual, setJornadaActual] = useState<JornadaInstruccion | null>(null);
  const [asistencias, setAsistencias] = useState<RegistroAsistencia[]>([]);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  // WS-4b (§9/§15.D): materiales asignados a la jornada + su checkpoint (si ya se marco).
  const [materiales, setMateriales] = useState<MaterialDeJornada[]>([]);
  const [checkpointsPorAsignacionId, setCheckpointsPorAsignacionId] = useState<
    Record<string, CheckpointMaterialJornada>
  >({});
  const [notaBorradorPorAsignacionId, setNotaBorradorPorAsignacionId] = useState<Record<string, string>>({});
  const [notaAbiertaPorAsignacionId, setNotaAbiertaPorAsignacionId] = useState<Record<string, boolean>>({});
  // WS-6 (§15.A): header completo -- sede, maestro y cuenta regresiva de la ventana.
  const [sedeNombre, setSedeNombre] = useState<string | null>(null);
  const [maestroNombre, setMaestroNombre] = useState<string | null>(null);
  const [ahoraIso, setAhoraIso] = useState(() => new Date().toISOString());
  // WS-6 (§15.C): roster esperado (matricula automatica) para esta jornada. Vacio = no se pudo
  // calcular (repository sin `obtenerEjecucion`, fallo de red, etc.) -- degrada a no mostrar la
  // seccion, no rompe el resto de la pantalla.
  const [rosterEsperado, setRosterEsperado] = useState<Estudiante[]>([]);

  const cargarAsistencias = useCallback(
    async (jornadaCargada: JornadaInstruccion) => {
      const registros = await asistenciaRepositorio.listarPorJornada(
        jornadaCargada.tenantId,
        jornadaCargada.id
      );
      setAsistencias(registros);
    },
    [asistenciaRepositorio]
  );

  // Independiente de asistencias/escaneo a proposito (§9.1: "no debe bloquear el check-in").
  // Un fallo aca no debe tumbar la pantalla de escaneo -- se degrada a "sin materiales".
  const cargarCheckpoints = useCallback(
    async (jornadaCargada: JornadaInstruccion) => {
      const [listaMateriales, listaCheckpoints] = await Promise.all([
        checkpointMaterialServicio.listarMaterialesDeJornada(jornadaCargada.tenantId, jornadaCargada.id),
        checkpointMaterialServicio.listarCheckpoints(jornadaCargada.tenantId, jornadaCargada.id),
      ]);
      setMateriales(listaMateriales);
      setCheckpointsPorAsignacionId(
        Object.fromEntries(listaCheckpoints.map((checkpoint) => [checkpoint.asignacionId, checkpoint]))
      );
    },
    [checkpointMaterialServicio]
  );

  const guardarCheckpointMaterial = useCallback(
    async (asignacionId: string, estado: EstadoCheckpointMaterial) => {
      if (!jornadaActual) return;
      await checkpointMaterialServicio.guardarCheckpoint(
        jornadaActual.tenantId,
        jornadaActual.id,
        { asignacionId, estado, notaCorta: notaBorradorPorAsignacionId[asignacionId] },
        usuario?.id ?? ''
      );
      await cargarCheckpoints(jornadaActual);
    },
    [jornadaActual, checkpointMaterialServicio, notaBorradorPorAsignacionId, usuario, cargarCheckpoints]
  );

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      if (!jornadaId || !tenantId) {
        if (!cancelado) {
          setJornadaActual(null);
          setEstadoCarga('no-encontrada');
        }
        return;
      }

      setEstadoCarga('cargando');
      const jornadas = await repository.listarJornadasPorTenant(tenantId);
      if (cancelado) return;

      const encontrada = jornadas.find((item) => item.id === jornadaId) ?? null;
      setJornadaActual(encontrada);
      setEstadoCarga(encontrada ? 'lista' : 'no-encontrada');

      if (encontrada) {
        await cargarAsistencias(encontrada);
        await cargarCheckpoints(encontrada);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [jornadaId, tenantId, repository, cargarAsistencias, cargarCheckpoints]);

  // WS-6 (§15.A): nombre de sede y de maestro para el header. Independiente del resto (mismo
  // criterio que materiales/checkpoints): un fallo aca degrada a no mostrar el dato, no rompe
  // la pantalla de escaneo.
  useEffect(() => {
    if (!jornadaActual) return;
    let cancelado = false;

    obtenerSedesFn(jornadaActual.tenantId)
      .then((sedes) => {
        if (cancelado) return;
        setSedeNombre(sedes.find((sede) => sede.id === jornadaActual.sedeId)?.nombre ?? null);
      })
      .catch(() => {
        if (!cancelado) setSedeNombre(null);
      });

    obtenerUsuarioFn(jornadaActual.instructorId)
      .then((instructor) => {
        if (cancelado) return;
        setMaestroNombre(instructor?.nombreUsuario ?? null);
      })
      .catch(() => {
        if (!cancelado) setMaestroNombre(null);
      });

    return () => {
      cancelado = true;
    };
  }, [jornadaActual?.tenantId, jornadaActual?.sedeId, jornadaActual?.instructorId, obtenerSedesFn, obtenerUsuarioFn]);

  // WS-6 (§15.C): roster esperado -- cruza la EjecucionPrograma de esta jornada con el padron
  // de estudiantes usando el MISMO criterio de matricula automatica que ya usa el modal de
  // asistencia (`perteneceAutomaticamente`, inscripcionService.ts). `obtenerEjecucion` es
  // opcional en JornadaRepository (no todos los mocks/consumidores lo implementan) -- sin el,
  // o ante cualquier fallo, el roster queda vacio y la seccion simplemente no se muestra.
  useEffect(() => {
    if (!jornadaActual) return;
    let cancelado = false;

    async function cargarRoster() {
      try {
        const ejecucion = await repository.obtenerEjecucion?.(
          jornadaActual!.tenantId,
          jornadaActual!.ejecucionProgramaId
        );
        if (!ejecucion || cancelado) return;

        const estudiantes = await obtenerEstudiantesFn();
        if (cancelado) return;

        const esperados = estudiantes.filter(
          (estudiante) =>
            estudiante.tenantId === jornadaActual!.tenantId && perteneceAutomaticamente(estudiante, ejecucion)
        );
        setRosterEsperado(esperados);
      } catch {
        if (!cancelado) setRosterEsperado([]);
      }
    }

    cargarRoster();
    return () => {
      cancelado = true;
    };
  }, [jornadaActual?.tenantId, jornadaActual?.ejecucionProgramaId, repository, obtenerEstudiantesFn]);

  // Cuenta regresiva de la ventana: recalcula cada 60s, mismo intervalo que useVentanaClaseEnVivo.
  useEffect(() => {
    if (!jornadaActual) return;
    const intervalId = setInterval(() => setAhoraIso(new Date().toISOString()), 60_000);
    return () => clearInterval(intervalId);
  }, [Boolean(jornadaActual)]);

  // WS-6 (§4): sin id explicito, esperamos a que el hook resuelva las candidatas antes de
  // decidir "no encontrada" -- evita un flash de esa pantalla mientras carga. Render temprano
  // (no via estadoCarga) para no acoplar el efecto de arriba al estado del hook.
  if (esperandoSeleccionDeVentana && cargandoVentana) {
    return (
      <div className="p-8 text-center text-white/60">
        <p>Cargando clase…</p>
      </div>
    );
  }

  if (esperandoSeleccionDeVentana && jornadasEnVentana.length > 1) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">
          Tenés {jornadasEnVentana.length} clases activas ahora mismo. Elegí cuál:
        </p>
        <ul className="space-y-2">
          {jornadasEnVentana.map((candidata) => (
            <li key={candidata.id}>
              <button
                type="button"
                onClick={() => setJornadaIdElegida(candidata.id)}
                className="w-full rounded-xl border border-white/10 p-4 text-left hover:border-tkd-blue"
              >
                <p className="font-bold">{candidata.tema || '(Sin tema)'}</p>
                <p className="text-sm text-white/60">
                  {candidata.horaInicio} - {candidata.horaFin}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (estadoCarga === 'cargando') {
    return (
      <div className="p-8 text-center text-white/60">
        <p>Cargando clase…</p>
      </div>
    );
  }

  if (estadoCarga === 'no-encontrada' || !jornadaActual) {
    return (
      <div className="p-8 text-center space-y-2">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">No se encontró la jornada solicitada.</p>
      </div>
    );
  }

  if (jornadaActual.estado !== 'en_curso') {
    return (
      <div className="p-8 text-center space-y-2">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">
          La jornada no está en curso. Estado actual: {jornadaActual.estado}.
        </p>
      </div>
    );
  }

  const minutosRestantes = minutosRestantesDeVentana(jornadaActual, ahoraIso);
  const ventanaExpirada = minutosRestantes <= 0;

  return (
    <div className="p-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
              ventanaExpirada ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {ventanaExpirada ? 'Ventana expirada' : `${minutosRestantes} min restantes`}
          </span>
        </div>
        <p className="text-white/60">
          {jornadaActual.fecha} · {jornadaActual.horaInicio} - {jornadaActual.horaFin}
        </p>
        {jornadaActual.tema && <p className="text-white/80 font-bold">{jornadaActual.tema}</p>}
        {(sedeNombre || maestroNombre) && (
          <p className="text-xs text-white/50">
            {[sedeNombre, maestroNombre].filter(Boolean).join(' · ')}
          </p>
        )}
      </header>

      <button
        onClick={() => setEscanerAbierto(true)}
        className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
      >
        Escanear asistencia
      </button>

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-wide">
          Check-ins registrados ({asistencias.length})
        </h2>
        {asistencias.length === 0 ? (
          <p className="text-white/50 text-sm">Todavía no hay check-ins registrados.</p>
        ) : (
          <ul className="space-y-1">
            {asistencias.map((registro) => (
              <li key={registro.estudianteId} className="text-sm">
                {registro.estudianteId} — {registro.horaSalida ? 'Completo' : 'En curso'}
              </li>
            ))}
          </ul>
        )}
      </section>

      {rosterEsperado.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wide">
            Asistencia esperada ({asistencias.length}/{rosterEsperado.length})
          </h2>
          <ul className="space-y-1">
            {rosterEsperado.map((estudiante) => {
              const registro = asistencias.find((a) => a.estudianteId === estudiante.id);
              const estadoEstudiante = !registro
                ? 'Pendiente'
                : registro.horaSalida
                ? 'Completo'
                : registro.isLate
                ? 'Presente (tarde)'
                : 'Presente';
              return (
                <li key={estudiante.id} className="flex justify-between text-sm">
                  <span>{estudiante.nombres} {estudiante.apellidos}</span>
                  <span className="text-white/50">{estadoEstudiante}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-wide">
          Materiales de la clase{materiales.length > 0 && ` (${materiales.length})`}
        </h2>
        {materiales.length === 0 ? (
          <p className="text-white/50 text-sm">No hay materiales asignados a esta clase.</p>
        ) : (
          <ul className="space-y-3">
            {materiales.map((material) => {
              const checkpoint = checkpointsPorAsignacionId[material.asignacionId];
              const notaAbierta = notaAbiertaPorAsignacionId[material.asignacionId] ?? false;
              return (
                <li key={material.asignacionId} className="space-y-2 rounded-xl border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{material.titulo}</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      {checkpoint ? ETIQUETA_ESTADO_CHECKPOINT[checkpoint.estado] : 'Sin marcar'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1" role="group" aria-label={`Estado de ${material.titulo}`}>
                    {ESTADOS_CHECKPOINT.map((estado) => (
                      <button
                        key={estado}
                        type="button"
                        aria-pressed={checkpoint?.estado === estado}
                        onClick={() => guardarCheckpointMaterial(material.asignacionId, estado)}
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          checkpoint?.estado === estado ? 'bg-tkd-blue text-white' : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {ETIQUETA_ESTADO_CHECKPOINT[estado]}
                      </button>
                    ))}
                  </div>
                  {checkpoint && (
                    notaAbierta ? (
                      <div className="flex flex-col items-start gap-1">
                        <textarea
                          aria-label={`Nota corta de ${material.titulo}`}
                          maxLength={LIMITE_NOTA_CHECKPOINT}
                          value={notaBorradorPorAsignacionId[material.asignacionId] ?? checkpoint.notaCorta ?? ''}
                          onChange={(evento) =>
                            setNotaBorradorPorAsignacionId((actual) => ({
                              ...actual,
                              [material.asignacionId]: evento.target.value,
                            }))
                          }
                          className="w-full rounded-lg bg-white/5 p-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => guardarCheckpointMaterial(material.asignacionId, checkpoint.estado)}
                          className="text-[10px] font-black uppercase tracking-widest text-tkd-blue"
                        >
                          Guardar nota
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setNotaAbiertaPorAsignacionId((actual) => ({ ...actual, [material.asignacionId]: true }))
                        }
                        className="text-[10px] font-black uppercase tracking-widest text-white/50"
                      >
                        + Nota
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {escanerAbierto && (
        <EscanerAsistenciaClase
          tenantId={tenantId}
          jornadaId={jornadaActual.id}
          onClose={() => setEscanerAbierto(false)}
          onRegistrado={() => cargarAsistencias(jornadaActual)}
        />
      )}
    </div>
  );
};
