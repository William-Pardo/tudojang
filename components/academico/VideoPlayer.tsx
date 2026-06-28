import React from 'react';
import { type ProgresoLocalSync, type ProgresoSyncPayload, useProgressSync } from '../../hooks/academico/useProgressSync';

interface VideoPlayerProps {
  tenantId: string;
  asignacionId: string;
  titulo: string;
  url: string;
  totalSegundos: number;
  sincronizar: (payload: ProgresoSyncPayload) => void | Promise<void>;
  cargarProgreso?: () => ProgresoLocalSync | null | Promise<ProgresoLocalSync | null>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  tenantId,
  asignacionId,
  titulo,
  url,
  totalSegundos,
  sincronizar,
  cargarProgreso,
}) => {
  const buscandoRef = React.useRef(false);
  const { flush, progreso, registrarVideoSegundo } = useProgressSync({
    tenantId,
    asignacionId,
    tipo: 'video',
    sincronizar,
    cargarProgreso,
  });

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
            onTimeUpdate={(event) => {
              if (buscandoRef.current) return;
              const segundo = Math.floor(event.currentTarget.currentTime);
              if (segundo >= 0 && segundo < totalSegundos) {
                registrarVideoSegundo(segundo);
              }
            }}
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
