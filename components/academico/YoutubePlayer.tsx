// components/academico/YoutubePlayer.tsx
// Reproductor REAL de YouTube (IFrame Player API) para material de video del Centro de
// Estudios. Reemplaza, SOLO cuando el recurso tiene `youtubeVideoId`, al <video> que
// apuntaba al proxy de Drive (`VideoPlayer.tsx` + `proxyDriveMedia`) -- ese proxy no tiene
// Cache-Control/ETag (functions/academico/drive.js ~1348), asi que cada reproduccion
// redescarga el archivo completo. YouTube es costo $0 de hosting y expone eventos reales
// de reproduccion (onStateChange) que este componente usa para armar el reporte de
// visualizacion (ver servicios/academico/visualizacionRepository.ts).
//
// El flujo de Drive (PDF y videos ya cargados en Drive antes de este cambio) sigue
// intacto en VideoPlayer.tsx -- MaterialPreviewModal decide cual de los dos renderizar
// segun si la asignacion tiene `youtubeVideoId`.

import React from 'react';
import { useVideoTrackingSync } from '../../hooks/academico/useVideoTrackingSync';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let iframeApiPromise: Promise<void> | null = null;

/** Carga el script https://www.youtube.com/iframe_api una sola vez (aunque se monten varios reproductores). */
function cargarIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve) => {
    const callbackAnterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      callbackAnterior?.();
      resolve();
    };

    const scriptYaPresente = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!scriptYaPresente) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return iframeApiPromise;
}

export interface YoutubePlayerRegistrarSyncInput {
  estudianteNombre?: string;
  posicionSegundos: number;
  duracionSegundos: number;
  nuevoInicio: boolean;
}

export interface YoutubePlayerProps {
  videoId: string;
  titulo: string;
  estudianteId?: string;
  estudianteNombre?: string;
  /** Frecuencia de sondeo de getCurrentTime()/getDuration() mientras el video reproduce. */
  intervaloSondeoMs?: number;
  /** Cada cuanto se persiste el avance (mismo default 30s que useProgressSync). */
  intervaloFlushMs?: number;
  registrarSync: (input: YoutubePlayerRegistrarSyncInput) => void | Promise<void>;
}

let contadorInstanciasYoutubePlayer = 0;

const YoutubePlayer: React.FC<YoutubePlayerProps> = ({
  videoId,
  titulo,
  estudianteId,
  estudianteNombre,
  intervaloSondeoMs = 5000,
  intervaloFlushMs = 30000,
  registrarSync,
}) => {
  const [elementId] = React.useState(() => {
    contadorInstanciasYoutubePlayer += 1;
    return `youtube-player-${videoId}-${contadorInstanciasYoutubePlayer}`;
  });
  const [listo, setListo] = React.useState(false);
  const playerRef = React.useRef<any>(null);

  const sincronizar = React.useCallback(
    (input: { posicionSegundos: number; duracionSegundos: number; nuevoInicio: boolean }) => {
      if (!estudianteId) return;
      return registrarSync({ ...input, estudianteNombre });
    },
    [estudianteId, estudianteNombre, registrarSync]
  );

  const { actualizarPosicion, registrarInicio, flush } = useVideoTrackingSync({
    intervaloMs: intervaloFlushMs,
    sincronizar,
  });

  React.useEffect(() => {
    let activo = true;
    let sondeoId: number | undefined;

    const detenerSondeo = () => {
      if (sondeoId !== undefined) {
        window.clearInterval(sondeoId);
        sondeoId = undefined;
      }
    };

    cargarIframeApi().then(() => {
      if (!activo || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        events: {
          onReady: () => {
            if (activo) setListo(true);
          },
          onStateChange: (event: any) => {
            if (!activo) return;
            const estado = event?.data;
            const player = playerRef.current;

            if (estado === window.YT.PlayerState.PLAYING) {
              registrarInicio();
              if (sondeoId === undefined) {
                sondeoId = window.setInterval(() => {
                  const p = playerRef.current;
                  if (!p) return;
                  actualizarPosicion(p.getCurrentTime?.() ?? 0, p.getDuration?.() ?? 0);
                }, intervaloSondeoMs);
              }
              return;
            }

            if (estado === window.YT.PlayerState.PAUSED || estado === window.YT.PlayerState.ENDED) {
              detenerSondeo();
              if (player) {
                actualizarPosicion(player.getCurrentTime?.() ?? 0, player.getDuration?.() ?? 0);
              }
              flush();
            }
          },
        },
      });
    });

    return () => {
      activo = false;
      detenerSondeo();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinstanciar el player solo si cambia el video
  }, [elementId, videoId]);

  return (
    <section className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Video académico (YouTube)</p>
      <h3 className="mt-2 text-xl font-black uppercase text-tkd-dark dark:text-white">{titulo}</h3>

      <div className="mt-5 aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <div id={elementId} data-testid="youtube-player-target" aria-label={`Reproductor de YouTube: ${titulo}`} />
      </div>

      {!listo && (
        <p className="mt-3 text-xs font-bold text-gray-400">Cargando reproductor de YouTube...</p>
      )}
    </section>
  );
};

export default YoutubePlayer;
