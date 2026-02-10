
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

// Memoria local con los artículos maestros del usuario
let implementosMock: Implemento[] = [
    {
        id: 'imp-dobok-nacional',
        nombre: 'Dobok (Uniforme) Nacional',
        descripcion: 'Uniforme oficial para la práctica de Taekwondo. Ligero y resistente, ideal para entrenamiento y competencia.',
        imagenUrl: '/imagenes/dobok-nacional.png',
        categoria: CategoriaImplemento.Uniformes,
        variaciones: [
            { id: 'v-1759344508378-0', descripcion: 'Talla 0 (120 cm)', precio: 120000 },
            { id: 'v-1759344508378-1', descripcion: 'Talla 1 (130 cm)', precio: 130000 },
            { id: 'v-1759344508378-2', descripcion: 'Talla 2 (140 cm)', precio: 140000 },
            { id: 'v-1759344508378-3', descripcion: 'Talla 3 (150 cm)', precio: 150000 },
            { id: 'v-1759344508378-4', descripcion: 'Talla 4 (160 cm)', precio: 160000 },
        ],
    },
    {
        id: 'imp-braceras',
        nombre: 'Braceras (Protector de Antebrazo)',
        descripcion: 'Protección esencial para los antebrazos durante los bloqueos y el combate.',
        imagenUrl: '/imagenes/braceras.png',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [
            { id: 'v-1759344510212-0', descripcion: 'Talla S', precio: 50000 },
            { id: 'v-1759344510212-1', descripcion: 'Talla M', precio: 55000 },
            { id: 'v-1759344510212-2', descripcion: 'Talla L', precio: 60000 },
        ],
    },
    {
        id: 'imp-dobok-importado',
        nombre: 'Dobok (Uniforme) Importado',
        descripcion: 'Uniforme de alta gama para competencia, con tecnología de ventilación y tejido ultraligero.',
        imagenUrl: '/imagenes/dobok-importado.png',
        categoria: CategoriaImplemento.Uniformes,
        variaciones: [
            { id: 'v-1759344510979-0', descripcion: 'Talla 2 (140 cm)', precio: 250000 },
            { id: 'v-1759344510979-1', descripcion: 'Talla 3 (150 cm)', precio: 270000 },
            { id: 'v-1759344510979-2', descripcion: 'Talla 4 (160 cm)', precio: 290000 },
        ],
    },
    {
        id: 'imp-canilleras',
        nombre: 'Canilleras (Protector Tibial)',
        descripcion: 'Protección rígida para las tibias, vital para evitar lesiones en combate.',
        imagenUrl: '/imagenes/canilleras.png',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [
            { id: 'v-1759344510445-0', descripcion: 'Talla S', precio: 55000 },
            { id: 'v-1759344510445-1', descripcion: 'Talla M', precio: 60000 },
            { id: 'v-1759344510445-2', descripcion: 'Talla L', precio: 65000 },
        ],
    },
    {
        id: 'imp-pechera',
        nombre: 'Pechera (Hogu) Reversible',
        descripcion: 'Protector de torso reversible (azul/rojo) aprobado para competencia. Absorbe impactos y ofrece gran movilidad.',
        imagenUrl: '/imagenes/pechera.png',
        categoria: CategoriaImplemento.ProteccionTorso,
        variaciones: [
            { id: 'v-1759344509497-0', descripcion: 'Talla 1', precio: 95000 },
            { id: 'v-1759344509497-1', descripcion: 'Talla 2', precio: 105000 },
            { id: 'v-1759344509497-2', descripcion: 'Talla 3', precio: 115000 },
            { id: 'v-1759344509497-3', descripcion: 'Talla 4', precio: 125000 },
        ],
    },
    {
        id: 'imp-empeineras',
        nombre: 'Empeineras (Protector de Pie)',
        descripcion: 'Protector de empeine con sensores electrónicos o sin ellos, para entrenamiento y competencia.',
        imagenUrl: '/imagenes/empeineras.png',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [
            { id: 'v-1759344510075-0', descripcion: 'Talla S', precio: 60000 },
            { id: 'v-1759344510075-1', descripcion: 'Talla M', precio: 65000 },
            { id: 'v-1759344510075-2', descripcion: 'Talla L', precio: 70000 },
        ],
    },
    {
        id: 'imp-copa-masculina',
        nombre: 'Copa Masculina (Protector inguinal)',
        descripcion: 'Protector inguinal para hombres, de uso obligatorio en combate.',
        imagenUrl: '/imagenes/copa-masculina.png',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [
            { id: 'v-1759344510633-0', descripcion: 'Talla M', precio: 40000 },
            { id: 'v-1759344510633-1', descripcion: 'Talla L', precio: 45000 },
        ],
    },
    {
        id: 'imp-casco',
        nombre: 'Casco de Combate',
        descripcion: 'Casco de protección para la cabeza, esencial para el combate seguro. Disponible con y sin careta protectora facial.',
        imagenUrl: '/imagenes/casco.png',
        categoria: CategoriaImplemento.ProteccionCabeza,
        variaciones: [
            { id: 'v-1759344509688-0', descripcion: 'Talla S - Sin careta', precio: 80000 },
            { id: 'v-1759344509689-1', descripcion: 'Talla M - Sin careta', precio: 85000 },
            { id: 'v-1759344509689-2', descripcion: 'Talla L - Sin careta', precio: 90000 },
            { id: 'v-1759344509689-3', descripcion: 'Talla M - Con careta', precio: 130000 },
            { id: 'v-1759344509689-4', descripcion: 'Talla L - Con careta', precio: 140000 },
        ],
    },
    {
        id: 'imp-guantines',
        nombre: 'Guantines de Combate',
        descripcion: 'Guantes de protección para manos y nudillos, obligatorios para la competencia.',
        imagenUrl: '/imagenes/guantines.png',
        categoria: CategoriaImplemento.ProteccionExtremidades,
        variaciones: [
            { id: 'v-1759344509883-0', descripcion: 'Talla S', precio: 45000 },
            { id: 'v-1759344509883-1', descripcion: 'Talla M', precio: 50000 },
            { id: 'v-1759344509883-2', descripcion: 'Talla L', precio: 55000 },
        ],
    },
    {
        id: 'imp-copa-femenina',
        nombre: 'Copa Femenina (Protector inguinal)',
        descripcion: 'Protector inguinal para mujeres, de uso obligatorio en combate.',
        imagenUrl: '/imagenes/copa-femenina.png',
        categoria: CategoriaImplemento.Accesorios,
        variaciones: [
            { id: 'v-1759344510807-0', descripcion: 'Talla S', precio: 40000 },
            { id: 'v-1759344510807-1', descripcion: 'Talla M', precio: 45000 },
        ],
    }
];

