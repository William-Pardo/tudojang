// utils/academico/erroresAcademicos.ts
// Mapea errores técnicos (FirebaseError, respuestas en inglés, excepciones de red)
// a mensajes en español claros y comprensibles para el usuario.

export function mapearErrorAcademico(err: unknown, fallback = 'No se pudo guardar el video.'): string {
  if (!err) return fallback;

  const errorObj = err as { code?: string; message?: string };
  const rawMessage = (errorObj.message || (typeof err === 'string' ? err : '')).trim();
  const rawCode = (errorObj.code || '').trim().toLowerCase();
  const lowerMsg = rawMessage.toLowerCase();

  // Permisos insuficientes (Firestore Security Rules / Cloud Functions)
  if (
    rawCode === 'permission-denied' ||
    rawCode.includes('permission-denied') ||
    lowerMsg.includes('missing or insufficient permissions') ||
    lowerMsg.includes('permission-denied') ||
    lowerMsg.includes('insufficient permissions') ||
    lowerMsg.includes('permisos insuficientes')
  ) {
    return 'Permisos insuficientes para realizar esta acción. Verifica los permisos de tu cuenta.';
  }

  // No autenticado / sesión expirada
  if (
    rawCode === 'unauthenticated' ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('sesion expiro') ||
    lowerMsg.includes('sesión expiró')
  ) {
    return 'Tu sesión ha expirado. Vuelve a iniciar sesión e intenta de nuevo.';
  }

  // Red / Servidor no disponible
  if (
    rawCode === 'unavailable' ||
    rawCode === 'network-request-failed' ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('offline')
  ) {
    return 'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.';
  }

  // Recurso no encontrado
  if (rawCode === 'not-found' || lowerMsg.includes('not-found') || lowerMsg.includes('no encontrado')) {
    return 'El recurso solicitado no fue encontrado.';
  }

  return rawMessage || fallback;
}
