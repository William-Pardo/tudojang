
// servicios/asistenciaApi.ts
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import { type Asistencia, EstadoEntrega } from '../tipos';

const asistenciaCollection = collection(db, 'asistencia');

export const registrarEntrada = async (estudianteId: string, sedeId: string): Promise<Asistencia> => {
    const nuevaAsistencia: Omit<Asistencia, 'id'> = {
        estudianteId,
        sedeId,
        fecha: new Date().toISOString().split('T')[0],
        horaEntrada: new Date().toISOString(),
        estadoEntrega: EstadoEntrega.EnClase
    };

    if (!isFirebaseConfigured) {
        return { id: `mock-ast-${Date.now()}`, ...nuevaAsistencia };
    }

    const docRef = await addDoc(asistenciaCollection, nuevaAsistencia);
    return { id: docRef.id, ...nuevaAsistencia };
};

export const actualizarEstadoEntrega = async (asistenciaId: string, nuevoEstado: EstadoEntrega, recogidoPor?: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'asistencia', asistenciaId);
    const updateData: any = { estadoEntrega: nuevoEstado };
    if (recogidoPor) updateData.recogidoPor = recogidoPor;
    if (nuevoEstado === EstadoEntrega.Entregado) updateData.horaSalida = new Date().toISOString();
    await updateDoc(docRef, updateData);
};

// NUEVA FUNCIÓN: Listener en tiempo real
export const escucharAsistenciasActivasSede = (sedeId: string, callback: (asistencias: any[]) => void) => {
    const hoy = new Date().toISOString().split('T')[0];

    if (!isFirebaseConfigured) {
        callback([]);
        return () => { };
    }

    const q = query(
        asistenciaCollection,
        where("sedeId", "==", sedeId),
        where("fecha", "==", hoy),
        where("estadoEntrega", "!=", EstadoEntrega.Entregado)
    );

    // Retorna la función de des-suscripción
    return onSnapshot(q, (snapshot) => {
        const asistencias = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(asistencias);
    });
};

export const buscarAsistenciaHoyPorIdAlumno = async (identificacion: string): Promise<{ asistencia: Asistencia, nombres: string } | null> => {
    const hoy = new Date().toISOString().split('T')[0];

    if (!isFirebaseConfigured) {
        if (identificacion === '123') {
            return {
                asistencia: { id: 'm1', estudianteId: 'e1', fecha: hoy, horaEntrada: '18:00', sedeId: 's1', estadoEntrega: EstadoEntrega.Listo },
                nombres: 'JUAN P.'
            };
        }
        return null;
    }

    const qEst = query(collection(db, 'estudiantes'), where("numeroIdentificacion", "==", identificacion.trim()));
    const estSnap = await getDocs(qEst);
    if (estSnap.empty) return null;

    const estDoc = estSnap.docs[0];
    const estData = estDoc.data();

    const qAsist = query(
        asistenciaCollection,
        where("estudianteId", "==", estDoc.id),
        where("fecha", "==", hoy),
        orderBy("horaEntrada", "desc"),
        limit(1)
    );

    const asistSnap = await getDocs(qAsist);
    if (asistSnap.empty) return null;

    const asistData = asistSnap.docs[0].data() as Asistencia;
    const nombreOfuscado = `${estData.nombres.split(' ')[0]} ${estData.apellidos[0]}.`;

    return {
        asistencia: { ...asistData, id: asistSnap.docs[0].id },
        nombres: nombreOfuscado
    };
};

export const obtenerAsistenciasActivasSede = async (sedeId: string): Promise<any[]> => {
    const hoy = new Date().toISOString().split('T')[0];
    if (!isFirebaseConfigured) return [];

    const q = query(
        asistenciaCollection,
        where("sedeId", "==", sedeId),
        where("fecha", "==", hoy),
        where("estadoEntrega", "!=", EstadoEntrega.Entregado)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
