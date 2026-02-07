
const admin = require('firebase-admin');

// Si no hay app inicializada, intentamos inicializar con las credenciales por defecto de Firebase CLI
if (admin.apps.length === 0) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'tudojang'
        });
    } catch (e) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function listAndCleanup() {
    console.log('--- BUSCANDO TENANTS PARA LIMPIEZA ---');
    const tenantsSnapshot = await db.collection('tenants').get();
    const reservados = ['gajog', 'master', 'admin', 'aliant', 'tudojang', 'www', 'api', 'root', 'support'];

    let eliminados = 0;
    for (const doc of tenantsSnapshot.docs) {
        const data = doc.data();
        const slug = (data.slug || '').toLowerCase();

        if (!reservados.includes(slug) && slug !== '') {
            console.log(`🗑️ ELIMINANDO TENANT: ${slug} (${doc.id})`);
            await db.collection('tenants').doc(doc.id).delete();
            eliminados++;
        } else {
            console.log(`✅ MANTENIENDO TENANT: ${slug}`);
        }
    }
    console.log(`--- LIMPIEZA COMPLETADA. ${eliminados} tenants eliminados ---`);
}

listAndCleanup().catch(err => {
    console.error('Error detallado:', err);
});
