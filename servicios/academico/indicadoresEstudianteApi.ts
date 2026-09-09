
// servicios/academico/indicadoresEstudianteApi.ts
// Cliente del módulo "Indicadores de Estudiante" (analítica determinística SIN IA, ver
// functions/academico/indicadoresEstudiante.js). El cálculo/upsert corre exclusivamente en el
// cron `indicadoresEstudianteDiarios` -- este servicio solo LEE la bitácora y delega la
// resolución de un hallazgo en la Cloud Function callable `resolverHallazgoIndicador`.
import { collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { IndicadorEstudiante } from '../../tipos';

/**
 * ADMIN/STAFF: todos los indicadores del tenant con al menos un hallazgo SIN resolver.
 *
 * `hallazgos` es un array dentro de cada documento -- Firestore no puede filtrar sub-campos de
 * elementos de un array en una query, así que se trae cada doc de `indicadoresEstudiante` del
 * tenant (uno por estudiante que ALGUNA VEZ tuvo un hallazgo, ver el WHY en
 * functions/academico/indicadoresEstudiante.js sobre por qué no se crea un doc por cada
 * estudiante sano) y se filtra en memoria.
 */
export const obtenerIndicadoresPendientes = async (tenantId: string): Promise<IndicadorEstudiante[]> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured || !tenantId) return [];
    const ref = collection(db, 'tenants', tenantId, 'indicadoresEstudiante');
    const snap = await getDocs(ref);
    return snap.docs
        .map((d) => ({ ...(d.data() as IndicadorEstudiante) }))
        .filter((indicador) => indicador.hallazgos.some((h) => !h.resuelto));
};

/**
 * ADMIN/STAFF: marca un hallazgo como resuelto (con nota opcional).
 *
 * Wrapper delgado sobre el callable `resolverHallazgoIndicador` -- NO es un `updateDoc` directo
 * (ver el WHY completo en firestore.rules, match de `indicadoresEstudiante`: Security Rules no
 * puede validar de forma segura una escritura acotada a 4 campos DENTRO de un elemento de un
 * array de tamaño variable, así que la validación real corre server-side).
 */
export const resolverHallazgo = async (
    tenantId: string,
    estudianteId: string,
    hallazgoId: string,
    nota?: string
): Promise<void> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return;
    const callable = httpsCallable<
        { tenantId: string; estudianteId: string; hallazgoId: string; nota?: string },
        { ok: boolean }
    >(getFunctions(), 'resolverHallazgoIndicador');
    await callable({ tenantId, estudianteId, hallazgoId, nota });
};
