
// servicios/censoApi.ts
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { MisionKicho, RegistroTemporal, Estudiante } from '../tipos';
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
export const registrarAspirantePublico = async (misionId: string, tenantId: string, datos: any): Promise<void> => {
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
    } catch (e) {
        console.warn("Misión ID no encontrada o inválida para incremento.");
    }
};

/**
 * TENANT: Cambia el estado interno de un registro temporal
 */
export const validarRegistroTemporal = async (id: string, estado: 'verificado' | 'rechazado'): Promise<void> => {
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

    // Obtener la misión para conocer su sede asignada
    const misionRef = doc(db, 'misiones_kicho', misionId);
    const misionSnap = await getDoc(misionRef);
    const misionData = misionSnap.exists() ? misionSnap.data() as MisionKicho : null;
    const sedeDefault = misionData?.sedeId || '1';

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
            sedeId: datos.sedeSugeridaId || sedeDefault,
            telefono: datos.telefono,
            correo: datos.email.toLowerCase().trim(),
            fechaIngreso: hoy,
            estadoPago: EstadoPago.AlDia,
            saldoDeudor: 0,
            historialPagos: [],
            consentimientoInformado: true,
            contratoServiciosFirmado: true,
            consentimientoImagenFirmado: true,
            consentimientoFotosVideos: true,
            carnetGenerado: false,
            eps: datos.eps || '',
            rh: datos.rh || '',
            direccion: datos.direccion || '',
            barrio: datos.barrio || '',
            tutor: datos.tutorNombre ? {
                nombres: datos.tutorNombre.toUpperCase().trim(),
                apellidos: datos.tutorApellidos?.toUpperCase().trim() || '',
                numeroIdentificacion: datos.tutorCedula || '',
                telefono: datos.tutorTelefono || '',
                correo: datos.tutorEmail || ''
            } : undefined
        };

        batch.set(estRef, payload);
        batch.update(doc(db, 'registros_temporales', reg.id), { estado: 'procesado' });
    });

    batch.update(misionRef, { estadoLote: 'procesado' });
    await batch.commit();
};

export const obtenerRegistrosMision = async (misionId: string): Promise<RegistroTemporal[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(collection(db, 'registros_temporales'), where("misionId", "==", misionId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroTemporal));
};