import { getFunctions, httpsCallable } from 'firebase/functions';

export async function debugValidacionAsistencia(
  tenantId: string,
  jornadaId: string,
  estudianteId: string
) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, 'debugValidacionAsistencia');
  try {
    const result = await callable({ tenantId, jornadaId, estudianteId });
    return result.data;
  } catch (error) {
    console.error('Error en debug de asistencia:', error);
    throw error;
  }
}
