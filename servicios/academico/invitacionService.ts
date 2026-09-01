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
  // Fix tutor-role-end-to-end (2026-07-14): la Cloud Function `inviteUser` crea la
  // invitación en Firestore ANTES de intentar enviar el correo (Resend). Si el envío
  // de correo falla (infra), la invitación igual existe con su `activationLink`. Este
  // flag distingue "correo enviado" de "invitación creada pero correo no enviado", para
  // que el frontend pueda surfacear el link y el admin lo mande por WhatsApp.
  emailEnviado?: boolean;
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
  rol: RolAcademico,
  // Fix consistencia de plantillas (2026-07-15): nombre del destinatario (y del alumno, para
  // la plantilla de Tutor) para personalizar el correo real. Opcional -- el llamador manual
  // desde Configuración → Cuentas Externas no conoce el nombre; el backend usa un fallback.
  datosPersonalizados?: { nombreDestinatario?: string; nombreAlumno?: string }
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
    { email: string; rol: RolAcademico; tenantId: string; nombreDestinatario?: string; nombreAlumno?: string },
    { ok: boolean; invitacionId: string; expiraEn: string; emailEnviado?: boolean; activationLink?: string }
  >(getFunctions(), 'inviteUser');

  // La CF ya NO aborta si el correo falla: crea la invitación y devuelve `emailEnviado`
  // + `activationLink`. Así el frontend puede surfacear el enlace de activación al admin.
  const response = await inviteUserCF({
    email: emailLimpio,
    rol,
    tenantId,
    nombreDestinatario: datosPersonalizados?.nombreDestinatario,
    nombreAlumno: datosPersonalizados?.nombreAlumno,
  });
  const { invitacionId, emailEnviado, activationLink } = response.data;

  const docRef = doc(db, 'tenants', tenantId, 'invitaciones', invitacionId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('La invitación se creó pero no se pudo encontrar en Firestore');
  }

  return {
    id: snap.id,
    ...snap.data(),
    emailEnviado: emailEnviado ?? true,
    activationLink: activationLink ?? (snap.data() as any).activationLink,
  } as InvitacionUsuario;
};

// Orden mas reciente primero (creadoEn desc). Bug real (2026-09-01): tutores/alumnos
// reenviados terminan con 2+ documentos en `invitaciones` (el viejo `revocada` que deja
// resendInvitation + el nuevo `pendiente`). Sin este orden, cualquier consumidor que se
// quede con "la" invitacion de un correo (InvitacionesView usa `.find()`) podia agarrar la
// vieja revocada -- una fila muerta, sin boton de accion, escondiendo la invitacion valida.
const porCreadoEnDesc = (a: InvitacionUsuario, b: InvitacionUsuario) => b.creadoEn.localeCompare(a.creadoEn);

export const listInvitations = async (tenantId: string): Promise<InvitacionUsuario[]> => {
  if (!isFirebaseConfigured) {
    return mockInvitations.filter(inv => inv.tenantId === tenantId).sort(porCreadoEnDesc);
  }

  const colRef = collection(db, 'tenants', tenantId, 'invitaciones');
  const snap = await getDocs(colRef);
  return snap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as InvitacionUsuario))
    .sort(porCreadoEnDesc);
};

export const resendInvitation = async (
  tenantId: string,
  invitationId: string
): Promise<{ emailEnviado: boolean; activationLink?: string }> => {
  if (!isFirebaseConfigured) {
    const inv = mockInvitations.find(i => i.id === invitationId && i.tenantId === tenantId);
    if (!inv) throw new Error('Invitación no encontrada');
    inv.creadoEn = new Date().toISOString();
    const expira = new Date(Date.now() + 86400000 * 7 + 10000); // 10s offset to guarantee a different string
    inv.expiraEn = expira.toISOString();
    return { emailEnviado: true, activationLink: inv.activationLink };
  }

  const docRef = doc(db, 'tenants', tenantId, 'invitaciones', invitationId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('Invitación no encontrada');
  }

  const invData = snap.data() as Omit<InvitacionUsuario, 'id'>;

  // Fix mitigación de login (2026-07-15): el correo (Resend) puede fallar. La CF `inviteUser`
  // ya NO aborta en ese caso -- devuelve `emailEnviado` + `activationLink` de la invitación
  // NUEVA que crea. Se lo devolvemos al llamador para que pueda ofrecer el enlace manual sin
  // depender de que el correo llegue (mismo patrón que createInvitation).
  const inviteUserCF = httpsCallable<
    { email: string; rol: RolAcademico; tenantId: string },
    { ok: boolean; invitacionId: string; expiraEn: string; emailEnviado?: boolean; activationLink?: string }
  >(getFunctions(), 'inviteUser');

  const response = await inviteUserCF({ email: invData.email, rol: invData.rol, tenantId });

  await updateDoc(docRef, { estado: 'revocada' });

  return {
    emailEnviado: response.data.emailEnviado ?? true,
    activationLink: response.data.activationLink,
  };
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
