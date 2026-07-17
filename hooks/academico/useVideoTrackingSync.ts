// hooks/academico/useVideoTrackingSync.ts
// Guardado periódico del avance de un video de YouTube (posición/duración/inicios).
//
// Reusa el MISMO patrón de flush que `useProgressSync.ts` (ya probado en este proyecto):
// flush cada `intervaloMs` (30s por defecto) + flush en `visibilitychange` (pestaña oculta)
// + flush al desmontar. No se generaliza `useProgressSync` porque su payload
// (`paginasVistas`/`segundosUnicos`) es para PDF/checkpoints de progreso genérico, y el
// tracking de YouTube necesita datos distintos (posición/duración/nuevoInicio) para el
// reporte de staff -- ver `servicios/academico/visualizacionRepository.ts`.

import React from 'react';

export interface VideoTrackingSyncInput {
  posicionSegundos: number;
  duracionSegundos: number;
  nuevoInicio: boolean;
}

interface UseVideoTrackingSyncOptions {
  intervaloMs?: number;
  sincronizar: (input: VideoTrackingSyncInput) => void | Promise<void>;
}

export function useVideoTrackingSync({ intervaloMs = 30000, sincronizar }: UseVideoTrackingSyncOptions) {
  const estadoRef = React.useRef({ posicionSegundos: 0, duracionSegundos: 0 });
  const nuevoInicioPendienteRef = React.useRef(false);
  const sincronizarRef = React.useRef(sincronizar);
  sincronizarRef.current = sincronizar;

  const actualizarPosicion = React.useCallback((posicionSegundos: number, duracionSegundos: number) => {
    estadoRef.current = {
      posicionSegundos: Number.isFinite(posicionSegundos) ? posicionSegundos : estadoRef.current.posicionSegundos,
      duracionSegundos: Number.isFinite(duracionSegundos) ? duracionSegundos : estadoRef.current.duracionSegundos,
    };
  }, []);

  const registrarInicio = React.useCallback(() => {
    nuevoInicioPendienteRef.current = true;
  }, []);

  const flush = React.useCallback(() => {
    const { posicionSegundos, duracionSegundos } = estadoRef.current;
    if (duracionSegundos <= 0) return;

    const nuevoInicio = nuevoInicioPendienteRef.current;
    nuevoInicioPendienteRef.current = false;
    sincronizarRef.current({ posicionSegundos, duracionSegundos, nuevoInicio });
  }, []);

  React.useEffect(() => {
    const intervalo = window.setInterval(flush, intervaloMs);
    return () => {
      window.clearInterval(intervalo);
      flush();
    };
  }, [flush, intervaloMs]);

  React.useEffect(() => {
    const manejarVisibilidad = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    document.addEventListener('visibilitychange', manejarVisibilidad);
    return () => document.removeEventListener('visibilitychange', manejarVisibilidad);
  }, [flush]);

  return { actualizarPosicion, registrarInicio, flush };
}
