// servicios/configuracionApi.ts
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import type { ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { CONFIGURACION_POR_DEFECTO, CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';

const KEY_CONF_NOTIF = 'tkd_mock_conf_notif';

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
    await setDoc(doc(db, 'notificaciones_config', config.tenantId), config, { merge: true });
};

export const buscarTenantPorSlug = async (slug: string): Promise<ConfiguracionClub | null> => {
    if (!isFirebaseConfigured) {
        // Added comment above fix: explicitly cast the mock object to ConfiguracionClub.
        return {
            ...CONFIGURACION_CLUB_POR_DEFECTO,
            slug: slug,
            tenantId: `id-${slug}`,
            nombreClub: slug === 'gajog' ? 'Taekwondo Ga Jog' : `Academia ${slug.toUpperCase()}`,
            colorPrimario: slug === 'dragones' ? '#4c1d95' : '#1f3e90',
            estadoSuscripcion: 'activo',
            fechaVencimiento: '2025-12-31',
            plan: 'pro',
            limiteEstudiantes: 100
        } as ConfiguracionClub;
    }

    const tenantsRef = collection(db, 'tenants');
    const q = query(tenantsRef, where("slug", "==", slug.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as any;
};

/**
 * Crea un nuevo tenant en el sistema (Onboarding)
 */
export const registrarNuevaEscuela = async (datos: Partial<ConfiguracionClub>): Promise<void> => {
    if (!isFirebaseConfigured) return;

    const nuevoTenantId = `tnt-${Date.now()}`;
    const configNueva: ConfiguracionClub = {
        ...CONFIGURACION_CLUB_POR_DEFECTO,
        ...datos,
        tenantId: nuevoTenantId,
        slug: datos.slug?.toLowerCase().trim() || '',
        estadoSuscripcion: 'demo', // Acceso inmediato en modo prueba
        plan: datos.plan || 'starter', // Plan inicial para el trial
        fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 días de prueba
        limiteEstudiantes: 15, // Límite estricto de trial
    };

    await setDoc(doc(db, 'tenants', nuevoTenantId), configNueva);
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
    await setDoc(doc(db, 'tenants', config.tenantId), config, { merge: true });
};

export const actualizarCapacidadClub = async (
    tenantId: string,
    campo: 'limiteEstudiantes' | 'limiteUsuarios' | 'limiteSedes',
    cantidad: number
): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'tenants', tenantId);
    await updateDoc(docRef, {
        [campo]: increment(cantidad)
    });
};

export const actualizarPlanClub = async (
    tenantId: string,
    nuevoPlan: any
): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'tenants', tenantId);
    await updateDoc(docRef, {
        plan: nuevoPlan.id,
        limiteEstudiantes: nuevoPlan.limiteEstudiantes,
        limiteUsuarios: nuevoPlan.limiteUsuarios,
        limiteSedes: nuevoPlan.limiteSedes
    });
};

/**
 * SUPER ADMIN: Obtiene todas las academias registradas en el ecosistema.
 */
export const obtenerTodosLosTenants = async (): Promise<ConfiguracionClub[]> => {
    if (!isFirebaseConfigured) {
        return [
            CONFIGURACION_CLUB_POR_DEFECTO,
            { ...CONFIGURACION_CLUB_POR_DEFECTO, tenantId: 't2', nombreClub: 'Dragones TKD', slug: 'dragones', estadoSuscripcion: 'demo', plan: 'starter' },
            { ...CONFIGURACION_CLUB_POR_DEFECTO, tenantId: 't3', nombreClub: 'TKD Master Center', slug: 'master', estadoSuscripcion: 'suspendido', plan: 'pro' }
        ];
    }
    const snapshot = await getDocs(collection(db, 'tenants'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

/**
 * SUPER ADMIN: Cambia el estado de una academia (Activar/Suspender).
 */
export const cambiarEstadoSuscripcionTenant = async (tenantId: string, nuevoEstado: 'activo' | 'suspendido' | 'demo'): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const docRef = doc(db, 'tenants', tenantId);
    await updateDoc(docRef, { estadoSuscripcion: nuevoEstado });
};
