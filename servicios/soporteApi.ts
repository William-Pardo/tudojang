import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../firebase/config';
import { type TicketSoporte, EtapaSoporte } from '../tipos';

const ticketsCollection = collection(db, 'tickets_soporte');

interface CrearTicketSeguroResultado {
    ticketId: string;
    source: 'human';
    whatsapp?: { allowed: boolean; url?: string; reason?: string };
}

type TicketE2EAdapter = (payload: Record<string, unknown>) => Promise<CrearTicketSeguroResultado>;

const normalizarTicket = (id: string, data: Record<string, any>): TicketSoporte => ({
    id,
    tenantId: data.tenantId ?? '',
    userId: data.userId ?? '',
    userNombre: '',
    userEmail: '',
    asunto: data.category ?? 'soporte',
    resumenIA: data.summary ?? '',
    estado:
        data.status === 'resolved'
            ? 'resuelto'
            : data.status === 'in_progress'
                ? 'proceso'
                : 'abierto',
    etapa: (data.stage ?? EtapaSoporte.Recibido) as EtapaSoporte,
    fechaCreacion: data.createdAt ?? new Date().toISOString(),
    salaVideoUrl: data.videoRoomUrl ?? null,
});

export const crearTicketSoporte = async (
    datos: Omit<TicketSoporte, 'id' | 'fechaCreacion' | 'estado' | 'etapa'>,
    opciones: { whatsappConsent?: boolean } = {}
): Promise<TicketSoporte & { whatsappUrl?: string }> => {
    const e2eAdapter = typeof window !== 'undefined' && (window as any).Cypress
        ? (window as typeof window & { __ASSISTANT_TICKET_ADAPTER__?: TicketE2EAdapter }).__ASSISTANT_TICKET_ADAPTER__
        : undefined;
    if (e2eAdapter) {
        const response = await e2eAdapter({
            summary: datos.resumenIA || datos.asunto,
            category: datos.asunto || 'soporte',
            source: 'local',
            whatsappConsent: opciones.whatsappConsent === true,
            hasSensitiveData: false,
        });
        return {
            id: response.ticketId,
            ...datos,
            estado: 'abierto',
            etapa: EtapaSoporte.Recibido,
            fechaCreacion: new Date().toISOString(),
            salaVideoUrl: null,
            whatsappUrl: response.whatsapp?.allowed ? response.whatsapp.url : undefined,
        };
    }

    if (!isFirebaseConfigured) {
        return {
            id: `tk-${Date.now()}`,
            ...datos,
            estado: 'abierto',
            etapa: EtapaSoporte.Recibido,
            fechaCreacion: new Date().toISOString(),
            salaVideoUrl: null,
        };
    }

    const callable = httpsCallable<
        {
            summary: string;
            category: string;
            source: 'local' | 'ai' | 'human';
            whatsappConsent: boolean;
            hasSensitiveData: boolean;
        },
        CrearTicketSeguroResultado
    >(getFunctions(), 'crearTicketSoporteSeguro');
    const response = await callable({
        summary: datos.resumenIA || datos.asunto,
        category: datos.asunto || 'soporte',
        source: 'local',
        whatsappConsent: opciones.whatsappConsent === true,
        hasSensitiveData: false,
    });

    return {
        id: response.data.ticketId,
        ...datos,
        estado: 'abierto',
        etapa: EtapaSoporte.Recibido,
        fechaCreacion: new Date().toISOString(),
        salaVideoUrl: null,
        whatsappUrl: response.data.whatsapp?.allowed ? response.data.whatsapp.url : undefined,
    };
};

export const actualizarTicket = async (
    id: string,
    cambios: Partial<TicketSoporte>
): Promise<void> => {
    if (!isFirebaseConfigured) return;

    const nextStatus =
        cambios.estado === 'resuelto'
            ? 'resolved'
            : cambios.estado === 'proceso'
                ? 'in_progress'
                : 'open';
    const callable = httpsCallable(getFunctions(), 'actualizarTicketSoporteSeguro');
    await callable({
        ticketId: id,
        nextStatus,
        stage: cambios.etapa,
        videoRoomUrl: cambios.salaVideoUrl || undefined,
    });
};

export const escucharTicketsActivos = (
    callback: (tickets: TicketSoporte[]) => void
) => {
    if (!isFirebaseConfigured) {
        callback([]);
        return () => {};
    }

    const q = query(
        ticketsCollection,
        where('status', '!=', 'resolved'),
        orderBy('status'),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        callback(
            snapshot.docs.map((ticket) =>
                normalizarTicket(ticket.id, ticket.data())
            )
        );
    });
};

export const escucharMiTicketActivo = (
    userId: string,
    tenantId: string,
    callback: (ticket: TicketSoporte | null) => void
) => {
    if (!isFirebaseConfigured) {
        callback(null);
        return () => {};
    }

    const q = query(
        ticketsCollection,
        where('userId', '==', userId),
        where('tenantId', '==', tenantId),
        where('status', '!=', 'resolved'),
        orderBy('status'),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        callback(
            snapshot.empty
                ? null
                : normalizarTicket(snapshot.docs[0].id, snapshot.docs[0].data())
        );
    });
};
