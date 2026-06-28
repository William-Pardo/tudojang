import type { ConfiguracionClub } from '../tipos';
import { PLANES_SAAS } from '../constantes';

type LimiteBase = 'limiteEstudiantes' | 'limiteUsuarios' | 'limiteSedes';
type CampoAdicional = 'cuposEstudiantesAdicionales' | 'cuposUsuariosAdicionales' | 'cuposSedesAdicionales';

const CAMPOS_ADICIONALES: Record<LimiteBase, CampoAdicional> = {
    limiteEstudiantes: 'cuposEstudiantesAdicionales',
    limiteUsuarios: 'cuposUsuariosAdicionales',
    limiteSedes: 'cuposSedesAdicionales',
};

export const obtenerLimitePlan = (configClub: ConfiguracionClub | null | undefined, campo: LimiteBase): number => {
    if (!configClub) return 0;
    const plan = (PLANES_SAAS as any)[configClub.plan];
    return Number(plan?.[campo]) || 0;
};

export const obtenerLimiteEquipoTecnico = (configClub: ConfiguracionClub | null | undefined): number => {
    const limitePlan = obtenerLimitePlan(configClub, 'limiteUsuarios');
    const cuposAdicionales = Number((configClub as any)?.cuposUsuariosAdicionales) || 0;
    return limitePlan > 0 ? limitePlan + 1 + cuposAdicionales : 0;
};

export const obtenerLimiteOperativo = (configClub: ConfiguracionClub | null | undefined, campo: LimiteBase): number => {
    if (campo === 'limiteUsuarios') return obtenerLimiteEquipoTecnico(configClub);
    const limitePlan = obtenerLimitePlan(configClub, campo);
    const campoAdicional = CAMPOS_ADICIONALES[campo];
    const cuposAdicionales = Number((configClub as any)?.[campoAdicional]) || 0;
    return limitePlan + cuposAdicionales;
};
