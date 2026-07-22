import React from 'react';
import { type ProgresoLocalSync, type ProgresoSyncPayload, useProgressSync } from '../../hooks/academico/useProgressSync';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

interface VideoPlayerProps {
  tenantId: string;
  asignacionId: string;
  titulo: string;
  url: string;
  totalSegundos: number;
  sincronizar: (payload: ProgresoSyncPayload) => void | Promise<void>;
  cargarProgreso?: () => ProgresoLocalSync | null | Promise<ProgresoLocalSync | null>;
  /** Props opcionales para el registro de métricas académicas */
  estudianteId?: string;
  estudianteNombre?: string;
  recursoId?: string;
}

const CHECKPOINTS_PORCENTAJE = [25, 50, 75, 100];

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  tenantId,
  asignacionId,
  titulo,
  url,
  totalSegundos,
  sincronizar,
  cargarProgreso,
  estudianteId,
  estudianteNombre,
  recursoId,
}) => {
  const buscandoRef = React.useRef(false);
  const checkpointsAlcanzadosRef = React.useRef<Set<number>>(new Set());

  const { flush, progreso, registrarVideoSegundo } = useProgressSync({
    tenantId,
    asignacionId,
    tipo: 'video',
    sincronizar,
    cargarProgreso,
  });

  // Hook de métricas — solo activo si se proveen los datos del estudiante
  const { registrarProgresoVideo } = useRegistrarActividad({
    tenantId,
    estudianteId: estudianteId ?? '',
    estudianteNombre,
    asignacionId,
    recursoId: recursoId ?? asignacionId,
    tituloRecurso: titulo,
  });

  const manejarTimeUpdate = React.useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (buscandoRef.current) return;
      const video = event.currentTarget;
      const segundo = Math.floor(video.currentTime);

      if (segundo >= 0 && segundo < totalSegundos) {
        registrarVideoSegundo(segundo);
      }

      // Calcular % visto y disparar checkpoint si aplica
      if (estudianteId && totalSegundos > 0) {
        const pctActual = Math.floor((video.currentTime / totalSegundos) * 100);
        for (const checkpoint of CHECKPOINTS_PORCENTAJE) {
          if (pctActual >= checkpoint && !checkpointsAlcanzadosRef.current.has(checkpoint)) {
            checkpointsAlcanzadosRef.current.add(checkpoint);
            registrarProgresoVideo({
              porcentajeVisto: checkpoint,
              segundosTotales: totalSegundos,
              segundosVistos: Math.round(video.currentTime),
              checkpoints: Array.from(checkpointsAlcanzadosRef.current).sort((a, b) => a - b),
            });
          }
        }
      }
    },
    [estudianteId, registrarVideoSegundo, registrarProgresoVideo, totalSegundos]
  );

  // Resetear checkpoints cuando cambia la asignación
  React.useEffect(() => {
    checkpointsAlcanzadosRef.current = new Set();
  }, [asignacionId]);

  return (
    <section className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Video académico</p>
          <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">{titulo}</h3>
          <p className="mt-2 text-sm text-gray-500">
            Segundos registrados: {progreso.segundosUnicos.length}/{totalSegundos}
          </p>
        </div>
        <button
          type="button"
          onClick={flush}
          className="rounded-2xl bg-tkd-dark text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest"
        >
          Sincronizar avance
        </button>
      </div>

      {url ? (
        <>
          <video
            aria-label={`Video ${titulo}`}
            src={url}
            controls
            onSeeking={() => {
              buscandoRef.current = true;
            }}
            onSeeked={() => {
              buscandoRef.current = false;
            }}
            onTimeUpdate={manejarTimeUpdate}
            className="w-full rounded-2xl bg-black"
          />

          <div className="mt-5 flex flex-wrap gap-3">
            {[12, 30, 60].map((segundo) => (
              <button
                key={segundo}
                type="button"
                onClick={() => registrarVideoSegundo(segundo)}
                className="rounded-xl bg-tkd-blue text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
              >
                Registrar segundo {segundo}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Video no disponible
          </p>
        </div>
      )}
    </section>
  );
};

export default VideoPlayer;

