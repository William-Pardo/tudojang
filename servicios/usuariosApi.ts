
// servicios/usuariosApi.ts
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    updateDoc,
    arrayUnion,
    query,
    where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import type { Usuario } from '../tipos';
import { RolUsuario } from '../tipos';

interface UsuarioSimulado extends Usuario {
    contrasena: string;
}

// Usuarios iniciales para pruebas locales sin Firebase
let usuariosMock: UsuarioSimulado[] = [
    {
        id: 'master-aliant',
        email: 'aliantlab@gmail.com',
        nombreUsuario: 'Aliant Master Control',
        numeroIdentificacion: '00000000',
        whatsapp: '3000000000',
        rol: RolUsuario.SuperAdmin,
        tenantId: 'aliant-global',
        contrasena: 'admin123'
    },
    {
        id: 'admin-001',
        email: 'admin@test.com',
        nombreUsuario: 'Director General (Admin)',
        numeroIdentificacion: '1020304050',
        whatsapp: '3001234567',
        rol: RolUsuario.Admin,
        tenantId: 'escuela-gajog-001',
        contrasena: 'admin123'
    },
    {
        id: 'editor-001',
        email: 'editor@test.com',
        nombreUsuario: 'Secretaría (Editor)',
        numeroIdentificacion: '1020304051',
        whatsapp: '3101234567',
        rol: RolUsuario.Editor,
        tenantId: 'escuela-gajog-001',
        contrasena: 'editor123'
    },
    {
        id: 'asistente-001',
        email: 'asistente@test.com',
        nombreUsuario: 'Apoyo Sede (Asistente)',
        numeroIdentificacion: '1020304052',
        whatsapp: '3201234567',
        rol: RolUsuario.Asistente,
        tenantId: 'escuela-gajog-001',
        sedeId: '1',
        contrasena: 'asistente123'
    }
];

