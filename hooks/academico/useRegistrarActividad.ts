// hooks/academico/useRegistrarActividad.ts
// Hook React para registrar actividad académica de manera declarativa.
// Provee funciones tipadas para los casos de uso más comunes:
//   - apertura de material
//   - progreso de video
//   - progreso de PDF
//   - completar quiz

import { useCallback, useRef } from 'react';
import { actividadService } from '../../servicios/academico/actividadService';
import type {
  TipoActividad,
  MetadatosVideo,
  MetadatosPdf,
  MetadatosQuiz,
  MetadatosGenerico,
} from '../../models/academico/actividad';

export interface UseRegistrarActividadOptions {
  tenantId: string;
  estudianteId: string;
  estudianteNombre?: string;
  asignacionId: string;
  recursoId: string;
  tituloRecurso?: string;
}

export interface UseRegistrarActividadReturn {
  /** Registra apertura genérica del material (imagen, txt, presentación). */
  registrarApertura: (
    tipo: Extract<TipoActividad, 'imagen' | 'texto' | 'presentacion' | 'apertura'>,
    duracionSegundos?: number
  ) => Promise<void>;

  /** Registra checkpoint de video. Debounced: solo envía si el porcentaje cambió al menos 5 puntos desde el último envío. */
  registrarProgresoVideo: (opts: MetadatosVideo) => Promise<void>;

  /** Registra progreso de lectura de PDF. */
  registrarProgresoPdf: (opts: MetadatosPdf) => Promise<void>;

  /** Registra resultado de quiz/evaluación. */
  registrarResultadoQuiz: (opts: MetadatosQuiz) => Promise<void>;
}

export function useRegistrarActividad(
  options: UseRegistrarActividadOptions
): UseRegistrarActividadReturn {
  const { tenantId, estudianteId, estudianteNombre, asignacionId, recursoId, tituloRecurso } =
    options;

  // Evitar envíos duplicados de video si el cambio es menor a 5%
  const ultimoPorcentajeVideoRef = useRef<number>(-1);

  const basePayload = useCallback(
    () => ({
      tenantId,
      estudianteId,
      estudianteNombre,
      asignacionId,
      recursoId,
      tituloRecurso,
    }),
    [tenantId, estudianteId, estudianteNombre, asignacionId, recursoId, tituloRecurso]
  );

  const registrarApertura = useCallback(
    async (
      tipo: Extract<TipoActividad, 'imagen' | 'texto' | 'presentacion' | 'apertura'>,
      duracionSegundos?: number
    ) => {
      try {
        const metadata: MetadatosGenerico = duracionSegundos !== undefined
          ? { duracionSegundos }
          : {};
        await actividadService.registrarActividad({
          ...basePayload(),
          tipo,
          metadata,
        });
      } catch (err) {
        // No bloqueamos la UX por fallos de telemetría
        console.warn('[useRegistrarActividad] registrarApertura falló silenciosamente', err);
      }
    },
    [basePayload]
  );

  const registrarProgresoVideo = useCallback(
    async (opts: MetadatosVideo) => {
      const { porcentajeVisto } = opts;
      // Solo registrar si el porcentaje subió al menos 5 puntos
      if (porcentajeVisto - ultimoPorcentajeVideoRef.current < 5) return;
      ultimoPorcentajeVideoRef.current = porcentajeVisto;

      try {
        await actividadService.registrarActividad({
          ...basePayload(),
          tipo: 'video',
          metadata: opts,
        });
      } catch (err) {
        console.warn('[useRegistrarActividad] registrarProgresoVideo falló silenciosamente', err);
      }
    },
    [basePayload]
  );

  const registrarProgresoPdf = useCallback(
    async (opts: MetadatosPdf) => {
      try {
        await actividadService.registrarActividad({
          ...basePayload(),
          tipo: 'pdf',
          metadata: opts,
        });
      } catch (err) {
        console.warn('[useRegistrarActividad] registrarProgresoPdf falló silenciosamente', err);
      }
    },
    [basePayload]
  );

  const registrarResultadoQuiz = useCallback(
    async (opts: MetadatosQuiz) => {
      try {
        await actividadService.registrarActividad({
          ...basePayload(),
          tipo: 'quiz',
          metadata: opts,
        });
      } catch (err) {
        console.warn('[useRegistrarActividad] registrarResultadoQuiz falló silenciosamente', err);
      }
    },
    [basePayload]
  );

  return {
    registrarApertura,
    registrarProgresoVideo,
    registrarProgresoPdf,
    registrarResultadoQuiz,
  };
}
