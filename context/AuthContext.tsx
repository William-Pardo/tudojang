
// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { getAuth, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { autenticarUsuario, cerrarSesion as apiCerrarSesion, enviarCorreoRecuperacion as apiEnviarCorreoRecuperacion } from '../servicios/api';
import type { Usuario } from '../tipos';

interface AuthContextType {
  usuario: Usuario | null;
  login: (email: string, contrasena: string) => Promise<void>;
  logout: () => void;
  enviarEnlaceRecuperacion: (email: string) => Promise<void>;
  error: string | null;
  isSubmitting: boolean;
  cargandoSesion: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Si no hay configuración de Firebase, no hacer nada con onAuthStateChanged
    if (!isFirebaseConfigured) {
      setCargandoSesion(false);
      return;
    }

    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Usuario ha iniciado sesión, obtener datos de Firestore
          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            // Verificar si el usuario fue eliminado (soft delete)
            if (userData.deletedAt) {
              console.warn(`[AuthContext] Usuario ${firebaseUser.email} fue eliminado (deletedAt: ${userData.deletedAt}). Cerrando sesión de Firebase Auth.`);
              // CRÍTICO: Cerrar sesión de Firebase Auth para evitar estado intermedio
              await signOut(getAuth());
              setUsuario(null);
              return;
            }
            setUsuario({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              ...userData
            } as Usuario);
          } else {
            // FALLBACK: Buscar por email si el UID falla
            console.log(`[AuthContext] UID ${firebaseUser.uid} no encontrado, intentando por email: ${firebaseUser.email}`);

            let qSnap;
            try {
              const q = query(collection(db, 'usuarios'), where('email', '==', firebaseUser.email?.toLowerCase().trim()));
              qSnap = await getDocs(q);
            } catch (queryError: any) {
              console.error("[AuthContext] Error al buscar por email:", queryError);
              // Si el query falla por bloqueo, no intentamos reparación
              if (queryError?.message?.includes('blocked-by-client')) return;
              throw queryError;
            }

            if (qSnap && !qSnap.empty) {
              const userData = qSnap.docs[0].data();
              console.log(`[AuthContext] Perfil recuperado por email query.`);
              // Verificar si el usuario fue eliminado (soft delete)
              if (userData.deletedAt) {
                console.warn(`[AuthContext] Usuario ${firebaseUser.email} fue eliminado (deletedAt: ${userData.deletedAt}). Cerrando sesión de Firebase Auth.`);
                // CRÍTICO: Cerrar sesión de Firebase Auth para evitar estado intermedio
                await signOut(getAuth());
                setUsuario(null);
                return;
              }
              setUsuario({
                id: qSnap.docs[0].id,
                email: firebaseUser.email!,
                ...userData
              } as Usuario);
            } else {
              // 3. RECUPERACIÓN PROACTIVA (Solo para Admins que vienen de Onboarding)
              if (firebaseUser.uid.startsWith('tnt-')) {
                console.log(`[AuthContext] Detectado UID tipo Tenant (${firebaseUser.uid}) sin perfil. Reparando...`);
                // Doble check: Asegurarnos de que no fue un error de red lo que dio "empty"
                const fallbackUserData = {
                  nombreUsuario: firebaseUser.email?.split('@')[0].toUpperCase() || 'ADMIN',
                  email: firebaseUser.email?.toLowerCase().trim() || '',
                  numeroIdentificacion: 'PENDIENTE',
                  whatsapp: '3000000000',
                  rol: 'Admin',
                  tenantId: firebaseUser.uid,
                  sedeId: '',
                  fcmTokens: []
                };
                try {
                  await setDoc(doc(db, 'usuarios', firebaseUser.uid), fallbackUserData);
                  setUsuario({ id: firebaseUser.uid, ...fallbackUserData } as Usuario);
                } catch (recoveryError) {
                  console.error("[AuthContext] Error en auto-recuperación:", recoveryError);
                  setUsuario(null);
                }
              } else {
                console.warn(`[AuthContext] No se encontró perfil para el usuario autenticado.`);
                setUsuario(null);
              }
            }
          }
        } catch (e: any) {
          console.error("[AuthContext] Error al obtener perfil de usuario:", e);
          if (e?.message?.includes('blocked-by-client')) {
            setError("Base de datos bloqueada por el navegador (Shields/AdBlock).");
          }
          setUsuario(null);
        }
      } else {
        // Usuario ha cerrado sesión
        setUsuario(null);
      }
      setCargandoSesion(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, contrasena: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await autenticarUsuario(email, contrasena);
      // **LA CORRECCIÓN CLAVE ESTÁ AQUÍ**
      // Se establece el usuario en el estado inmediatamente después de la autenticación.
      // Esto es crucial para el modo simulado, donde onAuthStateChanged no se activa.
      setUsuario(loggedInUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      setError(errorMessage);
      throw err; // Re-lanzar para que el formulario sepa que hubo un error.
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiCerrarSesion();
    setUsuario(null);
  }, []);

  const enviarEnlaceRecuperacion = useCallback(async (email: string) => {
    try {
      await apiEnviarCorreoRecuperacion(email);
    } catch (err) {
      throw err;
    }
  }, []);

  const value = { usuario, login, logout, enviarEnlaceRecuperacion, error, isSubmitting, cargandoSesion };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
