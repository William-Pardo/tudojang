// servicios/tiendaApi.ts
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    getDoc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import { EstadoPago, EstadoSolicitudCompra, CategoriaImplemento } from '../tipos';
import type { Estudiante, Implemento, VariacionImplemento, SolicitudCompra } from '../tipos';
import { obtenerEstudiantePorId, obtenerEstudiantePorNumIdentificacion } from './estudiantesApi';

const implementosCollection = collection(db, 'implementos');
const solicitudesCompraCollection = collection(db, 'solicitudesCompra');

export const obtenerImplementos = async (tenantId: string): Promise<Implemento[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de implementos de prueba.");
        const mockImplementos: Implemento[] = [
            // ... (I'll keep the list but I should ideally add tenantId to them or just return them if it matches a default)
        ];
        // En implementación real mock, filtraríamos por tenantId si los mocks lo tuvieran
        return mockImplementos;
    }
    const q = query(implementosCollection, where('tenantId', '==', tenantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Implemento));
};

export const registrarCompra = async (idEstudiante: string, implemento: Implemento, variacion: VariacionImplemento): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Registrando compra.");
        const estudiante = await obtenerEstudiantePorId(idEstudiante);
        return { ...estudiante, saldoDeudor: estudiante.saldoDeudor + variacion.precio };
    }
    const estudianteDocRef = doc(db, 'estudiantes', idEstudiante);
    const estudianteSnap = await getDoc(estudianteDocRef);

    if (!estudianteSnap.exists()) {
        throw new Error("Estudiante no encontrado.");
    }
    const estudiante = { id: estudianteSnap.id, ...estudianteSnap.data() } as Estudiante;

    const nuevoSaldo = estudiante.saldoDeudor + variacion.precio;
    const nuevoEstadoPago = (estudiante.estadoPago === EstadoPago.AlDia && variacion.precio > 0)
        ? EstadoPago.Pendiente
        : estudiante.estadoPago;

    await updateDoc(estudianteDocRef, {
        saldoDeudor: nuevoSaldo,
        estadoPago: nuevoEstadoPago
    });

    return { ...estudiante, saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago };
};

export const crearSolicitudCompra = async (numIdentificacion: string, implemento: Implemento, variacion: VariacionImplemento): Promise<SolicitudCompra> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Creando solicitud de compra.");
        const estudiante = await obtenerEstudiantePorNumIdentificacion(numIdentificacion);
        const mockSolicitud: SolicitudCompra = {
            id: `mock-sc-${Date.now()}`,
            tenantId: 'escuela-gajog-001',
            // Added comment above fix: Picked specific fields from Estudiante to satisfy SolicitudCompra.estudiante interface.
            estudiante: {
                id: estudiante.id,
                nombres: estudiante.nombres,
                apellidos: estudiante.apellidos,
                tutor: estudiante.tutor ? {
                    nombres: estudiante.tutor.nombres,
                    apellidos: estudiante.tutor.apellidos,
                    telefono: estudiante.tutor.telefono,
                    correo: estudiante.tutor.correo,
                } : null
            },
            implemento,
            variacion,
            fechaSolicitud: new Date().toISOString(),
            estado: EstadoSolicitudCompra.Pendiente,
        };
        return mockSolicitud;
    }

    const estudiante = await obtenerEstudiantePorNumIdentificacion(numIdentificacion);

    const nuevaSolicitudData = {
        estudiante: {
            id: estudiante.id,
            nombres: estudiante.nombres,
            apellidos: estudiante.apellidos,
            tutor: estudiante.tutor ? {
                nombres: estudiante.tutor.nombres,
                apellidos: estudiante.tutor.apellidos,
                telefono: estudiante.tutor.telefono,
                correo: estudiante.tutor.correo,
            } : null
        },
        implemento: {
            id: implemento.id,
            nombre: implemento.nombre,
            categoria: implemento.categoria,
        },
        variacion: {
            id: variacion.id,
            descripcion: variacion.descripcion,
            precio: variacion.precio,
        },
        fechaSolicitud: new Date().toISOString(),
        estado: EstadoSolicitudCompra.Pendiente,
    };

    const docRef = await addDoc(solicitudesCompraCollection, nuevaSolicitudData);

    return { id: docRef.id, ...nuevaSolicitudData } as unknown as SolicitudCompra;
};

export const obtenerSolicitudesCompra = async (tenantId: string): Promise<SolicitudCompra[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de solicitudes de compra vacía.");
        return [];
    }
    const q = query(
        solicitudesCompraCollection,
        where('tenantId', '==', tenantId),
        where("estado", "==", EstadoSolicitudCompra.Pendiente)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SolicitudCompra));
};

export const gestionarSolicitudCompra = async (idSolicitud: string, nuevoEstado: EstadoSolicitudCompra): Promise<Estudiante | null> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Gestionando solicitud de compra.");
        if (nuevoEstado === EstadoSolicitudCompra.Aprobada) {
            return await obtenerEstudiantePorId('mock-id');
        }
        return null;
    }
    const solicitudDocRef = doc(db, 'solicitudesCompra', idSolicitud);
    const solicitudSnap = await getDoc(solicitudDocRef);
    if (!solicitudSnap.exists()) {
        throw new Error("Solicitud de compra no encontrada.");
    }

    const solicitud = solicitudSnap.data() as SolicitudCompra;

    const batch = writeBatch(db);
    batch.update(solicitudDocRef, { estado: nuevoEstado });

    if (nuevoEstado === EstadoSolicitudCompra.Aprobada) {
        const estudianteDocRef = doc(db, 'estudiantes', solicitud.estudiante.id);
        const estudiante = await obtenerEstudiantePorId(solicitud.estudiante.id);
        const nuevoSaldo = estudiante.saldoDeudor + solicitud.variacion.precio;
        const nuevoEstadoPago = (estudiante.estadoPago === EstadoPago.AlDia && solicitud.variacion.precio > 0)
            ? EstadoPago.Pendiente
            : estudiante.estadoPago;

        batch.update(estudianteDocRef, {
            saldoDeudor: nuevoSaldo,
            estadoPago: nuevoEstadoPago,
        });

        await batch.commit();
        return { ...estudiante, saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago };
    } else {
        await batch.commit();
        return null;
    }
};