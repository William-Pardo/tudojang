
// servicios/programasApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import { type Programa, TipoCobroPrograma } from '../tipos';

const programasCollection = collection(db, 'programas');

// Memoria temporal para modo simulado
let programasMock: Programa[] = [
    {
        id: 'prog-001',
        tenantId: 'escuela-gajog-001',
        nombre: 'Poomsae Pro',
        descripcion: 'Entrenamiento avanzado de formas y técnica.',
        tipoCobro: TipoCobroPrograma.Recurrente,
        valor: 40000,
        horario: 'Sábados 10:00 AM - 12:00 PM',
        activo: true
    },
    {
        id: 'prog-002',
        tenantId: 'escuela-gajog-001',
        nombre: 'TKD Terapéutico',
        descripcion: 'Clases enfocadas en movilidad y salud física.',
        tipoCobro: TipoCobroPrograma.Recurrente,
        valor: 60000,
        horario: 'Martes y Jueves 7:00 AM',
        activo: true
    },
    {
        id: 'prog-003',
        tenantId: 'escuela-gajog-001',
        nombre: 'Seminario Nunchaku',
        descripcion: 'Taller de 4 sesiones de manejo de armas.',
        tipoCobro: TipoCobroPrograma.Unico,
        valor: 100000,
        horario: 'Intensivo Fin de Semana',
        activo: true
    }
];

export const obtenerProgramas = async (): Promise<Programa[]> => {
    if (!isFirebaseConfigured) return [...programasMock];
    const snapshot = await getDocs(programasCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Programa));
};

export const agregarPrograma = async (programa: Omit<Programa, 'id'>): Promise<Programa> => {
    if (!isFirebaseConfigured) {
        const nuevo = { id: `mock-prog-${Date.now()}`, ...programa } as Programa;
        programasMock.push(nuevo);
        return nuevo;
    }
    const docRef = await addDoc(programasCollection, programa);
    return { id: docRef.id, ...programa } as Programa;
};

export const actualizarPrograma = async (programa: Programa): Promise<Programa> => {
    if (!isFirebaseConfigured) {
        programasMock = programasMock.map(p => p.id === programa.id ? programa : p);
        return programa;
    }
    const { id, ...data } = programa;
    await updateDoc(doc(db, 'programas', id), data);
    return programa;
};

export const eliminarPrograma = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        programasMock = programasMock.filter(p => p.id !== id);
        return;
    }
    await deleteDoc(doc(db, 'programas', id));
};
