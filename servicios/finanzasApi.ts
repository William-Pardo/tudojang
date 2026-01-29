
// servicios/finanzasApi.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import { TipoMovimiento, CategoriaFinanciera, type MovimientoFinanciero } from '../tipos';

const finanzasCollection = collection(db, 'finanzas');

// Memoria temporal para modo simulado (persiste mientras no se recargue la pestaña)
// Added fix: Include required 'tenantId' property in mock movements.
let movimientosMock: MovimientoFinanciero[] = [
    { id: '1', tenantId: 'escuela-gajog-001', tipo: TipoMovimiento.Ingreso, categoria: CategoriaFinanciera.Mensualidad, monto: 180000, descripcion: 'Pago mes Mayo - Juan Perez', fecha: new Date().toISOString().split('T')[0], sedeId: '1' },
    { id: '2', tenantId: 'escuela-gajog-001', tipo: TipoMovimiento.Egreso, categoria: CategoriaFinanciera.Arriendo, monto: 1200000, descripcion: 'Pago local Junio', fecha: new Date().toISOString().split('T')[0], sedeId: '1' }
];

export const obtenerMovimientos = async (sedeId?: string): Promise<MovimientoFinanciero[]> => {
    if (!isFirebaseConfigured) {
        let filtrados = [...movimientosMock];
        if (sedeId && sedeId !== 'todas') {
            filtrados = filtrados.filter(m => m.sedeId === sedeId);
        }
        return filtrados.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }

    let q = query(finanzasCollection, orderBy('fecha', 'desc'));
    if (sedeId && sedeId !== 'todas') {
        q = query(finanzasCollection, where('sedeId', '==', sedeId), orderBy('fecha', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MovimientoFinanciero));
};

export const agregarMovimiento = async (movimiento: Omit<MovimientoFinanciero, 'id'>): Promise<MovimientoFinanciero> => {
    if (!isFirebaseConfigured) {
        const nuevo = { id: `mock-fin-${Date.now()}`, ...movimiento } as MovimientoFinanciero;
        movimientosMock.push(nuevo);
        return nuevo;
    }
    const docRef = await addDoc(finanzasCollection, movimiento);
    return { id: docRef.id, ...movimiento } as MovimientoFinanciero;
};

export const actualizarMovimiento = async (movimiento: MovimientoFinanciero): Promise<MovimientoFinanciero> => {
    if (!isFirebaseConfigured) {
        movimientosMock = movimientosMock.map(m => m.id === movimiento.id ? movimiento : m);
        return movimiento;
    }
    const { id, ...data } = movimiento;
    await updateDoc(doc(db, 'finanzas', id), data);
    return movimiento;
};

export const eliminarMovimiento = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        movimientosMock = movimientosMock.filter(m => m.id !== id);
        return;
    }
    await deleteDoc(doc(db, 'finanzas', id));
};