export const autenticarUsuario = async (email: string, contrasena: string): Promise<Usuario> => {
    if (!isFirebaseConfigured) {
        const encontrado = usuariosMock.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (encontrado && encontrado.contrasena === contrasena) {
            const { contrasena: _, ...usuarioData } = encontrado;
            return usuarioData;
        }
        throw new Error("Correo electrónico o contraseña incorrectos.");
    }

    const auth = getAuth();
    console.log(`[autenticarUsuario] Intentando signIn para: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, contrasena);
    const uid = userCredential.user.uid;

    // Lógica de reintento para esperar al usuario doc en Firestore
    let intentos = 0;
    while (intentos < 5) {
        console.log(`[autenticarUsuario] Buscando perfil en Firestore (uid: ${uid}, intento ${intentos + 1}/5)`);

        try {
            // 1. Intentar por UID (estándar)
            const userDocSnap = await getDoc(doc(db, 'usuarios', uid));
            if (userDocSnap.exists()) {
                console.log(`[autenticarUsuario] Perfil encontrado por UID`);
                const userData = userDocSnap.data();
                // Verificar si el usuario fue eliminado (soft delete)
                if (userData.deletedAt) {
                    console.warn(`[autenticarUsuario] Usuario ${email} fue eliminado (deletedAt: ${userData.deletedAt}). Denegando login.`);
                    throw new Error("Esta cuenta ha sido eliminada. Contacta al administrador.");
                }
                return { id: uid, ...userData } as Usuario;
            }

            // 2. Intentar consulta por email (Más robusto)
            console.log(`[autenticarUsuario] Buscando por query de email: ${email}`);
            const q = query(collection(db, 'usuarios'), where('email', '==', email.toLowerCase().trim()));
            const qSnap = await getDocs(q);

            if (!qSnap.empty) {
                console.log(`[autenticarUsuario] Perfil encontrado por Query de Email`);
                const userData = qSnap.docs[0].data();
                // Verificar si el usuario fue eliminado (soft delete)
                if (userData.deletedAt) {
                    console.warn(`[autenticarUsuario] Usuario ${email} fue eliminado (deletedAt: ${userData.deletedAt}). Denegando login.`);
                    throw new Error("Esta cuenta ha sido eliminada. Contacta al administrador.");
                }
                return { id: qSnap.docs[0].id, ...userData } as Usuario;
            }

            // 3. RECUPERACIÓN PROACTIVA (Solo para Admins que vienen de Onboarding)
            // Solo intentamos esto si estamos SEGUROS de que la base de datos respondió que NO existe, 
            // no si hubo un error de red o bloqueo.
            if (uid.startsWith('tnt-')) {
                console.log(`[autenticarUsuario] Detectado UID tipo Tenant (${uid}). Intentando recuperación de perfil Admin...`);
                const fallbackUserData = {
                    nombreUsuario: email.split('@')[0].toUpperCase(),
                    email: email.toLowerCase().trim(),
                    numeroIdentificacion: 'PENDIENTE',
                    whatsapp: '3000000000',
                    rol: RolUsuario.Admin,
                    tenantId: uid,
                    sedeId: '',
                    fcmTokens: []
                };
                try {
                    await setDoc(doc(db, 'usuarios', uid), fallbackUserData);
                    console.log(`[autenticarUsuario] Perfil de emergencia creado para: ${uid}`);
                    return { id: uid, ...fallbackUserData } as Usuario;
                } catch (recoveryError) {
                    console.error("[autenticarUsuario] Error en auto-recuperación:", recoveryError);
                    // Si falla el setDoc, probablemente es un bloqueo real, no seguimos.
                }
            }
        } catch (dbError: any) {
            console.error("[autenticarUsuario] Error en consulta de base de datos:", dbError);
            // Si el error es de cuenta eliminada, propagar inmediatamente sin reintentos
            if (dbError?.message?.includes('cuenta ha sido eliminada')) {
                throw dbError;
            }
            if (dbError?.message?.includes('blocked-by-client') || dbError?.code === 'failed-precondition') {
                throw new Error("El acceso a la base de datos está siendo bloqueado por tu navegador (p.ej. Brave Shields o un AdBlocker). Por favor desactívalo para este sitio.");
            }
            // Si es otro error, esperamos y reintentamos
        }

        console.log(`[autenticarUsuario] Perfil no encontrado aún. Reintentando...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        intentos++;
    }

    console.error(`[autenticarUsuario] Error final: Imposible encontrar perfil para ${email} (UID: ${uid})`);
    throw new Error("Tu perfil no existe o no se ha sincronizado correctamente. Por favor, revisa tu conexión o contacta a soporte.");
};

const limpiarObjeto = (obj: any) => {
    const nuevo = { ...obj };
    Object.keys(nuevo).forEach(key => {
        if (nuevo[key] === undefined) delete nuevo[key];
    });
    return nuevo;
};

export const agregarUsuario = async (datos: any): Promise<Usuario> => {
    if (!isFirebaseConfigured) {
        const nuevo: UsuarioSimulado = {
            id: `user-${Date.now()}`,
            ...datos,
            contrato: {
                sueldoBase: datos.sueldoBase || 0,
                duracionMeses: datos.duracionContratoMeses || 0,
                tipoVinculacion: datos.tipoVinculacion || '',
                fechaInicio: datos.fechaInicio || '',
                lugarEjecucion: datos.lugarEjecucion || '',
                firmado: false
            }
        };
        usuariosMock.push(nuevo);
        const { contrasena: _, ...usuarioRetorno } = nuevo;
        return usuarioRetorno;
    }

    const auth = getAuth();

    // CRÍTICO: Guardar la sesión actual del admin ANTES de crear el nuevo usuario
    const currentUser = auth.currentUser;

    // Crear el nuevo usuario (esto automáticamente lo loguea)
    const userCredential = await createUserWithEmailAndPassword(auth, datos.email, datos.contrasena);

    const nuevoUsuarioData = {
        nombreUsuario: datos.nombreUsuario,
        email: datos.email,
        numeroIdentificacion: datos.numeroIdentificacion,
        whatsapp: datos.whatsapp,
        rol: datos.rol,
        tenantId: datos.tenantId,
        sedeId: datos.sedeId || '',
        contrato: {
            sueldoBase: datos.sueldoBase || 0,
            duracionMeses: datos.duracionContratoMeses || 0,
            tipoVinculacion: datos.tipoVinculacion || '',
            fechaInicio: datos.fechaInicio || '',
            lugarEjecucion: datos.lugarEjecucion || '',
            firmado: false
        },
        fcmTokens: []
    };

    await setDoc(doc(db, "usuarios", userCredential.user.uid), limpiarObjeto(nuevoUsuarioData));

    // CRÍTICO: Cerrar la sesión del usuario recién creado para evitar suplantación
    await auth.signOut();

    // CRÍTICO: Re-autenticar la sesión original del admin
    // Nota: Si el admin está usando un provider OAuth o similar, esto puede fallar
    // En producción, se debe usar Firebase Admin SDK desde el backend
    if (currentUser) {
        console.log('[agregarUsuario] Restaurando sesión original del admin');
        await auth.updateCurrentUser(currentUser);
    }

    return { id: userCredential.user.uid, ...nuevoUsuarioData } as Usuario;
};

