// firebase/config.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfigString = process.env.FIREBASE_CONFIG;

let firebaseConfig;
export let isFirebaseConfigured = false;

if (firebaseConfigString && firebaseConfigString !== 'undefined' && firebaseConfigString !== '{"apiKey":"xxxxxxxxxxxxxxxxxxxxxxxxxx","authDomain":"xxxxxxxx.firebaseapp.com","projectId":"xxxxxxxx","storageBucket":"xxxxxxxx.appspot.com","messagingSenderId":"000000000000","appId":"1:000000000000:web:0000000000000000000000"}') {
  try {
    // Intenta analizar la configuración del entorno.
    firebaseConfig = JSON.parse(firebaseConfigString);
    isFirebaseConfigured = true;
  } catch (e) {
    console.error("Error al analizar la variable de entorno FIREBASE_CONFIG. Asegúrese de que sea un JSON válido. Se utilizará una configuración de respaldo.", e);
    // Usar placeholders si la variable está mal formada
    firebaseConfig = {
      apiKey: "invalid-config",
      authDomain: "invalid-config",
      projectId: "invalid-config",
      storageBucket: "invalid-config",
      messagingSenderId: "invalid-config",
      appId: "invalid-config"
    };
    isFirebaseConfigured = false;
  }
} else {
  // Si la variable de entorno no está definida, se usa una configuración de respaldo
  // para permitir que la aplicación se cargue sin errores.
  if (!firebaseConfigString || firebaseConfigString === 'undefined') {
      console.warn("ADVERTENCIA: La configuración de Firebase no está definida. Se utilizará una configuración de respaldo. La aplicación no se conectará a los servicios de Firebase hasta que se proporcione una configuración válida.");
  }
  firebaseConfig = {
      apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxx",
      authDomain: "xxxxxxxx.firebaseapp.com",
      projectId: "xxxxxxxx",
      storageBucket: "xxxxxxxx.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000"
  };
  isFirebaseConfigured = false;
}


// Inicializar Firebase
// Se utiliza una comprobación para evitar la reinicialización en entornos de hot-reload.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const messaging = isFirebaseConfigured ? getMessaging(app) : null;

export { app, db, auth, storage, messaging };