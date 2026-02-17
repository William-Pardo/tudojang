
// servicios/programasApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { type Programa, TipoCobroPrograma, GrupoEdad } from '../tipos';

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
        horario: 'Lunes y Miércoles 5:00 PM',
        bloquesHorarios: [
            { id: 'b1', dia: 'Lunes', horaInicio: '17:00', horaFin: '18:30', sedeId: '1', instructorId: 'admin-001', grupo: GrupoEdad.Cadetes, nombrePrograma: 'Poomsae Pro', programaId: 'prog-001' },
            { id: 'b2', dia: 'Miércoles', horaInicio: '17:00', horaFin: '18:30', sedeId: '1', instructorId: 'asistente-001', grupo: GrupoEdad.Cadetes, nombrePrograma: 'Poomsae Pro', programaId: 'prog-001' }
        ],
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
        bloquesHorarios: [
            { id: 'b3', dia: 'Martes', horaInicio: '07:00', horaFin: '08:00', sedeId: '1', instructorId: 'admin-001', grupo: GrupoEdad.Adultos, nombrePrograma: 'TKD Terapéutico', programaId: 'prog-002' },
            { id: 'b4', dia: 'Jueves', horaInicio: '07:00', horaFin: '08:00', sedeId: '1', instructorId: 'admin-001', grupo: GrupoEdad.Adultos, nombrePrograma: 'TKD Terapéutico', programaId: 'prog-002' }
        ],
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