export const cerrarSesion = async (): Promise<void> => {
    if (isFirebaseConfigured) await signOut(getAuth());
};

export const obtenerUsuarios = async (): Promise<Usuario[]> => {
    if (!isFirebaseConfigured) return usuariosMock.map(({ contrasena: _, ...u }) => u);
    const userSnapshot = await getDocs(collection(db, "usuarios"));
    // Filtrar usuarios que no tengan deletedAt (soft delete)
    return userSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Usuario))
        .filter(u => !u.deletedAt);
};

export const actualizarUsuario = async (datos: any, id: string): Promise<Usuario> => {
    if (!isFirebaseConfigured) {
        usuariosMock = usuariosMock.map(u => u.id === id ? { ...u, ...datos } : u);
        const encontrado = usuariosMock.find(u => u.id === id);
        if (!encontrado) throw new Error("Usuario no encontrado.");
        const { contrasena: _, ...retorno } = encontrado;
        return retorno;
    }

    // Si vienen campos de contrato, los anidamos correctamente
    const updateData: any = { ...datos };
    if (datos.sueldoBase !== undefined || datos.duracionContratoMeses !== undefined) {
        updateData.contrato = {
            ...(updateData.contrato || {}),
            sueldoBase: datos.sueldoBase,
            duracionMeses: datos.duracionContratoMeses,
            tipoVinculacion: datos.tipoVinculacion,
            fechaInicio: datos.fechaInicio,
            lugarEjecucion: datos.lugarEjecucion
        };
        // Limpiamos los campos planos para no duplicar en raíz
        delete updateData.sueldoBase;
        delete updateData.duracionContratoMeses;
        delete updateData.tipoVinculacion;
        delete updateData.fechaInicio;
        delete updateData.lugarEjecucion;
    }

    const userDocRef = doc(db, "usuarios", id);
    await updateDoc(userDocRef, limpiarObjeto(updateData));
    const updatedDoc = await getDoc(userDocRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as Usuario;
};

export const eliminarUsuario = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        usuariosMock = usuariosMock.filter(u => u.id !== id);
        console.log(`[usuariosApi] Usuario ${id} eliminado del mock local`);
        return;
    }
    if (!id) {
        throw new Error("ID de usuario inválido para eliminación");
    }
    try {
        // SOFT DELETE: Marcar como eliminado en lugar de borrar el documento
        // Esto evita que el AuthContext "reviva" el usuario al detectar UID tipo tenant
        const userDocRef = doc(db, "usuarios", id);
        await updateDoc(userDocRef, {
            deletedAt: new Date().toISOString()
        });
        console.log(`[usuariosApi] Usuario ${id} marcado como eliminado (soft delete)`);
    } catch (error) {
        console.error("[usuariosApi] Error al eliminar usuario de Firestore:", error);
        throw error;
    }
};

export const enviarCorreoRecuperacion = async (email: string): Promise<void> => {
    if (isFirebaseConfigured) await sendPasswordResetEmail(getAuth(), email);
};

export const guardarTokenNotificacionUsuario = async (idUsuario: string, token: string): Promise<void> => {
    if (isFirebaseConfigured) await updateDoc(doc(db, 'usuarios', idUsuario), { fcmTokens: arrayUnion(token) });
};
