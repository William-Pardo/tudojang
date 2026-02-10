const admin = require('firebase-admin');
const serviceAccount = require('./gcp_key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function limpiarUsuariosTest() {
    console.log('Iniciando limpieza de usuarios de prueba (test-*)...');
    let nextPageToken;
    let count = 0;

    do {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
        const testUsers = listUsersResult.users.filter(user => user.email && user.email.startsWith('test-'));

        for (const user of testUsers) {
            try {
                // 1. Eliminar de Authentication
                await admin.auth().deleteUser(user.uid);
                console.log(`[AUTH] Usuario eliminado: ${user.email} (${user.uid})`);

                // 2. Eliminar de Firestore (Usuarios)
                await admin.firestore().collection('usuarios').doc(user.uid).delete();
                console.log(`[DB]   Doc Usuario eliminado`);

                // 3. Eliminar Tenant asociado (Buscar por email)
                const tenantsSnapshot = await admin.firestore().collection('tenants')
                    .where('emailClub', '==', user.email)
                    .get();

                if (!tenantsSnapshot.empty) {
                    const batch = admin.firestore().batch();
                    tenantsSnapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                        console.log(`[DB]   Tenant eliminado: ${doc.id}`);
                    });
                    await batch.commit();
                }

                count++;
            } catch (error) {
                console.error(`Error eliminando ${user.email}:`, error.message);
            }
        }
        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`\nLimpieza completada. Total eliminados: ${count}`);
    process.exit(0);
}

limpiarUsuariosTest();
