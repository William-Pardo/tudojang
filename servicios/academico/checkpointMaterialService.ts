// servicios/academico/checkpointMaterialService.ts
// Checkpoint pedagógico de los materiales de una clase (WS-4, Módulo Clase en Vivo §9).
//
// Los materiales de una jornada son las `AsignacionAcademica` con `jornadaId === jornadaId`
// (mismo criterio que AgendaView/hubEstudiantesService). Cada uno se marca con un estado
// (planeado/usado/practicado/…) + nota corta opcional. Subcolección:
//   tenants/{tenantId}/jornadas/{jornadaId}/checkpointMateriales/{asignacionId}
//
// Escritura desde el cliente (staff), gateada por firestore.rules (isInstructor + tenant) —
// no requiere callable: no hay cruce de roster como en la asistencia, y es baja frecuencia.

import { collection, doc, getDoc, getDocs, query, setDoc, where, Firestore } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import {
  CheckpointMaterialJornada,
  EstadoCheckpointMaterial,
  LIMITE_NOTA_CHECKPOINT,
} from '../../models/academico/checkpointMaterial';

export interface MaterialDeJornada {
  asignacionId: string;
  titulo: string;
}

// Almacenamiento en memoria para modo local / tests.
let _mockCheckpoints: CheckpointMaterialJornada[] = [];
let _mockAsignaciones: Array<{ id: string; tenantId: string; jornadaId?: string; titulo: string }> = [];

export const __resetMockCheckpoints = () => { _mockCheckpoints = []; };
export const __setMockAsignaciones = (a: typeof _mockAsignaciones) => { _mockAsignaciones = a; };

export interface CheckpointMaterialServiceDeps {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
}

const truncarNota = (nota?: string): string | undefined => {
  if (typeof nota !== 'string') return undefined;
  const limpia = nota.trim();
  if (!limpia) return undefined;
  return limpia.slice(0, LIMITE_NOTA_CHECKPOINT);
};

export const crearCheckpointMaterialService = (deps: CheckpointMaterialServiceDeps = {}) => {
  const getDb = () => deps.db ?? db;
  const firebaseActivo = () =>
    deps.isFirebaseConfigured !== undefined ? deps.isFirebaseConfigured : isFirebaseConfigured;

  /** Materiales asignados a la jornada (las `asignaciones` con este `jornadaId`). */
  const listarMaterialesDeJornada = async (
    tenantId: string,
    jornadaId: string,
  ): Promise<MaterialDeJornada[]> => {
    if (!firebaseActivo()) {
      return _mockAsignaciones
        .filter((a) => a.tenantId === tenantId && a.jornadaId === jornadaId)
        .map((a) => ({ asignacionId: a.id, titulo: a.titulo }));
    }

    const ref = collection(getDb(), 'tenants', tenantId, 'asignaciones');
    const snap = await getDocs(query(ref, where('jornadaId', '==', jornadaId)));
    return snap.docs.map((d) => {
      const data = d.data() as { titulo?: string };
      return { asignacionId: d.id, titulo: data.titulo ?? '(Sin título)' };
    });
  };

  /** Marca (o re-marca) el estado de un material en esta jornada. Doc-id = asignacionId. */
  const guardarCheckpoint = async (
    tenantId: string,
    jornadaId: string,
    entrada: { asignacionId: string; estado: EstadoCheckpointMaterial; notaCorta?: string },
    registradoPorUid: string,
  ): Promise<void> => {
    const registro: CheckpointMaterialJornada = {
      asignacionId: entrada.asignacionId,
      jornadaId,
      tenantId,
      estado: entrada.estado,
      registradoPorUid,
      actualizadoEn: new Date().toISOString(),
    };
    const nota = truncarNota(entrada.notaCorta);
    if (nota !== undefined) registro.notaCorta = nota;

    if (!firebaseActivo()) {
      _mockCheckpoints = [
        ..._mockCheckpoints.filter(
          (c) => !(c.tenantId === tenantId && c.jornadaId === jornadaId && c.asignacionId === entrada.asignacionId),
        ),
        registro,
      ];
      return;
    }

    const ref = doc(getDb(), 'tenants', tenantId, 'jornadas', jornadaId, 'checkpointMateriales', entrada.asignacionId);
    await setDoc(ref, registro);
  };

  /** Todos los checkpoints registrados de la jornada (para el resumen de cierre §9.3). */
  const listarCheckpoints = async (
    tenantId: string,
    jornadaId: string,
  ): Promise<CheckpointMaterialJornada[]> => {
    if (!firebaseActivo()) {
      return _mockCheckpoints.filter((c) => c.tenantId === tenantId && c.jornadaId === jornadaId);
    }

    const ref = collection(getDb(), 'tenants', tenantId, 'jornadas', jornadaId, 'checkpointMateriales');
    const snap = await getDocs(ref);
    return snap.docs.map((d) => d.data() as CheckpointMaterialJornada);
  };

  return { listarMaterialesDeJornada, guardarCheckpoint, listarCheckpoints };
};

// Tipo del servicio (no la factory): permite tipar props/mocks en la UI (ClaseEnVivoView, §15.D)
// sin acoplarse a la forma interna de `crearCheckpointMaterialService`.
export type CheckpointMaterialService = ReturnType<typeof crearCheckpointMaterialService>;

export const checkpointMaterialService = crearCheckpointMaterialService();
