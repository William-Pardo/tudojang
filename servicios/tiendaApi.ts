
// servicios/tiendaApi.ts
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    addDoc, 
    getDoc,
    deleteDoc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { EstadoPago, EstadoSolicitudCompra, CategoriaImplemento } from '../tipos';
import type { Estudiante, Implemento, VariacionImplemento, SolicitudCompra } from '../tipos';
import { obtenerEstudiantePorId, obtenerEstudiantePorNumIdentificacion } from './estudiantesApi';

const implementosCollection = collection(db, 'implementos');
const solicitudesCompraCollection = collection(db, 'solicitudesCompra');

// Memoria local con los 11 artículos maestros diseñados
let implementosMock: Implemento[] = [
    {
        id: 'imp-001',
        nombre: 'Dobok Oficial de Entrenamiento',
        descripcion: 'Uniforme de alta resistencia 65/35 algodón-poliéster. Corte coreano original.',
        imagenUrl: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=500&auto=format&fit=crop',
        categoria: CategoriaImplemento.Uniformes,
        variaciones: [
            { id: 'v1', descripcion: 'Talla 000-1', precio: 120000 },
            { id: 'v2', descripcion: 'Talla 2-4', precio: 135000 },
            { id: 'v3', descripcion: 'Talla 5-7', precio: 150000 },
        ],
    },
    {
        id: 'imp-002',
        nombre: 'Pechera Reversible (WT)',
        descripcion: 'Protector de torso oficial Azul/Rojo con absorción de impacto de alta densidad.',
        imagenUrl: 'https://images.unsplash.com/photo-1517438476312-10d79c67750d?q=80&w=500&auto=format&fit=crop',
        categoria: CategoriaImplemento.ProteccionTorso,
        variaciones: [
            { id: 'v4', descripcion: 'Talla 1 (Infantil)', precio: 145000 },
            { id: 'v5', descripcion: 'Talla 2-3', precio: 160000 },
        ],
    },
    {
        id: 'imp-003',
        nombre: 'Casco de Competición',
        descripcion: 'Diseño ergonómico con ventilación superior. Protección auditiva reforzada.',
        imagenUrl: 'https://images.unsplash.com/photo-1599058917233-57c0e6843640?q=80&w=500&auto=format&fit=crop',
        categoria: CategoriaImplemento.ProteccionCabeza,
        variaciones: [
            { id: 'v6', descripcion: 'Talla S/M', precio: 95000 },
            { id: 'v7', descripcion: 'Talla L/XL', precio: 95000 },
        ],
    },
    {
        id: 'imp-004',
        nombre: 'Protectores de Antebrazo',
        descripcion: 'Par de protectores con ajuste de velcro elástico. Recubrimiento en vinilo.',
        imagenUrl: '',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [{ id: 'v8', descripcion: 'Par Único', precio: 45000 }],
    },
    {
        id: 'imp-005',
        nombre: 'Protectores de Espinilla',
        descripcion: 'Protección tibial anatómica. Evita lesiones en combate y práctica de pateo.',
        imagenUrl: '',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [{ id: 'v9', descripcion: 'Par Único', precio: 48000 }],
    },
    {
        id: 'imp-006',
        nombre: 'Zapatillas Técnicas',
        descripcion: 'Calzado especial para tatami. Suela ultra-flexible con punto de giro.',
        imagenUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=500&auto=format&fit=crop',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [
            { id: 'v10', descripcion: 'Talla 34-37', precio: 185000 },
            { id: 'v11', descripcion: 'Talla 38-42', precio: 195000 },
        ],
    },
    {
        id: 'imp-007',
        nombre: 'Guantines de Combate',
        descripcion: 'Protección de manos oficial. Diseño de dedos libres para agarre técnico.',
        imagenUrl: '',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [{ id: 'v12', descripcion: 'Par M/L', precio: 55000 }],
    },
    {
        id: 'imp-008',
        nombre: 'Protector Inguinal',
        descripcion: 'Copa de protección obligatoria para combate. Ajuste cómodo bajo el dobok.',
        imagenUrl: '',
        categoria: CategoriaImplemento.ProteccionTorso,
        variaciones: [{ id: 'v13', descripcion: 'Talla Única', precio: 38000 }],
    },
    {
        id: 'imp-009',
        nombre: 'Mochila Deportiva Club',
        descripcion: 'Maletín de gran capacidad para cargar todo el equipo de combate.',
        imagenUrl: '',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [{ id: 'v14', descripcion: 'Modelo Pro', precio: 85000 }],
    },
    {
        id: 'imp-010',
        nombre: 'Paleta de Pateo Simple',
        descripcion: 'Implemento para práctica de velocidad y precisión en patadas.',
        imagenUrl: '',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [{ id: 'v15', descripcion: 'Unidad', precio: 40000 }],
    },
    {
        id: 'imp-011',
        nombre: 'Foco de Pateo Doble',
        descripcion: 'Paleta doble para sonido de impacto y práctica de combinaciones.',
        imagenUrl: '',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [{ id: 'v16', descripcion: 'Unidad Premium', precio: 65000 }],
    }
];

