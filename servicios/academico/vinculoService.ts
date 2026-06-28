import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';

export interface VinculoTutorEstudiante {
  id: string;
  tutorEmail: string;
  estudianteId: string;
  tenantId: string;
  creadoEn: string;
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
      creadoEn: new Date().toISOString()
    };
    mockVinculos.push(newMock);
    return id;
  }

  const docRef = doc(db, 'tenants', tenantId, 'vinculos', id);
  const vinculoData: VinculoTutorEstudiante = {
    id,
    tutorEmail: emailLimpio,
    estudianteId,
    tenantId,
    creadoEn: new Date().toISOString()
  };

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

