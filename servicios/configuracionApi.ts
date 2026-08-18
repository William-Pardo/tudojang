
// servicios/configuracionApi.ts
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { CONFIGURACION_POR_DEFECTO, CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';

const KEY_CONF_NOTIF = 'tkd_mock_conf_notif';

const limpiarObjeto = (obj: any) => {
    const nuevo = { ...obj };
    Object.keys(nuevo).forEach(key => {
        if (nuevo[key] === undefined) delete nuevo[key];
    });
    return nuevo;
};

export const obtenerConfiguracionNotificaciones = async (tenantId: string): Promise<ConfiguracionNotificaciones> => {
    if (!isFirebaseConfigured) {
        const saved = localStorage.getItem(KEY_CONF_NOTIF);
        return saved ? JSON.parse(saved) : CONFIGURACION_POR_DEFECTO;
    }
    const docRef = doc(db, 'notificaciones_config', tenantId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as ConfiguracionNotificaciones) : CONFIGURACION_POR_DEFECTO;
};

export const guardarConfiguracionNotificaciones = async (config: ConfiguracionNotificaciones): Promise<void> => {
    if (!isFirebaseConfigured) {
        localStorage.setItem(KEY_CONF_NOTIF, JSON.stringify(config));
        return;
    }
    if (!config.tenantId) throw new Error("Falta tenantId en configuración de notificaciones");
    await setDoc(doc(db, 'notificaciones_config', config.tenantId), limpiarObjeto(config), { merge: true });
};

export const buscarTenantPorSlug = async (slug: string): Promise<ConfiguracionClub | null> => {
    if (!isFirebaseConfigured) {
        // En modo mock, solo existe 'gajog' y 'dragones' por defecto
        if (slug !== 'tudojang' && slug !== 'dragones') return null;

        return {
            ...CONFIGURACION_CLUB_POR_DEFECTO,
            slug: slug,
            tenantId: `id-${slug}`,
            nombreClub: slug === 'tudojang' ? 'Tudojang SaaS' : `Academia ${slug.toUpperCase()}`,
            colorPrimario: slug === 'dragones' ? '#4c1d95' : '#1f3e90',
            estadoSuscripcion: 'activo',
            fechaVencimiento: '2030-12-31',
        } as ConfiguracionClub;
    }

    // Bug real (sesion 2026-08-06): esto consultaba `tenants` DIRECTO desde el cliente, pero
    // firestore.rules exige authenticated() para leer esa coleccion -- un visitante SIN LOGIN
    // (el caso real de esta funcion: CensoPublico.tsx, EventoPublico.tsx via
    // BrandingProvider.tsx, y el check de slug en RegistroEscuela.tsx) nunca podia resolver el
    // tenant y veia "Escuela No Encontrada" en vez del formulario/evento. Nunca se detecto
    // porque las pruebas siempre se hacian con sesion de Admin abierta en el mismo navegador.
    // Ahora pasa por la Cloud Function `resolverTenantPublico` (Admin SDK, bypasea las reglas),
    // que devuelve solo el subconjunto de campos publicos -- ver functions/academico/tenantPublico.js.
    const callable = httpsCallable<{ slug: string }, ConfiguracionClub | null>(
        getFunctions(),
        'resolverTenantPublico'
    );
    const { data } = await callable({ slug });
    return data;
};

/**
 * Crea un nuevo tenant en el sistema (Onboarding).
 *
 * SDD pricing-cupo-real (Bloque 4): ya no hay planes que seleccionar al registrar una
 * escuela nueva -- el trial de 7 días (`estadoSuscripcion:'demo'`) se activa igual para
 * cualquier tenant nuevo, sin depender de un plan/límite inicial (capacidad-tenant: la
 * capacidad incluida es fija -- `calcularCapacidad`, no un valor por plan).
 */
export const registrarNuevaEscuela = async (datos: Partial<ConfiguracionClub>): Promise<string> => {
    if (!isFirebaseConfigured) return '';

    const nuevoTenantId = datos.tenantId || `tnt-${Date.now()}`;

    const configNueva: ConfiguracionClub = {
        ...CONFIGURACION_CLUB_POR_DEFECTO,
        estadoSuscripcion: 'demo', // Valor por defecto
        fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 días de gracia
        ...datos,
        tenantId: nuevoTenantId,
        slug: datos.slug?.toLowerCase().trim() || '',
    };

    await setDoc(doc(db, 'tenants', nuevoTenantId), configNueva);
    return nuevoTenantId;
};

export const obtenerConfiguracionClub = async (tenantId?: string): Promise<ConfiguracionClub> => {
    if (!isFirebaseConfigured) {
        // Added comment above fix: explicitly cast CONFIGURACION_CLUB_POR_DEFECTO to ConfiguracionClub.
        return CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub;
    }

    if (tenantId) {
        const docRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as any;
    }

    const host = window.location.hostname;
    let slug = host.split('.')[0];
    if (slug === 'localhost' || slug === '127' || slug === 'www') slug = 'gajog';
    const tenant = await buscarTenantPorSlug(slug);
    // Added comment above fix: explicitly cast CONFIGURACION_CLUB_POR_DEFECTO to ConfiguracionClub.
    return tenant || CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub;
};

export const guardarConfiguracionClub = async (config: ConfiguracionClub): Promise<void> => {
    if (!isFirebaseConfigured) return;
    if (!config.tenantId) throw new Error("Falta tenantId en configuración de club");
    await setDoc(doc(db, 'tenants', config.tenantId), limpiarObjeto(config), { merge: true });
};

// SDD pricing-cupo-real (D7, design.md "Protecting billing-affecting tenant fields"):
// antes hacia `updateDoc(docRef, {[campo]: increment(cantidad)})` directo -- firestore.rules
// ya no permite que el cliente escriba `sedesExtraContratadas`/`equipoTecnicoExtraContratado`
// (camposFacturacionInmutables() en el `allow update` de tenants/{tenantId}), asi que
// cualquier Admin del club podia antes otorgarse un extra gratis con un solo `updateDoc`
// desde la consola del navegador. Ahora es un wrapper delgado sobre la Cloud Function
// `actualizarExtrasContratados` (functions/academico/capacidad.js), que re-valida rol/tenant
// y persiste server-side -- mismo patron ya usado en sedesApi.ts/estudiantesApi.ts.
export const actualizarCapacidadClub = async (
    tenantId: string,
    campo: 'sedesExtraContratadas' | 'equipoTecnicoExtraContratado',
    cantidad: number
): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const callable = httpsCallable<
        { tenantId: string; campo: 'sedesExtraContratadas' | 'equipoTecnicoExtraContratado'; cantidad: number },
        { tenantId: string; campo: string; valor: number }
    >(getFunctions(), 'actualizarExtrasContratados');
    await callable({ tenantId, campo, cantidad });
};

