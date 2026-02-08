
// servicios/estudiantesApi.ts
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, isFirebaseConfigured } from '@/src/config';
import type { Estudiante } from '../tipos';
import { GrupoEdad, EstadoPago, GradoTKD } from '../tipos';

const estudiantesCollection = collection(db, 'estudiantes');
const storage = getStorage();

const uploadFirma = async (idEstudiante: string, firmaBase64: string, tipo: 'consentimiento' | 'contrato' | 'imagen'): Promise<string> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Saltando subida de firma a Firebase Storage.");
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
    const storageRef = ref(storage, `firmas/${idEstudiante}/${tipo}_${Date.now()}.png`);
    const finalBase64 = firmaBase64.startsWith('data:') ? firmaBase64 : `data:image/png;base64,${firmaBase64}`;
    const snapshot = await uploadString(storageRef, finalBase64, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

export const obtenerEstudiantes = async (tenantId: string): Promise<Estudiante[]> => {
    if (!tenantId) return [];
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de estudiantes mock.");
        return [
            {
                id: '1', tenantId: 'escuela-gajog-001', nombres: 'Juan', apellidos: 'Pérez', numeroIdentificacion: '10101', fechaNacimiento: '2015-05-10',
                grado: GradoTKD.Amarillo, grupo: GrupoEdad.Infantil, horasAcumuladasGrado: 20, sedeId: '1', telefono: '3001',
                correo: 'juan@test.com', fechaIngreso: '2024-01-10', estadoPago: EstadoPago.AlDia, historialPagos: [], saldoDeudor: 0,
                consentimientoInformado: true, contratoServiciosFirmado: true, consentimientoImagenFirmado: true, consentimientoFotosVideos: true,
                carnetGenerado: false
            },
            {
                id: '2', tenantId: 'escuela-gajog-001', nombres: 'Maria', apellidos: 'Lopez', numeroIdentificacion: '20202', fechaNacimiento: '2012-08-15',
                grado: GradoTKD.Verde, grupo: GrupoEdad.Precadetes, horasAcumuladasGrado: 45, sedeId: '1', telefono: '3002',
                correo: 'maria@test.com', fechaIngreso: '2024-05-15', estadoPago: EstadoPago.Pendiente, historialPagos: [], saldoDeudor: 180000,
                consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false, consentimientoFotosVideos: false,
                carnetGenerado: false
            }
        ].filter(e => e.tenantId === tenantId);
    }
    const q = query(
        estudiantesCollection,
        where('tenantId', '==', tenantId),
        orderBy('apellidos', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, carnetGenerado: false, ...doc.data() } as Estudiante));
};

export const marcarCarnetsComoGenerados = async (ids: string[]): Promise<void> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Marcando carnets como generados.");
        return;
    }
    const batch = writeBatch(db);
    ids.forEach(id => {
        const docRef = doc(db, 'estudiantes', id);
        batch.update(docRef, { carnetGenerado: true });
    });
    await batch.commit();
};

export const obtenerEstudiantePorId = async (idEstudiante: string, tenantId?: string): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        const all = await obtenerEstudiantes(tenantId || 'escuela-gajog-001');
        const found = all.find(e => e.id === idEstudiante);
        if (found) return found;
        throw new Error("Estudiante no encontrado.");
    }
    const docRef = doc(db, 'estudiantes', idEstudiante);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Estudiante;
    } else {
        throw new Error("Estudiante no encontrado.");
    }
};

export const obtenerEstudiantePorNumIdentificacion = async (numIdentificacion: string, tenantId?: string): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        const all = await obtenerEstudiantes(tenantId || 'escuela-gajog-001');
        const found = all.find(e => e.numeroIdentificacion === numIdentificacion);
        if (found) return found;
        throw new Error("No se encontró un estudiante con ese número de identificación.");
    }
    const q = query(estudiantesCollection, where("numeroIdentificacion", "==", numIdentificacion.trim()));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        throw new Error("No se encontró un estudiante con ese número de identificación.");
    }
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Estudiante;
};

export const agregarEstudiante = async (nuevoEstudiante: Omit<Estudiante, 'id' | 'historialPagos'>): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        return { ...nuevoEstudiante, id: `mock-${Date.now()}`, historialPagos: [] } as Estudiante;
    }
    const estudianteParaGuardar = {
        ...nuevoEstudiante,
        historialPagos: [],
        carnetGenerado: false
    };
    const docRef = await addDoc(estudiantesCollection, estudianteParaGuardar);
    return { id: docRef.id, ...estudianteParaGuardar } as Estudiante;
};

export const actualizarEstudiante = async (estudianteActualizado: Estudiante): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        return estudianteActualizado;
    }
    const { id, ...data } = estudianteActualizado;
    const docRef = doc(db, 'estudiantes', id);
    await updateDoc(docRef, data);
    return estudianteActualizado;
};

export const eliminarEstudiante = async (idEstudiante: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await deleteDoc(docRef);
};

export const guardarFirmaConsentimiento = async (idEstudiante: string, firmaDigital: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(idEstudiante, firmaDigital, 'consentimiento');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { consentimientoInformado: true, 'tutor.firmaDigital': urlFirma });
};

export const guardarFirmaContrato = async (idEstudiante: string, firmaDigital: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(idEstudiante, firmaDigital, 'contrato');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { contratoServiciosFirmado: true, 'tutor.firmaContratoDigital': urlFirma });
};

export const guardarFirmaImagen = async (idEstudiante: string, firmaDigital: string, autorizaFotos: boolean): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const urlFirma = await uploadFirma(idEstudiante, firmaDigital, 'imagen');
    const docRef = doc(db, 'estudiantes', idEstudiante);
    await updateDoc(docRef, { consentimientoImagenFirmado: true, consentimientoFotosVideos: autorizaFotos, 'tutor.firmaImagenDigital': urlFirma });
};
