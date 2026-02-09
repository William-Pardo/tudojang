const admin = require('firebase-admin');
const serviceAccount = require('./gcp_key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function eliminarUsuario() {
    try {
        await admin.auth().deleteUser('CQ2DF0PexsUapRYpAXYjWusTLio2');
        console.log('Usuario CQ2DF0PexsUapRYpAXYjWusTLio2 eliminado exitosamente.');
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        process.exit(1);
    }
}

eliminarUsuario();
