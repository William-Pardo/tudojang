import { collection, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

export interface LeadEvento {
    id?: string;
    tenantId: string;
    eventoId: string;
    nombre: string;
    email: string;
    whatsapp: string;
    clubOrigen: string;
    fechaRegistro: string;
    estado: 'Pendiente' | 'Procesado';
}

export const registrarLeadPublico = async (
    tenantId: string,
    eventoId: string,
    leadData: { nombre: string; email: string; whatsapp: string; clubOrigen: string }
): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Registrando lead público", { tenantId, eventoId, leadData });
        return;
    }
    const nuevoLead: Omit<LeadEvento, 'id'> = {
        tenantId,
        eventoId,
        nombre: leadData.nombre.toUpperCase().trim(),
        email: leadData.email.toLowerCase().trim(),
        whatsapp: leadData.whatsapp.trim(),
        clubOrigen: leadData.clubOrigen.toUpperCase().trim(),
        fechaRegistro: new Date().toISOString(),
        estado: 'Pendiente'
    };
    await addDoc(collection(db, 'leadsEventos'), nuevoLead);
};
