// src/config.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyArURNdvpmVeUC9bJRIYsbGSkURK4ZEbvY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tudojang.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tudojang",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tudojang.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "545628702717",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:545628702717:web:c3052e06fb89585fa7fb94"
};

export const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== 'xxxxxxxxxxxxxxxxxxxxxxxxxx';

if (!isFirebaseConfigured) {
    console.warn("ADVERTENCIA: La configuración de Firebase no está definida o usa valores de ejemplo. La aplicación no se conectará a los servicios de Firebase correctamente.");
}

// Inicializar Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const messaging = isFirebaseConfigured ? getMessaging(app) : null;

export const wompiConfig = {
    publicKey: import.meta.env.VITE_WOMPI_PUBLIC_KEY || 'pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB',
    integritySecret: import.meta.env.VITE_WOMPI_INTEGRITY_SECRET || 'prod_integrity_K0vlATDmQxX3kY6aN7UmaBOYkwBrLVFm',
};

export { app, db, auth, storage, messaging };
