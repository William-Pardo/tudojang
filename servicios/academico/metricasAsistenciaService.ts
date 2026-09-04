// servicios/academico/metricasAsistenciaService.ts
// Lectura del acumulado real de horas de asistencia a Clase en Vivo
// (tenants/{tenantId}/metricasAsistencia/{estudianteId}, ver
// models/academico/metricasAsistencia.ts). Escrito exclusivamente server-side por el
// callable registrarAsistenciaJornada (functions/academico/asistencia.js) al hacer
// check-out -- este servicio solo lee.
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { MetricasAsistencia } from '../../models/academico/metricasAsistencia';

export async function obtenerMetricasAsistencia(
    tenantId: string,
    estudianteId: string
): Promise<MetricasAsistencia | null> {
    if (!isFirebaseConfigured || !tenantId || !estudianteId) return null;
    const ref = doc(db, 'tenants', tenantId, 'metricasAsistencia', estudianteId);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as MetricasAsistencia) : null;
}
