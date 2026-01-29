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

export const obtenerImplementos = async (): Promise<Implemento[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de implementos de prueba.");
        const mockImplementos: Implemento[] = [
            {
                id: 'imp-001',
                nombre: 'Dobok (Uniforme) Nacional',
                descripcion: 'Uniforme oficial para la práctica de Taekwondo. Ligero y resistente, ideal para entrenamiento y competencia.',
                imagenUrl: '/imagenes/uniforme-nacional.png',
                categoria: CategoriaImplemento.Uniformes,
                variaciones: [
                    { id: 'v-001-1', descripcion: 'Talla 0 (120 cm)', precio: 120000 },
                    { id: 'v-001-2', descripcion: 'Talla 1 (130 cm)', precio: 130000 },
                    { id: 'v-001-3', descripcion: 'Talla 2 (140 cm)', precio: 140000 },
                    { id: 'v-001-4', descripcion: 'Talla 3 (150 cm)', precio: 150000 },
                    { id: 'v-001-5', descripcion: 'Talla 4 (160 cm)', precio: 160000 },
                ],
            },
            {
                id: 'imp-002',
                nombre: 'Pechera (Hogu) Reversible',
                descripcion: 'Protector de torso reversible (azul/rojo) aprobado para competencia. Absorbe impactos y ofrece gran movilidad.',
                imagenUrl: '/imagenes/pechera.png',
                categoria: CategoriaImplemento.ProteccionTorso,
                variaciones: [
                    { id: 'v-002-1', descripcion: 'Talla 1', precio: 95000 },
                    { id: 'v-002-2', descripcion: 'Talla 2', precio: 105000 },
                    { id: 'v-002-3', descripcion: 'Talla 3', precio: 115000 },
                    { id: 'v-002-4', descripcion: 'Talla 4', precio: 125000 },
                ],
            },
            {
                id: 'imp-003',
                nombre: 'Casco de Combate',
                descripcion: 'Casco de protección para la cabeza, esencial para el combate seguro. Disponible con y sin careta protectora facial.',
                imagenUrl: '/imagenes/casco.png',
                categoria: CategoriaImplemento.ProteccionCabeza,
                variaciones: [
                    { id: 'v-003-1', descripcion: 'Talla S - Sin careta', precio: 80000 },
                    { id: 'v-003-2', descripcion: 'Talla M - Sin careta', precio: 85000 },
                    { id: 'v-003-3', descripcion: 'Talla L - Sin careta', precio: 90000 },
                    { id: 'v-003-4', descripcion: 'Talla M - Con careta', precio: 130000 },
                    { id: 'v-003-5', descripcion: 'Talla L - Con careta', precio: 140000 },
                ],
            },
            {
                id: 'imp-004',
                nombre: 'Guantines de Combate',
                descripcion: 'Guantes de protección para manos y nudillos, obligatorios para la competencia.',
                imagenUrl: '/imagenes/guantines.png',
                categoria: CategoriaImplemento.ProteccionExtremidades,
                variaciones: [
                    { id: 'v-004-1', descripcion: 'Talla S', precio: 45000 },
                    { id: 'v-004-2', descripcion: 'Talla M', precio: 50000 },
                    { id: 'v-004-3', descripcion: 'Talla L', precio: 55000 },
                ],
            },
            {
                id: 'imp-005',
                nombre: 'Empeineras (Protector de Pie)',
                descripcion: 'Protector de empeine con sensores electrónicos o sin ellos, para entrenamiento y competencia.',
                imagenUrl: '/imagenes/empeinera.png',
                categoria: CategoriaImplemento.ProteccionExtremidades,
                variaciones: [
                    { id: 'v-005-1', descripcion: 'Talla S', precio: 60000 },
                    { id: 'v-005-2', descripcion: 'Talla M', precio: 65000 },
                    { id: 'v-005-3', descripcion: 'Talla L', precio: 70000 },
                ],
            },
            {
                id: 'imp-006',
                nombre: 'Braceras (Protector de Antebrazo)',
                descripcion: 'Protección esencial para los antebrazos durante los bloqueos y el combate.',
                imagenUrl: '/imagenes/bracera.png',
                categoria: CategoriaImplemento.ProteccionExtremidades,
                variaciones: [
                    { id: 'v-006-1', descripcion: 'Talla S', precio: 50000 },
                    { id: 'v-006-2', descripcion: 'Talla M', precio: 55000 },
                    { id: 'v-006-3', descripcion: 'Talla L', precio: 60000 },
                ],
            },
            {
                id: 'imp-007',
                nombre: 'Canilleras (Protector Tibial)',
                descripcion: 'Protección rígida para las tibias, vital para evitar lesiones en combate.',
                imagenUrl: '/imagenes/canilleras.png',
                categoria: CategoriaImplemento.ProteccionExtremidades,
                variaciones: [
                    { id: 'v-007-1', descripcion: 'Talla S', precio: 55000 },
                    { id: 'v-007-2', descripcion: 'Talla M', precio: 60000 },
                    { id: 'v-007-3', descripcion: 'Talla L', precio: 65000 },
                ],
            },
            {
                id: 'imp-008',
                nombre: 'Copa Masculina (Protector inguinal)',
                descripcion: 'Protector inguinal para hombres, de uso obligatorio en combate.',
                imagenUrl: '/imagenes/copa-masculina.png',
                categoria: CategoriaImplemento.Accesorios,
                variaciones: [
                    { id: 'v-008-1', descripcion: 'Talla M', precio: 40000 },
                    { id: 'v-008-2', descripcion: 'Talla L', precio: 45000 },
                ],
            },
            {
                id: 'imp-009',
                nombre: 'Copa Femenina (Protector inguinal)',
                descripcion: 'Protector inguinal para mujeres, de uso obligatorio en combate.',
                imagenUrl: '/imagenes/copa-mujer.png',
                categoria: CategoriaImplemento.Accesorios,
                variaciones: [
                    { id: 'v-009-1', descripcion: 'Talla S', precio: 40000 },
                    { id: 'v-009-2', descripcion: 'Talla M', precio: 45000 },
                ],
            },
            {
                id: 'imp-010',
                nombre: 'Dobok (Uniforme) Importado',
                descripcion: 'Uniforme de alta gama para competencia, con tecnología de ventilación y tejido ultraligero.',
                imagenUrl: '/imagenes/uniforme-importado.png',
                categoria: CategoriaImplemento.Uniformes,
                variaciones: [
                    { id: 'v-010-1', descripcion: 'Talla 2 (140 cm)', precio: 250000 },
                    { id: 'v-010-2', descripcion: 'Talla 3 (150 cm)', precio: 270000 },
                    { id: 'v-010-3', descripcion: 'Talla 4 (160 cm)', precio: 290000 },
                ],
            },
        ];
        return mockImplementos;
    }
    const snapshot = await getDocs(implementosCollection);
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

export const obtenerSolicitudesCompra = async (): Promise<SolicitudCompra[]> => {
    if (!isFirebaseConfigured) {
        console.warn("MODO SIMULADO: Devolviendo lista de solicitudes de compra vacía.");
        return [];
    }
    const q = query(solicitudesCompraCollection, where("estado", "==", EstadoSolicitudCompra.Pendiente));
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