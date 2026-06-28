// hooks/useCentroEstudios.ts
// Expone el feature flag 'centroEstudios' del tenant activo.
// Úsalo en cualquier componente para saber si el módulo de estudio está activo.

import { useConfiguracion } from '../context/DataContext';

interface UseCentroEstudiosReturn {
  /** true si el tenant tiene el módulo de estudio habilitado */
  centroEstudiosActivo: boolean;
}

/**
 * Hook para comprobar si el módulo de Centro de Estudios está habilitado
 * en el tenant actual. Controlado por `configClub.features.centroEstudios`.
 *
 * @example
 * const { centroEstudiosActivo } = useCentroEstudios();
 * if (!centroEstudiosActivo) return null;
 */
export function useCentroEstudios(): UseCentroEstudiosReturn {
  const { configClub } = useConfiguracion();
  const centroEstudiosActivo = configClub?.features?.centroEstudios === true;
  return { centroEstudiosActivo };
}