export const obtenerImplementos = async (): Promise<Implemento[]> => {
    console.log("[tiendaApi] obtenerImplementos - iniciando...");
    if (!isFirebaseConfigured) {
        console.log("[tiendaApi] Firebase no configurado, retornando mock");
        return [...implementosMock];
    }

    try {
        console.log("[tiendaApi] Obteniendo documentos desde Firestore...");
        const snapshot = await getDocs(implementosCollection);
        const cloudItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Implemento));
        console.log(`[tiendaApi] Firestore retornó ${cloudItems.length} productos`);

        // Verificar si los productos base existen
        const productosBaseExisten = cloudItems.some(i => i.id === 'imp-dobok-nacional');
        console.log(`[tiendaApi] ¿Productos base existen? ${productosBaseExisten}`);

        // Auto-seeding: Si la colección está vacía O le faltan los productos base, inyectamos/actualizamos.
        if (cloudItems.length === 0 || !productosBaseExisten) {
            console.log("[tiendaApi] Detectado inventario incompleto. Intentando sincronizar...");
            try {
                const batch = writeBatch(db);
                implementosMock.forEach(item => {
                    const docRef = doc(implementosCollection, item.id);
                    batch.set(docRef, item, { merge: true });
                });
                await batch.commit();
                console.log("[tiendaApi] Catálogo base sincronizado exitosamente.");
            } catch (writeError) {
                console.error("[tiendaApi] Error al sincronizar catálogo base:", writeError);
                // Si falla la escritura, igual devolvemos los mocks para que el usuario vea algo
                console.log("[tiendaApi] Usando fallback de mocks debido al error de escritura");
                return [...implementosMock];
            }

            // Devolvemos la mezcla para asegurar consistencia
            const idsMock = new Set(implementosMock.map(i => i.id));
            const itemsExistentesNoMock = cloudItems.filter(i => !idsMock.has(i.id));
            console.log(`[tiendaApi] Retornando ${implementosMock.length} mocks + ${itemsExistentesNoMock.length} existentes`);
            return [...implementosMock, ...itemsExistentesNoMock];
        }

        console.log(`[tiendaApi] Retornando ${cloudItems.length} productos de Firestore`);
        return cloudItems;
    } catch (error) {
        console.error("[tiendaApi] Error al obtener implementos de Firebase:", error);
        console.log("[tiendaApi] Usando fallback completo de mocks");
        // Fallback robusto: si falla la lectura (ej. sin internet o err permisos), devolvemos el mock
        return [...implementosMock];
    }
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
