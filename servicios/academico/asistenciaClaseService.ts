// servicios/academico/asistenciaClaseService.ts
//
// Wrapper delgado del callable server-side `registrarAsistenciaJornada`
// (functions/academico/asistencia.js, Fase 1). Mismo patron que
// `publicarAsignacion` (asignacionService.ts): invoca la Cloud Function real
// cuando Firebase esta configurado, y devuelve una respuesta simulada en modo
// demo/desarrollo sin Firebase (para no romper la vista si se renderiza sin
// backend real configurado).
//
// El callable hace toggle server-side (design.md, Decision 2): 1er escaneo de
// un estudiante = check-in ('entrada'), 2do = check-out ('salida', incluye
// minutosAsistidos), 3ro es rechazado por el callable.
import { getFunctions, httpsCallable } from 'firebase/functions';
import { isFirebaseConfigured } from '../../firebase/config';

export interface RegistrarAsistenciaClaseRequest {
  tenantId: string;
  jornadaId: string;
  estudianteId: string;
}

export interface RegistrarAsistenciaClaseResponse {
  ok: boolean;
  tipo: 'entrada' | 'salida';
  hora: string;
  minutosAsistidos?: number;
}

export async function registrarAsistenciaClase(
  request: RegistrarAsistenciaClaseRequest
): Promise<RegistrarAsistenciaClaseResponse> {
  if (isFirebaseConfigured) {
    const callable = httpsCallable<RegistrarAsistenciaClaseRequest, RegistrarAsistenciaClaseResponse>(
      getFunctions(),
      'registrarAsistenciaJornada'
    );
    const response = await callable(request);
    return response.data;
  }

  return {
    ok: true,
    tipo: 'entrada',
    hora: new Date().toISOString(),
  };
}