export const obtenerImplementos = async (): Promise<Implemento[]> => {
    if (!isFirebaseConfigured) return [...implementosMock];
    const snapshot = await getDocs(implementosCollection);
    const cloudItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Implemento));
    return cloudItems.length > 0 ? cloudItems : [...implementosMock];
};

export const agregarImplemento = async (nuevo: Omit<Implemento, 'id'>): Promise<Implemento> => {
    if (!isFirebaseConfigured) {
        const item = { id: `imp-${Date.now()}`, ...nuevo } as Implemento;
        implementosMock.push(item);
        return item;
    }
    const docRef = await addDoc(implementosCollection, nuevo);
    return { id: docRef.id, ...nuevo } as Implemento;
};

export const actualizarImplemento = async (item: Implemento): Promise<Implemento> => {
    if (!isFirebaseConfigured) {
        implementosMock = implementosMock.map(i => i.id === item.id ? item : i);
        return item;
    }
    const { id, ...data } = item;
    await updateDoc(doc(db, 'implementos', id), data);
    return item;
};

export const eliminarImplemento = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        implementosMock = implementosMock.filter(i => i.id !== id);
        return;
    }
    await deleteDoc(doc(db, 'implementos', id));
};

export const registrarCompra = async (idEstudiante: string, implemento: Implemento, variacion: VariacionImplemento): Promise<Estudiante> => {
    if (!isFirebaseConfigured) {
        const estudiante = await obtenerEstudiantePorId(idEstudiante);
        return { ...estudiante, saldoDeudor: estudiante.saldoDeudor + variacion.precio };
    }
    const estudianteDocRef = doc(db, 'estudiantes', idEstudiante);
    const estudianteSnap = await getDoc(estudianteDocRef);
    if (!estudianteSnap.exists()) throw new Error("Estudiante no encontrado.");
    const estudiante = { id: estudianteSnap.id, ...estudianteSnap.data() } as Estudiante;
    const nuevoSaldo = estudiante.saldoDeudor + variacion.precio;
    const nuevoEstadoPago = (estudiante.estadoPago === EstadoPago.AlDia && variacion.precio > 0) ? EstadoPago.Pendiente : estudiante.estadoPago;
    await updateDoc(estudianteDocRef, { saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago });
    return { ...estudiante, saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago };
};

export const crearSolicitudCompra = async (numIdentificacion: string, implemento: Implemento, variacion: VariacionImplemento): Promise<SolicitudCompra> => {
    const estudiante = await obtenerEstudiantePorNumIdentificacion(numIdentificacion);
    const nuevaSolicitudData = {
        estudiante: {
            id: estudiante.id, nombres: estudiante.nombres, apellidos: estudiante.apellidos,
            tutor: estudiante.tutor ? { nombres: estudiante.tutor.nombres, apellidos: estudiante.tutor.apellidos, telefono: estudiante.tutor.telefono, correo: estudiante.tutor.correo } : null
        },
        implemento: { id: implemento.id, nombre: implemento.nombre, categoria: implemento.categoria },
        variacion: { id: variacion.id, descripcion: variacion.descripcion, precio: variacion.precio },
        fechaSolicitud: new Date().toISOString(),
        estado: EstadoSolicitudCompra.Pendiente,
    };
    if (!isFirebaseConfigured) return { id: `mock-sc-${Date.now()}`, ...nuevaSolicitudData } as any;
    const docRef = await addDoc(solicitudesCompraCollection, nuevaSolicitudData);
    return { id: docRef.id, ...nuevaSolicitudData } as any;
};

export const obtenerSolicitudesCompra = async (): Promise<SolicitudCompra[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(solicitudesCompraCollection, where("estado", "==", EstadoSolicitudCompra.Pendiente));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SolicitudCompra));
};

export const gestionarSolicitudCompra = async (idSolicitud: string, nuevoEstado: EstadoSolicitudCompra): Promise<Estudiante | null> => {
    if (!isFirebaseConfigured) return null;
    const solicitudDocRef = doc(db, 'solicitudesCompra', idSolicitud);
    const solicitudSnap = await getDoc(solicitudDocRef);
    if (!solicitudSnap.exists()) throw new Error("Solicitud no encontrada.");
    const solicitud = solicitudSnap.data() as SolicitudCompra;
    const batch = writeBatch(db);
    batch.update(solicitudDocRef, { estado: nuevoEstado });
    if (nuevoEstado === EstadoSolicitudCompra.Aprobada) {
        const estudiante = await obtenerEstudiantePorId(solicitud.estudiante.id);
        const nuevoSaldo = estudiante.saldoDeudor + solicitud.variacion.precio;
        const nuevoEstadoPago = (estudiante.estadoPago === EstadoPago.AlDia && solicitud.variacion.precio > 0) ? EstadoPago.Pendiente : estudiante.estadoPago;
        batch.update(doc(db, 'estudiantes', solicitud.estudiante.id), { saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago });
        await batch.commit();
        return { ...estudiante, saldoDeudor: nuevoSaldo, estadoPago: nuevoEstadoPago };
    } else {
        await batch.commit();
        return null;
    }
};
