// scripts/restaurar_usuario.cjs
// Script para restaurar un usuario eliminado (soft delete)
// Uso: node scripts/restaurar_usuario.cjs

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc, deleteField } = require('firebase/firestore');

// Configuración de Firebase (tomada de firebase/config.ts)
const firebaseConfig = {
    apiKey: "AIzaSyDqWGXzD5h1LqXbqrQRhO2WtWHztQqY-1I",
    authDomain: "tudojang.firebaseapp.com",
    projectId: "tudojang",
    storageBucket: "tudojang.appspot.com",
    messagingSenderId: "1071788485460",
    appId: "1:1071788485460:web:9e6e6e6e6e6e6e6e6e6e6e"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// UID del usuario a restaurar
const UID_USUARIO = 'tnt-1770725725846';
const EMAIL_USUARIO = 'gengepardo@gmail.com';

async function restaurarUsuario() {
    try {
        console.log(`[restaurar_usuario] Buscando usuario ${EMAIL_USUARIO} (UID: ${UID_USUARIO})...`);
        
        const userDocRef = doc(db, 'usuarios', UID_USUARIO);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            console.error(`[restaurar_usuario] ERROR: No existe documento con UID ${UID_USUARIO}`);
            process.exit(1);
        }
        
        const userData = userDocSnap.data();
        console.log(`[restaurar_usuario] Documento encontrado:`);
        console.log(`  - Email: ${userData.email}`);
        console.log(`  - Nombre: ${userData.nombreUsuario}`);
        console.log(`  - Rol: ${userData.rol}`);
        console.log(`  - deletedAt: ${userData.deletedAt || 'No tiene'}`);
        
        if (!userData.deletedAt) {
            console.log(`[restaurar_usuario] El usuario NO tiene campo deletedAt. No necesita restauración.`);
            process.exit(0);
        }
        
        console.log(`[restaurar_usuario] Restaurando usuario (eliminando campo deletedAt)...`);
        
        // Eliminar el campo deletedAt usando deleteField()
        await updateDoc(userDocRef, {
            deletedAt: deleteField()
        });
        
        console.log(`[restaurar_usuario] ✅ Usuario ${EMAIL_USUARIO} restaurado exitosamente!`);
        console.log(`[restaurar_usuario] El usuario ahora puede iniciar sesión normalmente.`);
        
        process.exit(0);
    } catch (error) {
        console.error(`[restaurar_usuario] ERROR:`, error);
        process.exit(1);
    }
}

restaurarUsuario();
