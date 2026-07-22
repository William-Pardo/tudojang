import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { Estudiante } from '../../tipos';

export interface VinculoTutorEstudiante {
  id: string;
  tutorEmail: string;
  estudianteId: string;
  tenantId: string;
  creadoEn: string;
  studentAuthUid?: string; // Auth UID del estudiante (agregado en Fase 1)
  tutorId?: string; // Auth UID del tutor (agregado en Fase 1)
}

// In-memory mock storage for local/test mode
let mockVinculos: VinculoTutorEstudiante[] = [];

export const clearMockVinculos = () => {
  mockVinculos = [];
};

export const getMockVinculos = () => mockVinculos;

export const linkTutorEstudiante = async (
  tenantId: string,
  tutorEmail: string,
  estudianteId: string
): Promise<string> => {
  const emailLimpio = tutorEmail.toLowerCase().trim();
  const id = `${emailLimpio}_${estudianteId}`;

  if (!isFirebaseConfigured) {
    // Check if already exists
    const existing = mockVinculos.find(v => v.id === id && v.tenantId === tenantId);
    if (existing) return existing.id;

    const newMock: VinculoTutorEstudiante = {
      id,
      tutorEmail: emailLimpio,
      estudianteId,
      tenantId,
      creadoEn: new Date().toISOString(),
      studentAuthUid: undefined
    };
    mockVinculos.push(newMock);
    return id;
  }

  // FASE 4: Leer el Estudiante doc para obtener su authUid
  let studentAuthUid: string | undefined;
  try {
    const estudianteRef = doc(db, 'estudiantes', estudianteId);
    const estudianteSnap = await getDoc(estudianteRef);
    if (estudianteSnap.exists()) {
      const estudianteData = estudianteSnap.data() as Estudiante;
      studentAuthUid = estudianteData.authUid; // Campo agregado en Fase 1
    }
  } catch (err) {
    // Log pero no bloques si hay error al leer estudiante
    console.error(`No se pudo leer Estudiante ${estudianteId}:`, err);
  }

  const docRef = doc(db, 'tenants', tenantId, 'vinculos', id);
  const vinculoData: VinculoTutorEstudiante = {
    id,
    tutorEmail: emailLimpio,
    estudianteId,
    tenantId,
    creadoEn: new Date().toISOString(),
  };
  // Firestore rechaza valores `undefined`. Solo incluimos studentAuthUid si existe.
  // (El vínculo tutor↔estudiante real ya vive en estudiante.tutor.correo; este doc es
  // complementario y no debe romperse cuando el estudiante aún no tiene authUid.)
  if (studentAuthUid) {
    vinculoData.studentAuthUid = studentAuthUid;
  }

  await setDoc(docRef, vinculoData);
  return id;
};

export const unlinkTutorEstudiante = async (
  tenantId: string,
  tutorEmail: string,
  estudianteId: string
): Promise<void> => {
  const emailLimpio = tutorEmail.toLowerCase().trim();
  const id = `${emailLimpio}_${estudianteId}`;

  if (!isFirebaseConfigured) {
    mockVinculos = mockVinculos.filter(v => !(v.id === id && v.tenantId === tenantId));
    return;
  }

  const docRef = doc(db, 'tenants', tenantId, 'vinculos', id);
  await deleteDoc(docRef);
};

export const getEstudiantesByTutor = async (
  tenantId: string,
  tutorEmail: string
): Promise<string[]> => {
  const emailLimpio = tutorEmail.toLowerCase().trim();

  if (!isFirebaseConfigured) {
    return mockVinculos
      .filter(v => v.tutorEmail === emailLimpio && v.tenantId === tenantId)
      .map(v => v.estudianteId);
  }

  const colRef = collection(db, 'tenants', tenantId, 'vinculos');
  const q = query(colRef, where('tutorEmail', '==', emailLimpio));
  const snap = await getDocs(q);

  return snap.docs.map(docSnap => (docSnap.data() as VinculoTutorEstudiante).estudianteId);
};

export const listVinculos = async (tenantId: string): Promise<VinculoTutorEstudiante[]> => {
  if (!isFirebaseConfigured) {
    return mockVinculos.filter(v => v.tenantId === tenantId);
  }

  const colRef = collection(db, 'tenants', tenantId, 'vinculos');
  const snap = await getDocs(colRef);
  return snap.docs.map(docSnap => docSnap.data() as VinculoTutorEstudiante);
};

