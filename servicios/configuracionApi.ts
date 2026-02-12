
// servicios/configuracionApi.ts
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { CONFIGURACION_POR_DEFECTO, CONFIGURACION_CLUB_POR_DEFECTO, PLANES_SAAS } from '../constantes';

const KEY_CONF_NOTIF = 'tkd_mock_conf_notif';
const KEY_CONF_CLUB = 'tkd_mock_conf_club';

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
        // En modo mock, solo existe 'gajog' y 'dragones' por defecto
        if (slug !== 'gajog' && slug !== 'dragones') return null;

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
export const registrarNuevaEscuela = async (datos: Partial<ConfiguracionClub>): Promise<string> => {
    if (!isFirebaseConfigured) return '';

    const nuevoTenantId = datos.tenantId || `tnt-${Date.now()}`;
    const planId = (datos.plan || 'starter') as keyof typeof PLANES_SAAS;
    const infoPlan = PLANES_SAAS[planId] || PLANES_SAAS.starter;

    const configNueva: ConfiguracionClub = {
        ...CONFIGURACION_CLUB_POR_DEFECTO,
        estadoSuscripcion: 'demo', // Valor por defecto
        fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 días de gracia
        ...datos,
        tenantId: nuevoTenantId,
        slug: datos.slug?.toLowerCase().trim() || '',
        // Forzar los límites según el plan elegido para evitar trampas o errores
        limiteEstudiantes: infoPlan.limiteEstudiantes,
        limiteUsuarios: infoPlan.limiteUsuarios,
        limiteSedes: infoPlan.limiteSedes
    };

    await setDoc(doc(db, 'tenants', nuevoTenantId), configNueva);
    return nuevoTenantId;
};

export const obtenerConfiguracionClub = async (tenantId?: string): Promise<ConfiguracionClub> => {
    if (!isFirebaseConfigured) {
        const saved = localStorage.getItem(KEY_CONF_CLUB);
        if (saved) return JSON.parse(saved);
        // Si no hay guardado, devolver y guardar el valor por defecto
        localStorage.setItem(KEY_CONF_CLUB, JSON.stringify(CONFIGURACION_CLUB_POR_DEFECTO));
        return CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub;
    }

    const host = window.location.hostname;
    let slug = host.split('.')[0];
    if (slug === 'localhost' || slug === '127' || slug === 'www') slug = 'gajog';

    // Determinar qué ID buscar
    const targetTenantId = tenantId || (slug === 'gajog' ? 'escuela-gajog-001' : null);

    if (targetTenantId) {
        const docRef = doc(db, 'tenants', targetTenantId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as any;
        }

        // AUTO-CURACIÓN: Si el tenant por defecto (gajog) no existe, lo recreamos
        if (targetTenantId === 'escuela-gajog-001') {
            console.warn("[configuracionApi] Tenant maestro no encontrado. Recreando configuración por defecto...");
            const defaultDoc: ConfiguracionClub = {
                ...CONFIGURACION_CLUB_POR_DEFECTO,
                tenantId: 'escuela-gajog-001',
                slug: 'gajog',
                nombreClub: 'Taekwondo Ga Jog',
                estadoSuscripcion: 'activo',
                plan: 'pro'
            };
            await setDoc(doc(db, 'tenants', 'escuela-gajog-001'), defaultDoc);
            return defaultDoc;
        }
    }

    const tenant = await buscarTenantPorSlug(slug);
    return tenant || CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub;
};

export const guardarConfiguracionClub = async (config: ConfiguracionClub): Promise<void> => {
    if (!isFirebaseConfigured) {
        localStorage.setItem(KEY_CONF_CLUB, JSON.stringify(config));
        return;
    }
    // Asegurarse de usar el ID correcto para el documento (tenantId es el campo oficial)
    const docId = config.tenantId || (config as any).id;
    if (!docId) {
        const errorMsg = "[configuracionApi] Error: No se puede guardar configuración sin tenantId";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    await setDoc(doc(db, 'tenants', docId), config, { merge: true });
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

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const subirLogoTenant = async (tenantId: string, file: File): Promise<string> => {
    if (!isFirebaseConfigured) {
        return URL.createObjectURL(file);
    }
    const storage = getStorage();
    const storageRef = ref(storage, `logos/${tenantId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
};
