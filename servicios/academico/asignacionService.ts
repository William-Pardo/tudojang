// services/academico/asignacionService.ts
// Servicio mínimo de asignaciones académicas.
// Versión inicial controlada: todavía NO conecta con Firestore.
// Usa datos demo para permitir construir la vista sin romper la app.

import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { RecursoAcademico } from '../../models/academico/recurso';
import type {
  AsignacionCentroEstudios,
  ActualizarAsignacionRequest,
  ActualizarAsignacionResponse,
  EliminarAsignacionRequest,
  EliminarAsignacionResponse,
  ObtenerAsignacionesRequest,
  ObtenerAsignacionesResponse,
  PublicarAsignacionRequest,
  PublicarAsignacionResponse,
  PublicarAsignacionesBatchRequest,
  PublicarAsignacionesBatchResponse,
} from '../../models/academico/asignacionService.types';
import { calcularUrgenciaAsignacion, ordenarAsignacionesPorUrgencia } from '../../utils/academico/centroEstudios.ts';

export type { PublicarAsignacionResponse } from '../../models/academico/asignacionService.types';

interface EstudianteAsignacion {
  id: string;
  grupo?: string;
  grado?: string;
}

interface GetAsignacionesByEstudianteInput {
  tenantId: string;
  estudiante: EstudianteAsignacion;
  asignaciones: AsignacionAcademica[];
}

interface ValidateAsignacionInput {
  asignacion: AsignacionAcademica;
  recurso: RecursoAcademico;
}

type ValidateAsignacionResult =
  | { valid: true }
  | { valid: false; reason: 'tenant_no_coincide' | 'recurso_no_aprobado' | 'recurso_no_coincide' };

interface PublishAsignacionInput extends ValidateAsignacionInput {
  publicadoPorUid: string;
}

export type EstadoTemporalAsignacion = AsignacionAcademica['estado'] | 'bloqueada';

const ahora = new Date().toISOString();

const asignacionesDemo: AsignacionAcademica[] = [
  {
    id: 'demo-teoria-basica',
    tenantId: 'demo',
    recursoId: 'recurso-demo-1',
    titulo: 'Fundamentos técnicos del dojang',
    descripcion: 'Video corto para repasar postura, saludo, disciplina y reglas básicas antes de clase.',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    fechaCierre: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    estado: 'publicada',
    creadoPorUid: 'demo-admin',
    creadoEn: ahora,
    actualizadoEn: ahora,
  },
  {
    id: 'demo-refuerzo-patada',
    tenantId: 'demo',
    recursoId: 'recurso-demo-2',
    titulo: 'Refuerzo: patada frontal y control',
    descripcion: 'Material de práctica para corregir equilibrio, cámara y extensión de la técnica.',
    destinatario: { tipo: 'grado', grupo: 'Precadetes', grados: ['Blanco', 'Amarillo'] },
    uso: 'refuerzo',
    momento: 'refuerzo_posterior',
    obligatoria: false,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'demo-admin',
    creadoEn: ahora,
    actualizadoEn: ahora,
  },
  {
    id: 'demo-quiz-seguridad',
    tenantId: 'demo',
    recursoId: 'recurso-demo-3',
    titulo: 'Quiz: seguridad y conducta',
    descripcion: 'Evaluación rápida para verificar comprensión de normas de entrenamiento.',
    destinatario: { tipo: 'grupo', grupo: 'Todos' },
    uso: 'evaluacion',
    momento: 'durante',
    obligatoria: true,
    fechaApertura: ahora,
    fechaCierre: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    estado: 'publicada',
    creadoPorUid: 'demo-admin',
    creadoEn: ahora,
    actualizadoEn: ahora,
  },
];

function obtenerFixtureCypress(): AsignacionCentroEstudios[] | null {
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (!win?.Cypress || !Array.isArray(win.__CENTRO_ESTUDIOS_ASIGNACIONES__)) return null;
  return win.__CENTRO_ESTUDIOS_ASIGNACIONES__ as AsignacionCentroEstudios[];
}

