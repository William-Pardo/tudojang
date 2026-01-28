// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
            setUsuario({
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              nombreUsuario: userData.nombreUsuario,
              rol: userData.rol,
            });
          } else {
            // El perfil de usuario no existe, cerrar sesión
            await apiCerrarSesion();
            setUsuario(null);
          }
        } catch (e) {
            console.error("Error al obtener perfil de usuario:", e);
            await apiCerrarSesion();
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
