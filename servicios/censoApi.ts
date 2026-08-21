
// servicios/censoApi.ts
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, increment, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { MisionKicho, RegistroTemporal, Estudiante } from '../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../tipos';
import { MISION_KICHO_DURACION_DIAS } from '../constantes';

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
            fechaExpiracion: new Date(Date.now() + MISION_KICHO_DURACION_DIAS * 86400000).toISOString(),
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
 * TENANT: Corrige los datos capturados por el aspirante/tutor en el formulario público
 * (typos, teléfono mal digitado, etc.) sin tocar `estado` -- distinto de aprobar/rechazar.
 * Reemplaza el objeto `datos` completo (mismo criterio que registrarAspirantePublico, que
 * también lo escribe entero) en vez de mergear campo a campo.
 */
export const actualizarDatosRegistroTemporal = async (id: string, datos: RegistroTemporal['datos']): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'registros_temporales', id), { datos });
};

/**
 * Lectura pública de una misión por id (censo público, sin login) para validar que el
 * link siga vigente antes de mostrar el formulario -- ver misionVigente() en firestore.rules,
 * misma condición (activa + no vencida) aplicada del lado del cliente.
 */
export const obtenerMisionPorId = async (misionId: string): Promise<MisionKicho | null> => {
    if (!isFirebaseConfigured) return null;
    const snap = await getDoc(doc(db, 'misiones_kicho', misionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MisionKicho;
};

/**
 * SUPERADMIN: Corta manualmente la vigencia de una misión activa (soporte/seguridad),
 * sin esperar a que el tenant la legalice ni a que venza el contador (MISION_KICHO_DURACION_DIAS, ver constantes.ts).
 */
export const desactivarMisionKicho = async (misionId: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'misiones_kicho', misionId), {
        activa: false,
        estadoLote: 'cancelado',
        fechaCancelacion: new Date().toISOString()
    });
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
            estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
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

/**
 * Bug real (sesion 2026-08-08): esta query filtraba SOLO por misionId, sin tenantId. La regla
 * `registros_temporales` exige `resource.data.tenantId == currentTenantId()` -- para un `list`,
 * Firestore evalua la condicion contra los filtros DECLARADOS en la query, no contra los datos
 * reales; si tenantId no esta entre esos filtros, no puede verificar la regla y rechaza TODO el
 * list con permission-denied, sin importar cuantos documentos matcheen misionId de verdad.
 * Se agrega tenantId como segundo filtro de igualdad (no requiere indice compuesto, verificado
 * contra Firestore real) para que la query sea estaticamente verificable.
 */
export const obtenerRegistrosMision = async (misionId: string, tenantId: string): Promise<RegistroTemporal[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(
        collection(db, 'registros_temporales'),
        where("misionId", "==", misionId),
        where("tenantId", "==", tenantId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroTemporal));
};

/**
 * TENANT: Aspirantes pendientes de todo el tenant, sin importar la misión de origen.
 * Filtra por tenantId (no por misionId) para que el link fijo "Compartir Formulario"
 * (?club=slug, sin campaña Kicho activa) también quede visible en la bandeja de revisión.
 */
export const obtenerRegistrosPendientesTenant = async (tenantId: string): Promise<RegistroTemporal[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(
        collection(db, 'registros_temporales'),
        where("tenantId", "==", tenantId),
        where("estado", "==", "pendiente")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroTemporal));
};

/**
 * TENANT: TODOS los registros temporales del tenant (cualquier estado, cualquier misionId --
 * misión con campaña o link fijo de Captación). Para exportar/auditar, no para la bandeja de
 * revisión (esa usa obtenerRegistrosPendientesTenant, solo 'pendiente').
 */
export const obtenerTodosRegistrosTenant = async (tenantId: string): Promise<RegistroTemporal[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(collection(db, 'registros_temporales'), where("tenantId", "==", tenantId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RegistroTemporal));
};

/**
 * TENANT: Descarta el registro temporal una vez que sus datos ya quedaron
 * incorporados a un Estudiante real (aprobación individual) o tras rechazarlo.
 */
export const eliminarRegistroTemporal = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'registros_temporales', id));
};