export async function obtenerAsignacionesPorEstudiante(
  request: ObtenerAsignacionesRequest
): Promise<ObtenerAsignacionesResponse> {
  const tenantId = request.tenantId?.trim();
  const estudianteId = request.estudianteId?.trim();

  if (!tenantId || !estudianteId) {
    return { asignaciones: [] };
  }

  const fixtureCypress = obtenerFixtureCypress();
  if (fixtureCypress) {
    return { asignaciones: ordenarAsignacionesPorUrgencia(fixtureCypress) };
  }

  const asignaciones: AsignacionCentroEstudios[] = asignacionesDemo.map((asignacion, indice) => ({
    ...asignacion,
    tenantId,
    estadoProgreso: indice === 0 ? 'en_progreso' : indice === 1 ? 'disponible' : 'completado',
    porcentajeProgreso: indice === 0 ? 35 : indice === 1 ? 0 : 100,
    urgencia: calcularUrgenciaAsignacion(asignacion.fechaCierre),
  }));

  return { asignaciones: ordenarAsignacionesPorUrgencia(asignaciones) };
}

export async function listarAsignacionesPorTenant(tenantId: string): Promise<AsignacionAcademica[]> {
  if (!tenantId || !isFirebaseConfigured) return [];

  const snap = await getDocs(collection(db, 'tenants', tenantId, 'asignaciones'));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) } as AsignacionAcademica));
}

export function aplicaAlEstudiante(asignacion: AsignacionAcademica, estudiante: EstudianteAsignacion): boolean {
  const { destinatario } = asignacion;

  if (destinatario.tipo === 'estudiante') {
    return destinatario.estudianteIds?.includes(estudiante.id) ?? false;
  }

  if (destinatario.tipo === 'grupo') {
    return destinatario.grupo === estudiante.grupo || destinatario.grupo === 'Todos';
  }

  if (destinatario.tipo === 'grado') {
    const grupoCoincide = !destinatario.grupo || destinatario.grupo === estudiante.grupo || destinatario.grupo === 'Todos';
    const gradoCoincide = !destinatario.grados?.length || Boolean(estudiante.grado && destinatario.grados.includes(estudiante.grado));

    return grupoCoincide && gradoCoincide;
  }

  return false;
}

export function getAsignacionesByEstudiante({
  tenantId,
  estudiante,
  asignaciones,
}: GetAsignacionesByEstudianteInput): AsignacionAcademica[] {
  return asignaciones.filter((asignacion) => (
    asignacion.tenantId === tenantId
    && asignacion.estado === 'publicada'
    && aplicaAlEstudiante(asignacion, estudiante)
  ));
}

