// firebase/config.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfigString = process.env.FIREBASE_CONFIG;

// Soporte para variables individuales (útil en CI/CD como GitHub Actions)
const individualConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

let firebaseConfig;
export let isFirebaseConfigured = false;

// Intentar cargar por JSON string primero
if (firebaseConfigString && firebaseConfigString !== 'undefined' && firebaseConfigString.includes('{')) {
  try {
    firebaseConfig = JSON.parse(firebaseConfigString);
    isFirebaseConfigured = true;
  } catch (e) {
    console.error("Error al analizar FIREBASE_CONFIG JSON", e);
  }
}

// Si no se cargó por JSON, intentar por variables individuales
if (!isFirebaseConfigured && individualConfig.apiKey && individualConfig.apiKey !== 'undefined') {
  firebaseConfig = individualConfig;
  isFirebaseConfigured = true;
}

// Configuración de respaldo (Mock Mode)
if (!isFirebaseConfigured) {
  console.warn("ADVERTENCIA: La configuración de Firebase no está definida. Se utilizará una configuración de respaldo (MODO SIMULADO).");
  firebaseConfig = {
    apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "xxxxxxxx.firebaseapp.com",
    projectId: "xxxxxxxx",
    storageBucket: "xxxxxxxx.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
  };
}


// Inicializar Firebase
// Se utiliza una comprobación para evitar la reinicialización en entornos de hot-reload.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const messaging = isFirebaseConfigured ? getMessaging(app) : null;

export { app, db, auth, storage, messaging };