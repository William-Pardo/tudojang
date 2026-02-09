
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
    arrayUnion
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
    const userCredential = await signInWithEmailAndPassword(auth, email, contrasena);

    // Lógica de reintento para esperar al webhook si es necesario
    let intentos = 0;
    while (intentos < 5) {
        const userDocSnap = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
        if (userDocSnap.exists()) {
            return { id: userCredential.user.uid, ...userDocSnap.data() } as Usuario;
        }

        console.log(`Perfil no encontrado (intento ${intentos + 1}/5). Esperando al servidor...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
        intentos++;
    }

    throw new Error("Tu perfil se está creando. Por favor, intenta de nuevo en 10 segundos.");
};

export const agregarUsuario = async (datos: {
    email: string,
    nombreUsuario: string,
    numeroIdentificacion: string,
    whatsapp: string,
    contrasena: string,
    rol: RolUsuario,
    tenantId: string,
    sedeId?: string
}): Promise<Usuario> => {
    if (!isFirebaseConfigured) {
        const nuevo: UsuarioSimulado = {
            id: `user-${Date.now()}`,
            email: datos.email,
            nombreUsuario: datos.nombreUsuario,
            numeroIdentificacion: datos.numeroIdentificacion,
            whatsapp: datos.whatsapp,
            rol: datos.rol,
            tenantId: datos.tenantId,
            sedeId: datos.sedeId,
            contrasena: datos.contrasena
        };
        usuariosMock.push(nuevo);
        const { contrasena: _, ...usuarioRetorno } = nuevo;
        return usuarioRetorno;
    }

    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, datos.email, datos.contrasena);
    const nuevoUsuarioData = {
        nombreUsuario: datos.nombreUsuario,
        email: datos.email,
        numeroIdentificacion: datos.numeroIdentificacion,
        whatsapp: datos.whatsapp,
        rol: datos.rol,
        tenantId: datos.tenantId,
        sedeId: datos.sedeId || '',
        fcmTokens: []
    };
    await setDoc(doc(db, "usuarios", userCredential.user.uid), nuevoUsuarioData);
    return { id: userCredential.user.uid, ...nuevoUsuarioData };
};

export const cerrarSesion = async (): Promise<void> => {
    if (isFirebaseConfigured) await signOut(getAuth());
};

export const obtenerUsuarios = async (): Promise<Usuario[]> => {
    if (!isFirebaseConfigured) return usuariosMock.map(({ contrasena: _, ...u }) => u);
    const userSnapshot = await getDocs(collection(db, "usuarios"));
    return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario));
};

export const actualizarUsuario = async (datos: Partial<UsuarioSimulado>, id: string): Promise<Usuario> => {
    if (!isFirebaseConfigured) {
        usuariosMock = usuariosMock.map(u => u.id === id ? { ...u, ...datos } : u);
        const encontrado = usuariosMock.find(u => u.id === id);
        if (!encontrado) throw new Error("Usuario no encontrado.");
        const { contrasena: _, ...retorno } = encontrado;
        return retorno;
    }
    const userDocRef = doc(db, "usuarios", id);
    await updateDoc(userDocRef, datos);
    const updatedDoc = await getDoc(userDocRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as Usuario;
};

export const eliminarUsuario = async (id: string): Promise<void> => {
    if (!isFirebaseConfigured) {
        usuariosMock = usuariosMock.filter(u => u.id !== id);
        return;
    }
    await deleteDoc(doc(db, "usuarios", id));
};

export const enviarCorreoRecuperacion = async (email: string): Promise<void> => {
    if (isFirebaseConfigured) await sendPasswordResetEmail(getAuth(), email);
};

export const guardarTokenNotificacionUsuario = async (idUsuario: string, token: string): Promise<void> => {
    if (isFirebaseConfigured) await updateDoc(doc(db, 'usuarios', idUsuario), { fcmTokens: arrayUnion(token) });
};
