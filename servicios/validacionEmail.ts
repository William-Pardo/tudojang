import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Verifica si un email ya está registrado en alguna escuela
 * @param email Email a verificar
 * @returns true si el email ya existe, false si está disponible
 */
export async function verificarEmailExistente(email: string): Promise<boolean> {
    try {
        const tenantsRef = collection(db, 'tenants');
        const q = query(tenantsRef, where('emailClub', '==', email.toLowerCase()));
        const snapshot = await getDocs(q);

        return !snapshot.empty;
    } catch (error) {
        console.error('Error verificando email:', error);
        return false; // En caso de error, permitir continuar
    }
}
