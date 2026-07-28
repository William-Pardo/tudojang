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
import {
  determinarEstadoClaseEnVivo,
  obtenerInfoEstadoClaseEnVivo,
} from '../servicios/academico/estadoClaseEnVivoService';
import {
  enviarNotificacionCheckout,
  construirMensajeCheckout,
} from '../servicios/academico/notificacionCheckoutService';
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
import type { CategoriaObservacionClase } from '../models/academico/jornada';
import { LIMITE_NOTA_OBSERVACION_CLASE } from '../models/academico/jornada';

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

// WS-5 (§10): observaciones grupales rápidas -- flujo guiado, no texto libre.
const CATEGORIAS_OBSERVACION: CategoriaObservacionClase[] = [
  'buena_energia',
  'baja_energia',
  'requiere_refuerzo',
  'buen_avance',
  'dificultad',
  'interrumpida',
  'material_insuficiente',
  'excelente_participacion',
];

const ETIQUETA_CATEGORIA_OBSERVACION: Record<CategoriaObservacionClase, string> = {
  buena_energia: 'Buena energía',
  baja_energia: 'Baja energía',
  requiere_refuerzo: 'Requiere refuerzo',
  buen_avance: 'Buen avance técnico',
  dificultad: 'Dificultad general',
  interrumpida: 'Clase interrumpida',
  material_insuficiente: 'Material insuficiente',
  excelente_participacion: 'Excelente participación',
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
  // Cierre de clase (§15.E): modal de confirmación.
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [cierreCargando, setCierreCargando] = useState(false);
  // Observaciones grupales rápidas (§10): categorías seleccionadas + nota corta.
  const [observacionesSeleccionadas, setObservacionesSeleccionadas] = useState<CategoriaObservacionClase[]>([]);
  const [notaObservacion, setNotaObservacion] = useState('');
  // Notificaciones a padres (§8): modal para enviar notificaciones.
  const [notificacionesAbierto, setNotificacionesAbierto] = useState(false);
  const [notificacionesCargando, setNotificacionesCargando] = useState(false);
  const [contactoAcudiente, setContactoAcudiente] = useState({ nombre: '', whatsapp: '', email: '' });
  const [resultadoNotificacion, setResultadoNotificacion] = useState<{ exitoso: boolean; mensaje: string } | null>(null);

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

  const cerrarClase = useCallback(
    async () => {
      if (!jornadaActual) return;
      setCierreCargando(true);
      try {
        // Construir observación si hay categorías seleccionadas (§10: opcional).
        const observacion = observacionesSeleccionadas.length > 0 ? {
          categorias: observacionesSeleccionadas,
          notaCorta: notaObservacion || undefined,
          registradoPorUid: usuario?.id ?? 'sistema',
          actualizadoEn: new Date().toISOString(),
        } : undefined;

        // Registrar cierre: transicionar a 'pendiente_cierre' si estamos en 'en_curso'.
        // En producción esto iría a Firestore via repository.
        await repository.actualizarJornada?.(jornadaActual.tenantId, jornadaActual.id, {
          estado: 'pendiente_cierre' as any,
          asistenciaRegistrada: true,
          objetivosImpartidos: ['(Cierre registrado en ' + new Date().toISOString() + ')'],
          observacionClase: observacion,
          actualizadoEn: new Date().toISOString(),
        });
        // Transicionar final a 'cerrada' después.
        await repository.actualizarJornada?.(jornadaActual.tenantId, jornadaActual.id, {
          estado: 'cerrada' as any,
          actualizadoEn: new Date().toISOString(),
        });
        setCierreAbierto(false);
        setObservacionesSeleccionadas([]);
        setNotaObservacion('');
        // Recargar la jornada para reflejar el cierre.
        const jornadas = await repository.listarJornadasPorTenant(jornadaActual.tenantId);
        const actualizada = jornadas.find((j) => j.id === jornadaActual.id) ?? null;
        if (actualizada) {
          setJornadaActual(actualizada);
        }
      } catch (error) {
        console.error('Error al cerrar clase:', error);
        alert('Error al cerrar la clase. Por favor intenta de nuevo.');
      } finally {
        setCierreCargando(false);
      }
    },
    [jornadaActual, repository, observacionesSeleccionadas, notaObservacion, usuario]
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
  // WS-9 (§14): estados formales visuales de Clase en Vivo.
  const tieneOperaciones = asistencias.length > 0;
  const estadoClaseEnVivo = determinarEstadoClaseEnVivo(jornadaActual, ahoraIso, tieneOperaciones);
  const infoEstado = obtenerInfoEstadoClaseEnVivo(estadoClaseEnVivo);

  return (
    <div className="p-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${
                infoEstado.colorBg
              } ${infoEstado.colorTexto} ${infoEstado.colorBorde}`}
            >
              {infoEstado.etiqueta}
            </span>
            {!ventanaExpirada && estadoClaseEnVivo !== 'closed' && (
              <span className="rounded-full bg-slate-500/20 text-slate-400 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                {minutosRestantes} min
              </span>
            )}
          </div>
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

      {estadoClaseEnVivo === 'scheduled' && (
        <div className={`rounded-lg p-3 ${infoEstado.colorBg} border ${infoEstado.colorBorde}`}>
          <p className={`text-xs font-bold ${infoEstado.colorTexto}`}>{infoEstado.descripcion}</p>
        </div>
      )}

      {estadoClaseEnVivo === 'expired' && (
        <div className={`rounded-lg p-3 ${infoEstado.colorBg} border ${infoEstado.colorBorde}`}>
          <p className={`text-xs font-bold ${infoEstado.colorTexto}`}>
            {infoEstado.descripcion}. Por favor, cierra la clase manualmente si aún no lo has hecho.
          </p>
        </div>
      )}

      {estadoClaseEnVivo === 'cancelled' && (
        <div className={`rounded-lg p-3 ${infoEstado.colorBg} border ${infoEstado.colorBorde}`}>
          <p className={`text-xs font-bold ${infoEstado.colorTexto}`}>
            {infoEstado.descripcion}. {jornadaActual.motivoCancelacion && `Motivo: ${jornadaActual.motivoCancelacion}`}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setEscanerAbierto(true)}
          className="flex-1 bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
        >
          Escanear asistencia
        </button>
        {jornadaActual.estado === 'en_curso' && asistencias.length > 0 && (
          <button
            onClick={() => setCierreAbierto(true)}
            className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700"
          >
            Cerrar clase
          </button>
        )}
      </div>

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

      {notificacionesAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 max-w-md space-y-6">
            <div>
              <h2 className="text-lg font-black uppercase">Notificar a padres/acudientes</h2>
              <p className="text-xs text-white/60 mt-1">
                Envía notificación de que {asistencias.length} estudiante{asistencias.length !== 1 ? 's' : ''} terminó la clase y puede ser recogido.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-white/70">Nombre del acudiente</label>
                <input
                  type="text"
                  value={contactoAcudiente.nombre}
                  onChange={(e) => setContactoAcudiente((a) => ({ ...a, nombre: e.target.value }))}
                  placeholder="Ej: María Pérez"
                  className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-white/70">WhatsApp (opcional)</label>
                <input
                  type="tel"
                  value={contactoAcudiente.whatsapp}
                  onChange={(e) => setContactoAcudiente((a) => ({ ...a, whatsapp: e.target.value }))}
                  placeholder="Ej: 3001234567"
                  className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-white/70">Email (opcional)</label>
                <input
                  type="email"
                  value={contactoAcudiente.email}
                  onChange={(e) => setContactoAcudiente((a) => ({ ...a, email: e.target.value }))}
                  placeholder="Ej: maria@example.com"
                  className="w-full mt-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="bg-sky-500/10 border border-sky-400/30 rounded-lg p-2">
                <p className="text-xs text-sky-300">
                  <strong>Nota:</strong> En producción, esto obtendría automáticamente los contactos de los acudientes del sistema.
                </p>
              </div>
            </div>

            {resultadoNotificacion && (
              <div
                className={`rounded-lg p-3 ${
                  resultadoNotificacion.exitoso
                    ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-400 text-rose-300'
                }`}
              >
                <p className="text-xs font-bold">{resultadoNotificacion.mensaje}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotificacionesAbierto(false);
                  setContactoAcudiente({ nombre: '', whatsapp: '', email: '' });
                  setResultadoNotificacion(null);
                }}
                disabled={notificacionesCargando}
                className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNotificacionesCargando(true);
                  try {
                    const resultado = await enviarNotificacionCheckout(
                      {
                        estudianteId: asistencias[0]?.estudianteId || 'desconocido',
                        estudianteNombre: asistencias[0]?.estudianteId || 'Estudiante',
                        jornadaId: jornadaActual.id,
                        sedeName,
                        claseTema: jornadaActual.tema,
                        horaSalida: new Date().toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      },
                      contactoAcudiente
                    );
                    setResultadoNotificacion({
                      exitoso: resultado.exitoso,
                      mensaje: resultado.mensaje,
                    });
                  } catch (error) {
                    setResultadoNotificacion({
                      exitoso: false,
                      mensaje: 'Error al enviar notificación',
                    });
                  } finally {
                    setNotificacionesCargando(false);
                  }
                }}
                disabled={notificacionesCargando || !contactoAcudiente.nombre}
                className="flex-1 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold uppercase hover:bg-sky-700 disabled:opacity-50"
              >
                {notificacionesCargando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cierreAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 max-w-lg space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase">Confirmar cierre de clase</h2>
              <p className="text-sm text-white/60 mt-1">
                Verifica los datos antes de cerrar. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="space-y-4 bg-white/5 rounded-xl p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase">Resumen de asistencia</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/60">Presentes:</span>
                    <span className="font-bold">
                      {asistencias.filter((a) => !a.isLate).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Tarde:</span>
                    <span className="font-bold">{asistencias.filter((a) => a.isLate).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Completados:</span>
                    <span className="font-bold">{asistencias.filter((a) => a.horaSalida).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Total check-ins:</span>
                    <span className="font-bold">{asistencias.length}</span>
                  </div>
                </div>
              </div>

              {rosterEsperado.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h3 className="text-sm font-bold uppercase">Cobertura</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${(asistencias.length / rosterEsperado.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold">
                      {asistencias.length}/{rosterEsperado.length}
                    </span>
                  </div>
                </div>
              )}

              {materiales.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h3 className="text-sm font-bold uppercase">Materiales registrados</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Usados:</span>
                      <span className="font-bold">
                        {Object.values(checkpointsPorAsignacionId).filter(
                          (cp) => cp.estado === 'usado'
                        ).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Parciales:</span>
                      <span className="font-bold">
                        {Object.values(checkpointsPorAsignacionId).filter(
                          (cp) => cp.estado === 'parcial'
                        ).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">No usados:</span>
                      <span className="font-bold">
                        {Object.values(checkpointsPorAsignacionId).filter(
                          (cp) => cp.estado === 'no_usado'
                        ).length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 bg-white/5 rounded-xl p-4">
              <div>
                <h3 className="text-sm font-bold uppercase mb-2">Observación grupal (opcional)</h3>
                <p className="text-xs text-white/50 mb-3">Selecciona las categorías que apliquen a esta clase</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS_OBSERVACION.map((categoria) => (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() =>
                        setObservacionesSeleccionadas((actual) =>
                          actual.includes(categoria)
                            ? actual.filter((c) => c !== categoria)
                            : [...actual, categoria]
                        )
                      }
                      className={`rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${
                        observacionesSeleccionadas.includes(categoria)
                          ? 'bg-sky-500/30 text-sky-300 border border-sky-400'
                          : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {ETIQUETA_CATEGORIA_OBSERVACION[categoria]}
                    </button>
                  ))}
                </div>
              </div>

              {observacionesSeleccionadas.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-bold uppercase">Nota adicional (opcional)</label>
                  <textarea
                    maxLength={LIMITE_NOTA_OBSERVACION_CLASE}
                    value={notaObservacion}
                    onChange={(e) => setNotaObservacion(e.target.value)}
                    placeholder="Ejemplo: El grupo necesita más práctica de patadas altas..."
                    className="w-full rounded-lg bg-white/5 border border-white/10 p-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-400"
                  />
                  <p className="text-xs text-white/50">
                    {notaObservacion.length}/{LIMITE_NOTA_OBSERVACION_CLASE}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCierreAbierto(false);
                    setObservacionesSeleccionadas([]);
                    setNotaObservacion('');
                  }}
                  disabled={cierreCargando}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white text-sm font-bold uppercase disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => cerrarClase()}
                  disabled={cierreCargando}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold uppercase hover:bg-amber-700 disabled:opacity-50"
                >
                  {cierreCargando ? 'Cerrando…' : 'Confirmar cierre'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setNotificacionesAbierto(true)}
                className="w-full px-4 py-2 rounded-lg border border-sky-500/50 text-sky-400 text-xs font-bold uppercase hover:bg-sky-500/10"
              >
                + Notificar a padres/acudientes (opcional)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
