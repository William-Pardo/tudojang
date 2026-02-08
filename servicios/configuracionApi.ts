// servicios/configuracionApi.ts
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/src/config';
import type { ConfiguracionNotificaciones, ConfiguracionClub } from '../tipos';
import { CONFIGURACION_POR_DEFECTO, CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';
import { agregarUsuario } from './usuariosApi';
import { RolUsuario } from '../tipos';

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
    const slugLimpio = slug.toLowerCase().trim();

    // SLUGS RESERVADOS: No pueden ser creados por procesos de registro de usuarios.
    const reservados = ['master', 'admin', 'aliant', 'tudojang', 'www', 'api', 'root', 'support'];

    if (!isFirebaseConfigured) {
        // Mock logic para desarrollo local
        if (reservados.includes(slugLimpio) || slugLimpio === 'dragones') {
            return {
                ...CONFIGURACION_CLUB_POR_DEFECTO,
                slug: slugLimpio,
                tenantId: `id-${slugLimpio}`,
                nombreClub: slugLimpio === 'gajog' ? 'Taekwondo Ga Jog' : `Academia ${slugLimpio.toUpperCase()}`,
                estadoSuscripcion: 'activo',
                plan: 'pro',
            } as ConfiguracionClub;
        }
        return null;
    }

    // Buscamos en Firebase (tenants reales)
    try {
        const tenantsRef = collection(db, 'tenants');
        const q = query(tenantsRef, where("slug", "==", slugLimpio));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Bloqueo preventivo de slugs reservados incluso si no existen en DB
            if (reservados.includes(slugLimpio)) {
                return {
                    slug: slugLimpio,
                    nombreClub: 'SISTEMA / RESERVADO',
                    estadoSuscripcion: 'suspendido'
                } as any;
            }
            return null;
        }

        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as any;
    } catch (error: any) {
        console.warn("⚠️ Advertencia en buscarTenantPorSlug (Firebase):", error.message);

        // SISTEMA 100% NO BLOQUEANTE:
        // Si hay error de permisos, red o configuración, permitimos al usuario proceder.
        // Solo bloqueamos si el nombre es expresamente uno de los reservados del sistema.
        if (reservados.includes(slugLimpio)) {
            return { slug: slugLimpio, nombreClub: 'RESERVADO', estadoSuscripcion: 'suspendido' } as any;
        }

        return null; // Asumimos disponible para no frustrar el onboarding
    }
};

/**
 * Crea un nuevo tenant en el sistema (Onboarding)
 */
export const registrarNuevaEscuela = async (datos: Partial<ConfiguracionClub>, password: string = 'Cambiar123'): Promise<string> => {
    if (!isFirebaseConfigured) return 'mock-id';

    const nuevoTenantId = `tnt-${Date.now()}`;
    const diasPrueba = 7;
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPrueba);

    const configNueva: ConfiguracionClub = {
        ...CONFIGURACION_CLUB_POR_DEFECTO,
        ...datos,
        tenantId: nuevoTenantId,
        slug: datos.slug?.toLowerCase().trim() || '',
        estadoSuscripcion: 'demo', // Acceso inmediato en modo prueba
        plan: datos.plan || 'starter', // Plan inicial para el trial
        fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
        limiteEstudiantes: datos.limiteEstudiantes || 15, // Límite estricto de trial
        representanteLegal: datos.representanteLegal || '',
        pagoNequi: datos.pagoNequi || '', // Guardamos el teléfono del director aquí también por ahora
    };

    // 1. Crear el Tenant en Firestore
    await setDoc(doc(db, 'tenants', nuevoTenantId), configNueva);

    // 2. CREAR USUARIO ADMIN (DIRECTOR) AUTOMÁTICAMENTE
    try {
        if (datos.emailClub && datos.representanteLegal) {
            console.log(">>> Creando usuario admin para:", datos.emailClub);
            await agregarUsuario({
                email: datos.emailClub,
                nombreUsuario: datos.representanteLegal,
                numeroIdentificacion: '000000000', // Placeholder
                whatsapp: datos.pagoNequi || '',
                contrasena: password, // Usar contraseña proporcionada por el usuario
                rol: RolUsuario.Admin,
                tenantId: nuevoTenantId,
                sedeId: 'sede-principal'
            });
            console.log(">>> Usuario admin creado con éxito.");
        }
    } catch (e: any) {
        console.error("🔥 Error crítico creando usuario admin:", e);

        // ROLLBACK: Intentar eliminar el tenant si falla la creación del usuario
        // Nota: Esto puede fallar si las reglas de seguridad no permiten eliminar sin auth,
        // pero lo intentamos para evitar registros "zombie".
        try {
            await deleteDoc(doc(db, 'tenants', nuevoTenantId));
            console.log("↺ Rollback exitoso: Tenant eliminado para liberar slug.");
        } catch (rollbackError) {
            // Silenciamos el error de permisos del rollback para no confundir al usuario
            // Lo importante es el error original de Auth
            console.warn("⚠️ No se pudo ejecutar rollback automático (probablemente permisos), pero el error real es el de abajo.");
        }

        // Relanzar error con mensaje amigable y DIRECTO
        if (e.code === 'auth/configuration-not-found' || e.message.includes('configuration-not-found')) {
            throw new Error("⛔ ERROR DE CONFIGURACIÓN FIREBASE: Debes activar 'Email/Password' en la Consola de Firebase > Authentication > Sign-in method.");
        }
        if (e.code === 'auth/email-already-in-use') {
            throw new Error("Este correo ya está registrado como administrador. Usa otro email.");
        }
        throw e;
    }

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