function fechaValida(value?: string): Date | null {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function resolverEstadoTemporalAsignacion(
  asignacion: AsignacionAcademica,
  ahoraReferencia: Date = new Date()
): EstadoTemporalAsignacion {
  if (asignacion.estado !== 'publicada') {
    return asignacion.estado;
  }

  const apertura = fechaValida(asignacion.fechaApertura);
  if (apertura && ahoraReferencia < apertura) {
    return 'bloqueada';
  }

  const cierre = fechaValida(asignacion.fechaCierre);
  if (cierre && ahoraReferencia > cierre) {
    return 'vencida';
  }

  return 'publicada';
}

export function transicionarAsignacionesVencidas(
  asignaciones: AsignacionAcademica[],
  ahoraReferencia: Date = new Date()
): AsignacionAcademica[] {
  return asignaciones.map((asignacion) => {
    const estadoTemporal = resolverEstadoTemporalAsignacion(asignacion, ahoraReferencia);
    if (estadoTemporal !== 'vencida') return asignacion;

    return {
      ...asignacion,
      estado: 'vencida',
      actualizadoEn: ahoraReferencia.toISOString(),
    };
  });
}

export function validateAsignacion({
  asignacion,
  recurso,
}: ValidateAsignacionInput): ValidateAsignacionResult {
  if (asignacion.tenantId !== recurso.tenantId) {
    return { valid: false, reason: 'tenant_no_coincide' };
  }

  if (asignacion.recursoId !== recurso.id) {
    return { valid: false, reason: 'recurso_no_coincide' };
  }

  if (recurso.estado !== 'aprobado') {
    return { valid: false, reason: 'recurso_no_aprobado' };
  }

  return { valid: true };
}

export function publishAsignacion({
  asignacion,
  recurso,
  publicadoPorUid,
}: PublishAsignacionInput): AsignacionAcademica {
  const validacion = validateAsignacion({ asignacion, recurso });

  if (!validacion.valid) {
    if (validacion.reason === 'recurso_no_aprobado') {
      throw new Error('La asignacion solo puede publicarse con un recurso aprobado.');
    }

    throw new Error(`Asignacion invalida: ${validacion.reason}`);
  }

  return {
    ...asignacion,
    recursoId: recurso.id,
    externalFileId: recurso.externalFileId,
    estado: 'publicada',
    creadoPorUid: publicadoPorUid,
    actualizadoEn: new Date().toISOString(),
  };
}

export async function publicarAsignacion(
  request: PublicarAsignacionRequest
): Promise<PublicarAsignacionResponse> {
  if (isFirebaseConfigured) {
    const callable = httpsCallable<PublicarAsignacionRequest, { ok: boolean; asignacionId: string }>(
      getFunctions(),
      'publishAsignacion'
    );
    const response = await callable(request);
    return {
      ok: response.data.ok,
      id: response.data.asignacionId,
    };
  }

  return {
    ok: true,
    id: request.asignacion.id,
  };
}

export async function publicarAsignacionesBatch(
  request: PublicarAsignacionesBatchRequest
): Promise<PublicarAsignacionesBatchResponse> {
  if (isFirebaseConfigured) {
    const callable = httpsCallable<PublicarAsignacionesBatchRequest, PublicarAsignacionesBatchResponse>(
      getFunctions(),
      'publishAsignacionesBatch'
    );
    const response = await callable(request);
    return response.data;
  }

  return {
    ok: true,
    created: request.recursoIds.flatMap((recursoId) =>
      request.jornadaIds.map((jornadaId) => `asignacion-${recursoId}-${jornadaId}`)
    ),
    skipped: [],
  };
}

export async function actualizarAsignacion(
  request: ActualizarAsignacionRequest
): Promise<ActualizarAsignacionResponse> {
  const { asignacion } = request;
  const tenantId = asignacion?.tenantId;
  const jornadaId = asignacion?.jornadaId;

  if (!asignacion?.id || !tenantId || !jornadaId) {
    return { ok: false };
  }

  const respuesta = await publicarAsignacion({ tenantId, jornadaId, asignacion });

  return { ok: respuesta.ok };
}

export async function eliminarAsignacion(
  request: EliminarAsignacionRequest
): Promise<EliminarAsignacionResponse> {
  const tenantId = request.tenantId?.trim();
  const asignacionId = request.asignacionId?.trim();

  if (!tenantId || !asignacionId) {
    return { ok: false };
  }

  // 1. Eliminar la asignación principal
  await deleteDoc(doc(db, 'tenants', tenantId, 'asignaciones', asignacionId));

  // 2. Eliminar el progreso de todos los estudiantes para esta asignación
  if (isFirebaseConfigured) {
    try {
      const progresoRef = collection(db, 'tenants', tenantId, 'progreso');
      const progresoSnap = await getDocs(progresoRef);
      const promesas = progresoSnap.docs.map(async (estudianteDoc) => {
        const progressDocRef = doc(db, 'tenants', tenantId, 'progreso', estudianteDoc.id, 'asignaciones', asignacionId);
        await deleteDoc(progressDocRef);
      });
      await Promise.all(promesas);
    } catch (err) {
      console.warn('[eliminarAsignacion] No se pudo limpiar el progreso de los estudiantes:', err);
    }
  }

  return { ok: true };
}
