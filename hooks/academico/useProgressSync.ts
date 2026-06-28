import React from 'react';

export type TipoProgresoSync = 'pdf' | 'video' | 'quiz';

export interface ProgresoSyncPayload {
  tenantId: string;
  asignacionId: string;
  tipo: TipoProgresoSync;
  paginasVistas: number[];
  segundosUnicos: number[];
  actualizadoEn: string;
}

interface UseProgressSyncOptions {
  tenantId: string;
  asignacionId: string;
  tipo: TipoProgresoSync;
  intervaloMs?: number;
  sincronizar: (payload: ProgresoSyncPayload) => void | Promise<void>;
  cargarProgreso?: () => ProgresoLocalSync | null | Promise<ProgresoLocalSync | null>;
}

export interface ProgresoLocalSync {
  paginasVistas: number[];
  segundosUnicos: number[];
}

export function crearClaveProgressSync(tenantId: string, asignacionId: string): string {
  return `tudojang:centro-estudios:progress-sync:${tenantId}:${asignacionId}`;
}

function normalizarProgreso(progreso: Partial<ProgresoLocalSync> | null | undefined): ProgresoLocalSync {
  return {
    paginasVistas: Array.from(new Set(progreso?.paginasVistas ?? [])).sort((a, b) => a - b),
    segundosUnicos: Array.from(new Set(progreso?.segundosUnicos ?? [])).sort((a, b) => a - b),
  };
}

function leerProgresoLocal(tenantId: string, asignacionId: string): ProgresoLocalSync {
  try {
    const raw = window.localStorage.getItem(crearClaveProgressSync(tenantId, asignacionId));
    if (!raw) return { paginasVistas: [], segundosUnicos: [] };
    return normalizarProgreso(JSON.parse(raw));
  } catch {
    return { paginasVistas: [], segundosUnicos: [] };
  }
}

export function useProgressSync({
  tenantId,
  asignacionId,
  tipo,
  intervaloMs = 30000,
  sincronizar,
  cargarProgreso,
}: UseProgressSyncOptions) {
  const [progreso, setProgreso] = React.useState<ProgresoLocalSync>(() => leerProgresoLocal(tenantId, asignacionId));
  const progresoRef = React.useRef(progreso);

  React.useEffect(() => {
    let cancelado = false;

    async function cargarProgresoInicial() {
      if (!cargarProgreso) return;
      const progresoGuardado = await cargarProgreso();
      if (cancelado || !progresoGuardado) return;

      const normalizado = normalizarProgreso(progresoGuardado);
      progresoRef.current = normalizado;
      setProgreso(normalizado);
    }

    cargarProgresoInicial();

    return () => {
      cancelado = true;
    };
  }, [asignacionId, cargarProgreso, tenantId]);

  React.useEffect(() => {
    progresoRef.current = progreso;
    window.localStorage.setItem(crearClaveProgressSync(tenantId, asignacionId), JSON.stringify(progreso));
  }, [asignacionId, progreso, tenantId]);

  const crearPayload = React.useCallback((): ProgresoSyncPayload => ({
    tenantId,
    asignacionId,
    tipo,
    paginasVistas: progresoRef.current.paginasVistas,
    segundosUnicos: progresoRef.current.segundosUnicos,
    actualizadoEn: new Date().toISOString(),
  }), [asignacionId, tenantId, tipo]);

  const flush = React.useCallback(() => {
    sincronizar(crearPayload());
  }, [crearPayload, sincronizar]);

  const actualizarProgreso = React.useCallback((actualizador: (actual: ProgresoLocalSync) => ProgresoLocalSync) => {
    setProgreso((actual) => {
      const siguiente = actualizador(actual);
      progresoRef.current = siguiente;
      return siguiente;
    });
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

  React.useEffect(() => {
    const registrarDesdeEvento = (evento: Event) => {
      const segundo = (evento as CustomEvent<number>).detail;
      if (typeof segundo === 'number') {
        actualizarProgreso((actual) => ({
          ...actual,
          segundosUnicos: Array.from(new Set([...actual.segundosUnicos, segundo])).sort((a, b) => a - b),
        }));
      }
    };

    window.addEventListener('tudojang:test-progress-video', registrarDesdeEvento);
    return () => window.removeEventListener('tudojang:test-progress-video', registrarDesdeEvento);
  }, [actualizarProgreso]);

  const registrarVideoSegundo = React.useCallback((segundo: number) => {
    actualizarProgreso((actual) => ({
      ...actual,
      segundosUnicos: Array.from(new Set([...actual.segundosUnicos, segundo])).sort((a, b) => a - b),
    }));
  }, [actualizarProgreso]);

  const registrarPaginaPdf = React.useCallback((pagina: number) => {
    actualizarProgreso((actual) => ({
      ...actual,
      paginasVistas: Array.from(new Set([...actual.paginasVistas, pagina])).sort((a, b) => a - b),
    }));
  }, [actualizarProgreso]);

  return {
    progreso,
    flush,
    registrarPaginaPdf,
    registrarVideoSegundo,
  };
}
