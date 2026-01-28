
// servicios/censoApi.ts
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { MisionKicho, RegistroTemporal, Estudiante, PagoRegistro } from '../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../tipos';

/**
 * SUPERADMIN: Crea una nueva misión técnica para una escuela
 */
export const crearMisionKicho = async (datos: Omit<MisionKicho, 'id' | 'registrosRecibidos' | 'estadoLote' | 'activa'>): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const nueva = {
        ...datos,
        activa: true,
        registrosRecibidos: 0,
        estadoLote: 'captura'
    };
    await addDoc(collection(db, 'misiones_kicho'), nueva);
};

// Added comment above fix: Exported obtenerMisiones for use in MasterDashboard.tsx
/**
 * SUPERADMIN: Obtiene todas las misiones registradas
 */
export const obtenerMisiones = async (): Promise<MisionKicho[]> => {
    if (!isFirebaseConfigured) return [];
    const snapshot = await getDocs(collection(db, 'misiones_kicho'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MisionKicho));
};

/**
 * TENANT: Obtiene la misión activa para su escuela
 */
export const obtenerMisionActivaTenant = async (tenantId: string): Promise<MisionKicho | null> => {
    if (!isFirebaseConfigured) {
        return {
            id: 'm-mock-1',
            tenantId,
            nombreMision: 'MISIÓN KICHO: APERTURA 2024',
            fechaExpiracion: new Date(Date.now() + 86400000).toISOString(),
            activa: true,
            registrosRecibidos: 3,
            estadoLote: 'captura'
        };
    }
    const q = query(collection(db, 'misiones_kicho'), where("tenantId", "==", tenantId), where("activa", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as MisionKicho;
};

// Added comment above fix: Exported registrarAspirantePublico for use in CensoPublico.tsx
/**
 * REGISTRAR ASPIRANTE DESDE FORMULARIO PÚBLICO
 */
export const registrarAspirantePublico = async (misionId: string, tenantId: string, datos: RegistroTemporal['datos']): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const nuevoRegistro = {
        misionId,
        tenantId,
        fechaRegistro: new Date().toISOString(),
        estado: 'pendiente',
        datos
    };
    await addDoc(collection(db, 'registros_temporales'), nuevoRegistro);

    // Incrementar contador en la misión
    try {
        const misionRef = doc(db, 'misiones_kicho', misionId);
        await updateDoc(misionRef, {
            registrosRecibidos: increment(1)
        });
    } catch (e: any) {
        console.warn("Misión ID no encontrada o inválida para incremento.");
    }
};

/**
 * TENANT: Cambia el estado interno de un registro temporal
 */
export const validarRegistroTemporal = async (id: string, estado: RegistroTemporal['estado']): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'registros_temporales', id), { estado });
};

/**
 * TENANT: El Admin firma y envía el lote al SuperAdmin
 */
export const legalizarLoteKicho = async (misionId: string, firmaBase64: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'misiones_kicho', misionId), {
        estadoLote: 'legalizado',
        activa: false,
        firmaLegalizacion: firmaBase64,
        fechaLegalizacion: new Date().toISOString()
    });
};

/**
 * SUPERADMIN: Inyecta los datos limpios a la base oficial
 */
export const inyectarEstudiantesKicho = async (misionId: string, registros: RegistroTemporal[]): Promise<void> => {
    if (!isFirebaseConfigured) return;

    const batch = writeBatch(db);
    const hoy = new Date().toISOString().split('T')[0];

    registros.forEach(reg => {
        const estRef = doc(collection(db, 'estudiantes'));
        const { datos } = reg;

        const payload: Omit<Estudiante, 'id'> = {
            tenantId: reg.tenantId,
            nombres: datos.nombres.toUpperCase().trim(),
            apellidos: datos.apellidos.toUpperCase().trim(),
            numeroIdentificacion: datos.telefono, // O el campo que definas como ID único
            fechaNacimiento: datos.fechaNacimiento,
            grado: GradoTKD.Blanco,
            grupo: GrupoEdad.NoAsignado,
            horasAcumuladasGrado: 0,
            sedeId: datos.sedeSugeridaId || '1',
            telefono: datos.telefono,
            correo: datos.email.toLowerCase().trim(),
            fechaIngreso: hoy,
            estadoPago: EstadoPago.AlDia,
            saldoDeudor: 0,
            historialPagos: [],
            consentimientoInformado: false,
            contratoServiciosFirmado: false,
            consentimientoImagenFirmado: false,
            consentimientoFotosVideos: false,
            carnetGenerado: false,
            tutor: datos.tutorNombre ? {
                nombres: datos.tutorNombre.toUpperCase().trim(),
                apellidos: '',
                numeroIdentificacion: '',
                telefono: datos.tutorTelefono || '',
                correo: datos.tutorEmail || ''
            } : undefined
        };

        batch.set(estRef, payload);
        batch.update(doc(db, 'registros_temporales', reg.id), { estado: 'procesado' });
    });

    batch.update(doc(db, 'misiones_kicho', misionId), { estadoLote: 'procesado' });
    await batch.commit();
};

export const obtenerRegistrosMision = async (misionId: string): Promise<RegistroTemporal[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(collection(db, 'registros_temporales'), where("misionId", "==", misionId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as RegistroTemporal));
};

/**
 * PREMIUM: Crea una solicitud de inscripción para un nuevo alumno
 */
export const crearSolicitudInscripcion = async (tenantId: string, datos: Partial<RegistroTemporal['datos']>, monto: number): Promise<string> => {
    if (!isFirebaseConfigured) return 'mock-ins-123';
    const nuevaSolicitud = {
        tenantId,
        misionId: 'inscripcion_premium',
        fechaRegistro: new Date().toISOString(),
        estado: 'pendiente_pago',
        pago: {
            monto,
            metodo: 'otros'
        },
        datos
    };
    const docRef = await addDoc(collection(db, 'registros_temporales'), nuevaSolicitud);
    return docRef.id;
};

/**
 * PREMIUM: Sube soporte de pago y pasa a verificación
 */
export const subirSoportePago = async (id: string, soporteUrl: string, metodo: PagoRegistro['metodo']): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'registros_temporales', id), {
        estado: 'por_verificar',
        'pago.soporteUrl': soporteUrl,
        'pago.metodo': metodo,
        'pago.fechaPago': new Date().toISOString()
    });
};

/**
 * PREMIUM: Obtiene una solicitud por su ID (para el Smart Link)
 */
export const obtenerSolicitudInscripcion = async (id: string): Promise<RegistroTemporal | null> => {
    if (!isFirebaseConfigured) return null;
    const snap = await getDoc(doc(db, 'registros_temporales', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as RegistroTemporal;
};