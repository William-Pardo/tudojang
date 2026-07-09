import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { EstadoInvitacion, RolAcademico } from '../../models/academico';

export interface InvitacionUsuario {
  id: string;
  email: string;
  rol: RolAcademico;
  tenantId: string;
  estado: EstadoInvitacion;
  creadoPor: string;
  creadoEn: string;
  expiraEn: string;
  actionLink?: string;
  activationLink?: string;
  aceptadaEn?: string;
  uid?: string;
}

// In-memory mock storage for local/test mode
let mockInvitations: InvitacionUsuario[] = [];

export const clearMockInvitations = () => {
  mockInvitations = [];
};

export const getMockInvitations = () => mockInvitations;

export const createInvitation = async (
  tenantId: string,
  email: string,
  rol: RolAcademico
): Promise<InvitacionUsuario> => {
  const emailLimpio = email.toLowerCase().trim();

  if (!isFirebaseConfigured) {
    const ahora = new Date();
    const expira = new Date();
    expira.setDate(expira.getDate() + 7);
    const id = `inv-${Date.now()}`;
    
    const newMock: InvitacionUsuario = {
      id,
      email: emailLimpio,
      rol,
      tenantId,
      estado: 'pendiente',
      creadoPor: 'mock-admin-uid',
      creadoEn: ahora.toISOString(),
      expiraEn: expira.toISOString(),
      activationLink: `http://localhost:5173/#/activar-cuenta?tenantId=${encodeURIComponent(tenantId)}&invitacionId=${encodeURIComponent(id)}&token=mock-token`
    };
    mockInvitations.push(newMock);
    return newMock;
  }

  const inviteUserCF = httpsCallable<
    { email: string; rol: RolAcademico; tenantId: string },
    { ok: boolean; invitacionId: string; expiraEn: string }
  >(getFunctions(), 'inviteUser');

  const response = await inviteUserCF({ email: emailLimpio, rol, tenantId });
  const { invitacionId } = response.data;

  const docRef = doc(db, 'tenants', tenantId, 'invitaciones', invitacionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('La invitación se creó pero no se pudo encontrar en Firestore');
  }

  return { id: snap.id, ...snap.data() } as InvitacionUsuario;
};

export const listInvitations = async (tenantId: string): Promise<InvitacionUsuario[]> => {
  if (!isFirebaseConfigured) {
    return mockInvitations.filter(inv => inv.tenantId === tenantId);
  }

  const colRef = collection(db, 'tenants', tenantId, 'invitaciones');
  const snap = await getDocs(colRef);
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as InvitacionUsuario));
};

export const resendInvitation = async (tenantId: string, invitationId: string): Promise<void> => {
  if (!isFirebaseConfigured) {
    const inv = mockInvitations.find(i => i.id === invitationId && i.tenantId === tenantId);
    if (!inv) throw new Error('Invitación no encontrada');
    inv.creadoEn = new Date().toISOString();
    const expira = new Date(Date.now() + 86400000 * 7 + 10000); // 10s offset to guarantee a different string
    inv.expiraEn = expira.toISOString();
    return;
  }

  const docRef = doc(db, 'tenants', tenantId, 'invitaciones', invitationId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Invitación no encontrada');
  }

  const invData = snap.data() as Omit<InvitacionUsuario, 'id'>;

  const inviteUserCF = httpsCallable<
    { email: string; rol: RolAcademico; tenantId: string },
    { ok: boolean; invitacionId: string; expiraEn: string }
  >(getFunctions(), 'inviteUser');

  await inviteUserCF({ email: invData.email, rol: invData.rol, tenantId });
  
  await updateDoc(docRef, { estado: 'revocada' });
};

export const acceptInvitation = async (
  tenantId: string,
  invitacionId: string,
  token: string,
  password: string
): Promise<{ ok: boolean; uid: string }> => {
  if (!tenantId || !invitacionId || !token || !password) {
    throw new Error('El enlace de activación está incompleto.');
  }

  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  if (!isFirebaseConfigured) {
    const inv = mockInvitations.find(
      item => item.tenantId === tenantId && item.id === invitacionId && item.estado === 'pendiente'
    );
    if (!inv) throw new Error('Invitación no encontrada o ya utilizada.');
    inv.estado = 'aceptada';
    inv.aceptadaEn = new Date().toISOString();
    inv.uid = `mock-${invitacionId}`;
    return { ok: true, uid: inv.uid };
  }

  const acceptInvitationCF = httpsCallable<
    { tenantId: string; invitacionId: string; token: string; password: string },
    { ok: boolean; uid: string }
  >(getFunctions(), 'acceptInvitation');

  const response = await acceptInvitationCF({ tenantId, invitacionId, token, password });
  return response.data;
};