/**
 * SUPER ADMIN: Obtiene todas las academias registradas en el ecosistema.
 */
export const obtenerTodosLosTenants = async (): Promise<ConfiguracionClub[]> => {
    if (!isFirebaseConfigured) {
        return [
            CONFIGURACION_CLUB_POR_DEFECTO,
            { ...CONFIGURACION_CLUB_POR_DEFECTO, tenantId: 't2', nombreClub: 'Dragones TKD', slug: 'dragones', estadoSuscripcion: 'demo' },
            { ...CONFIGURACION_CLUB_POR_DEFECTO, tenantId: 't3', nombreClub: 'TKD Master Center', slug: 'master', estadoSuscripcion: 'suspendido' }
        ];
    }
    const snapshot = await getDocs(collection(db, 'tenants'));
    return snapshot.docs.map(doc => {
        const data = doc.data();
        // fechaVencimiento puede llegar como Firestore Timestamp (escrita por
        // functions/index.js con admin.firestore.Timestamp.fromDate) o como string.
        // Se normaliza siempre a string ISO para que la UI la pueda renderizar directo.
        const fechaVencimiento = data.fechaVencimiento?.toDate
            ? data.fechaVencimiento.toDate().toISOString().split('T')[0]
            : data.fechaVencimiento;
        return { id: doc.id, ...data, fechaVencimiento } as any;
    });
};

/**
 * SUPER ADMIN: Cambia el estado de una academia (Activar/Suspender).
 */
export const cambiarEstadoSuscripcionTenant = async (tenantId: string, nuevoEstado: 'activo' | 'suspendido' | 'demo'): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'tenants', tenantId);
    await updateDoc(docRef, { estadoSuscripcion: nuevoEstado });
};
