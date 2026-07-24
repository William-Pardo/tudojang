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
}

type EstadoCarga = 'cargando' | 'no-encontrada' | 'lista';

export const ClaseEnVivoView: React.FC<ClaseEnVivoViewProps> = ({
  jornadaId: jornadaIdProp,
  jornada,
  repository = jornadaRepositoryPorDefecto,
  asistenciaRepository: asistenciaRepositorio = asistenciaRepositoryPorDefecto,
  checkpointMaterialService: checkpointMaterialServicio = checkpointMaterialServicePorDefecto,
}) => {
  const params = useParams<{ jornadaId?: string }>();
  const jornadaId = jornadaIdProp ?? params.jornadaId ?? jornada?.id;
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? '';

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

  return (
    <div className="p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">
          {jornadaActual.fecha} · {jornadaActual.horaInicio} - {jornadaActual.horaFin}
        </p>
        {jornadaActual.tema && <p className="text-white/80 font-bold">{jornadaActual.tema}</p>}
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
