import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { Estudiante } from '../../tipos';

// In-memory mock storage for local/test mode
let mockEstudiantes: Estudiante[] = [];

export const setMockEstudiantes = (estudiantes: Estudiante[]) => {
  mockEstudiantes = estudiantes;
};

export const clearMockData = () => {
  mockEstudiantes = [];
};

/**
 * Identity Resolver Service (rediseño 2026-07-14, fix-tutor-role-end-to-end).
 *
 * Resuelve los estudiantes de un Tutor (padre/acudiente) a partir de SU PROPIO
 * email de login. El vínculo tutor↔estudiante YA existe en el doc del estudiante
 * (`tutor.correo`) — no se necesita una colección `vinculos` aparte ni sincronizar
 * Auth UIDs entre padre e hijo (ese era el bug de raíz: se intentaban calzar dos
 * IDs generados independientemente que nunca coincidían).
 *
 * Estrategia:
 * 1. Query root `/estudiantes` donde `tutor.correo == tutorEmail` (una sola
 *    condición de igualdad — Firestore la auto-indexa, no requiere índice compuesto).
 * 2. Filtrar por `tenantId` en cliente (evita índice compuesto).
 * 3. Retornar los Estudiante docs. Si no hay ninguno, array vacío (nunca throw).
 *
 * La regla de Firestore para `/estudiantes` autoriza esta lectura al Tutor solo
 * cuando `resource.data.tutor.correo == request.auth.token.email` (ver firestore.rules),
 * así que un Tutor solo puede leer los estudiantes donde figura como acudiente.
 *
 * @param tenantId ID del tenant del tutor
 * @param tutorEmail Email de login del tutor (usuario.email). Se compara en minúsculas.
 * @returns Array de Estudiante docs donde el tutor es el acudiente
 */
export async function resolveLinkedStudent(
  tenantId: string,
  tutorEmail: string
): Promise<Estudiante[]> {
  if (!tenantId || !tutorEmail) {
    console.warn(`resolveLinkedStudent: tenantId o tutorEmail vacío (${tenantId}, ${tutorEmail})`);
    return [];
  }

  const emailNormalizado = tutorEmail.toLowerCase().trim();

  try {
    if (!isFirebaseConfigured) {
      return resolveLinkedStudentMock(tenantId, emailNormalizado);
    }

    const estudiantesRef = collection(db, 'estudiantes');
    const snap = await getDocs(
      query(estudiantesRef, where('tutor.correo', '==', emailNormalizado))
    );

    if (snap.empty) {
      console.debug(`resolveLinkedStudent: sin estudiantes para tutor ${emailNormalizado}`);
      return [];
    }

    // Filtrar por tenant en cliente (defensa extra; la regla ya aísla por acudiente)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Estudiante))
      .filter(e => e.tenantId === tenantId);
  } catch (err) {
    console.error(`Error en resolveLinkedStudent(${tenantId}, ${emailNormalizado}):`, err);
    return [];
  }
}

/**
 * Mock implementation para testing sin Firebase.
 */
function resolveLinkedStudentMock(
  tenantId: string,
  emailNormalizado: string
): Estudiante[] {
  return mockEstudiantes.filter(
    e =>
      e.tenantId === tenantId &&
      e.tutor?.correo?.toLowerCase().trim() === emailNormalizado
  );
}

/**
 * Resuelve los estudiantes relevantes para un CONSULTOR (Tutor o Estudiante) por su email:
 * - Tutor (esTutor=true): estudiantes donde `tutor.correo == email` (sus hijos).
 * - Estudiante (esTutor=false): su propio registro, donde `correo == email`.
 *
 * Usado por el buzón de notificaciones para saber qué estudianteId(s) le corresponden.
 */
export async function resolveStudentsForConsultor(
  tenantId: string,
  email: string,
  esTutor: boolean
): Promise<Estudiante[]> {
  if (!tenantId || !email) return [];
  const emailNormalizado = email.toLowerCase().trim();
  const campo = esTutor ? 'tutor.correo' : 'correo';

  try {
    if (!isFirebaseConfigured) {
      return mockEstudiantes.filter(
        e =>
          e.tenantId === tenantId &&
          (esTutor
            ? e.tutor?.correo?.toLowerCase().trim() === emailNormalizado
            : e.correo?.toLowerCase().trim() === emailNormalizado)
      );
    }

    const estudiantesRef = collection(db, 'estudiantes');
    const snap = await getDocs(query(estudiantesRef, where(campo, '==', emailNormalizado)));
    if (snap.empty) return [];
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Estudiante))
      .filter(e => e.tenantId === tenantId);
  } catch (err) {
    console.error(`Error en resolveStudentsForConsultor(${tenantId}, ${emailNormalizado}, ${esTutor}):`, err);
    return [];
  }
}
