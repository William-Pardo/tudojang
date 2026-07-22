// services/academico/asignacionService.ts
// Servicio mínimo de asignaciones académicas.
// Versión inicial controlada: todavía NO conecta con Firestore.
// Usa datos demo para permitir construir la vista sin romper la app.

import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { AsignacionAcademica, DestinatarioAsignacion, TipoDestinatarioAsignacion } from '../../models/academico/asignacion';
import type { MomentoAsignacion } from '../../models/academico';
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
    youtubeVideoId: recurso.youtubeVideoId ?? null,
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

// Subtarea 12.9: primer consumidor real es la pestana "Materiales" del modal de edicion
// singular de Agenda (components/academico/ModalEdicionJornada.tsx), via
// PestanaMaterialesJornada (12.7, sin consumidor real hasta ahora). AsignacionesView.tsx ya
// resuelve este mismo problema (armar+validar+persistir una AsignacionAcademica a partir de
// un AsignacionDraft del wizard) con helpers PRIVADOS (crearDestinatario, mapearCriterioAUso,
// confirmarWizard) que no estan exportados. En vez de reabrir ese archivo grande y activamente
// tocado por otra sesion para exportar 3 helpers, se centraliza aca una version de servicio
// reutilizable equivalente: valida el recurso con publishAsignacion (funcion pura ya
// existente en este mismo archivo) y persiste con publicarAsignacion (mismo Cloud Function
// real que ya usa AsignacionesView) -- NO se inventa un segundo camino de persistencia.
export interface AsignarMaterialAJornadaInput {
  tenantId: string;
  jornadaId: string;
  recurso: RecursoAcademico;
  recursoId: string;
  tipoDestinatario: TipoDestinatarioAsignacion;
  grupoObjetivo: string;
  grados: string[];
  momento: MomentoAsignacion;
  criterio: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';
  fechaApertura: string;
  fechaCierre?: string;
  publicadoPorUid: string;
  /** Si se pasa (modo editar), reutiliza este id en vez de generar uno nuevo determinista. */
  asignacionIdExistente?: string;
}

function construirDestinatarioMaterial(
  tipo: TipoDestinatarioAsignacion,
  grupo: string,
  grados: string[],
): DestinatarioAsignacion {
  if (tipo === 'estudiante') {
    return {
      tipo,
      estudianteIds: grupo.split(',').map((item) => item.trim()).filter(Boolean),
    };
  }
  return {
    tipo,
    grupo: grupo.trim(),
    grados: grados.map((grado) => grado.trim()).filter(Boolean),
  };
}

// Mismo mapeo que el helper privado mapearCriterioAUso de AsignacionesView.tsx: 'quiz' ->
// 'evaluacion', 'repaso' -> 'estudio', el resto pasa igual (los valores coinciden con
// UsoAcademico salvo esos dos casos).
function mapearCriterioAUsoAcademico(criterio: AsignarMaterialAJornadaInput['criterio']) {
  if (criterio === 'quiz') return 'evaluacion' as const;
  if (criterio === 'repaso') return 'estudio' as const;
  return criterio;
}

export async function asignarMaterialAJornada(
  input: AsignarMaterialAJornadaInput,
): Promise<PublicarAsignacionResponse> {
  const id = input.asignacionIdExistente ?? `asignacion-agenda-${input.jornadaId}-${input.recursoId}`;
  const destinatario = construirDestinatarioMaterial(input.tipoDestinatario, input.grupoObjetivo, input.grados);
  const ahora = new Date().toISOString();

  const asignacion = publishAsignacion({
    asignacion: {
      id,
      tenantId: input.tenantId,
      recursoId: input.recursoId,
      jornadaId: input.jornadaId,
      titulo: input.recurso.tituloVisible || input.recurso.nombre,
      tags: input.recurso.ficha?.tags ?? [],
      destinatario,
      uso: mapearCriterioAUsoAcademico(input.criterio),
      momento: input.momento,
      obligatoria: true,
      fechaApertura: input.fechaApertura,
      fechaCierre: input.fechaCierre,
      estado: 'publicada',
      creadoPorUid: input.publicadoPorUid,
      creadoEn: ahora,
      actualizadoEn: ahora,
    },
    recurso: input.recurso,
    publicadoPorUid: input.publicadoPorUid,
  });

  return publicarAsignacion({ tenantId: input.tenantId, jornadaId: input.jornadaId, asignacion });
}
