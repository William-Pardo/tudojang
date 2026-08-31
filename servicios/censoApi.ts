
// servicios/censoApi.ts
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
 * SUPERADMIN: Inyecta los datos limpios a la base oficial.
 *
 * Fix ERR-0020 (2026-08-31): antes hacía `batch.set()` DIRECTO sobre `estudiantes` dentro de
 * un writeBatch atómico. firestore.rules bloquea `create` en esa colección sin excepción desde
 * 2026-07-18 (ver el comentario en servicios/estudiantesApi.ts junto a `agregarEstudiante`) --
 * este flujo nunca se migró cuando se cerró la regla, así que `batch.commit()` fallaba siempre
 * con permission-denied y revertía las 199 operaciones del lote entero (N creates + N updates de
 * `registros_temporales` + 1 de la misión), dejando el lote completo sin aprobar sin importar
 * cuántos registros trajera.
 *
 * Se reemplaza por un loop que llama a la Cloud Function `crearEstudiante` una vez por registro
 * -- mismo patrón ya probado en ModalImportacionMasiva.tsx para la importación masiva por CSV.
 * Esa función YA admite a un SuperAdmin creando en cualquier tenant (`assertTenantAutorizado`
 * hace early-return para rol SuperAdmin, functions/academico/estudiantes.js). `registros_temporales`
 * y `misiones_kicho` siguen permitiendo `update` directo del cliente para SuperAdmin (reglas sin
 * cambios) -- solo el `create` de `estudiantes` se movió detrás de la Cloud Function.
 *
 * Efecto secundario deseado: ya no es todo-o-nada. Un registro con datos inválidos no tumba a
 * los demás -- se acumula en `fallos` y se sigue con el resto, mismo criterio que
 * ModalImportacionMasiva. La misión solo pasa a `estadoLote: 'procesado'` si TODOS los registros
 * de esta corrida tuvieron éxito; si algo falla, se queda en 'legalizado' (sigue apareciendo en
 * la bandeja de pendientes de MasterDashboard) para poder reintentar -- el filtro
 * `estado === 'verificado'` sobre `obtenerRegistrosMision` ya excluye automáticamente los
 * registros que este mismo loop haya marcado 'procesado', así que un reintento solo reprocesa
 * los que fallaron.
 */
export const inyectarEstudiantesKicho = async (
    misionId: string,
    registros: RegistroTemporal[]
): Promise<{ exitos: number; fallos: { registro: RegistroTemporal; error: unknown }[] }> => {
    if (!isFirebaseConfigured) return { exitos: 0, fallos: [] };

    // Obtener la misión para conocer su sede asignada
    const misionRef = doc(db, 'misiones_kicho', misionId);
    const misionSnap = await getDoc(misionRef);
    const misionData = misionSnap.exists() ? misionSnap.data() as MisionKicho : null;
    const sedeDefault = misionData?.sedeId || '1';
    const hoy = new Date().toISOString().split('T')[0];

    const crearEstudianteCallable = httpsCallable<
        Omit<Estudiante, 'id' | 'historialPagos'>,
        Estudiante
    >(getFunctions(), 'crearEstudiante');

    const fallos: { registro: RegistroTemporal; error: unknown }[] = [];
    let exitos = 0;

    for (const reg of registros) {
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

        try {
            await crearEstudianteCallable(payload);
            await updateDoc(doc(db, 'registros_temporales', reg.id), { estado: 'procesado' });
            exitos++;
        } catch (error) {
            fallos.push({ registro: reg, error });
        }
    }

    if (fallos.length === 0 && registros.length > 0) {
        await updateDoc(misionRef, { estadoLote: 'procesado' });
    }

    return { exitos, fallos };
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

/**
 * CENSO PÚBLICO (sin login): consulta -- en blur, por campo -- si el correo/teléfono que el
 * aspirante acaba de escribir ya tiene un registro en el sistema (estudiante real o solicitud
 * pendiente). Nunca bloquea el envío del formulario: el llamador solo muestra una advertencia
 * "preguntar y confirmar", nunca un rechazo silencioso. Pasa por la Cloud Function
 * `verificarDuplicadoAspirante` (Admin SDK, App Check) porque el visitante no tiene sesión --
 * mismo patrón que buscarTenantPorSlug (servicios/configuracionApi.ts) sobre
 * resolverTenantPublico. Ver functions/academico/verificacionDuplicados.js: el resultado
 * NUNCA incluye nombre/id del match, solo los 2 booleanos.
 */
export const verificarDuplicadoAspirante = async (
    tenantId: string,
    datos: { correo?: string; telefono?: string }
): Promise<{ correoExiste: boolean; telefonoExiste: boolean }> => {
    if (!isFirebaseConfigured || (!datos.correo && !datos.telefono)) {
        return { correoExiste: false, telefonoExiste: false };
    }
    const callable = httpsCallable<
        { tenantId: string; correo?: string; telefono?: string },
        { correoExiste: boolean; telefonoExiste: boolean }
    >(getFunctions(), 'verificarDuplicadoAspirante');
    const { data } = await callable({ tenantId, ...datos });
    return data;
};