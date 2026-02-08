// Script temporal para verificar el estado del registro
const admin = require('firebase-admin');

// Inicializar Firebase Admin (usa las credenciales del proyecto)
admin.initializeApp();
const db = admin.firestore();

async function verificarRegistro() {
    const email = 'gengepardo@gmail.com';

    console.log('\n🔍 VERIFICANDO REGISTRO PARA:', email);
    console.log('='.repeat(60));

    try {
        // 1. Verificar usuario en Auth
        console.log('\n1️⃣ VERIFICANDO FIREBASE AUTH...');
        let userAuth;
        try {
            userAuth = await admin.auth().getUserByEmail(email);
            console.log('✅ Usuario encontrado en Auth:');
            console.log('   - UID:', userAuth.uid);
            console.log('   - Email:', userAuth.email);
            console.log('   - Creado:', new Date(userAuth.metadata.creationTime).toLocaleString());
        } catch (e) {
            console.log('❌ Usuario NO encontrado en Auth');
            return;
        }

        // 2. Verificar documento en colección 'usuarios'
        console.log('\n2️⃣ VERIFICANDO COLECCIÓN "usuarios"...');
        const usuarioDoc = await db.collection('usuarios').doc(userAuth.uid).get();
        if (usuarioDoc.exists) {
            const userData = usuarioDoc.data();
            console.log('✅ Documento encontrado:');
            console.log('   - Nombre:', userData.nombreUsuario);
            console.log('   - Rol:', userData.rol);
            console.log('   - TenantID:', userData.tenantId || '❌ NO ASIGNADO');
            console.log('   - SedeID:', userData.sedeId || 'N/A');
        } else {
            console.log('❌ NO existe documento en colección "usuarios"');
        }

        // 3. Buscar tenants asociados al email
        console.log('\n3️⃣ BUSCANDO TENANTS CON ESTE EMAIL...');
        const tenantsSnapshot = await db.collection('tenants')
            .where('emailClub', '==', email)
            .get();

        if (tenantsSnapshot.empty) {
            console.log('❌ NO se encontraron tenants con este email');
        } else {
            console.log(`✅ Se encontraron ${tenantsSnapshot.size} tenant(s):`);
            tenantsSnapshot.forEach(doc => {
                const data = doc.data();
                console.log('\n   📋 Tenant ID:', doc.id);
                console.log('      - Nombre:', data.nombreClub || 'N/A');
                console.log('      - Slug:', data.slug || 'N/A');
                console.log('      - Plan:', data.plan || 'N/A');
                console.log('      - Estado:', data.estadoSuscripcion || 'N/A');
                console.log('      - Creado:', data.fechaCreacion || 'N/A');
            });
        }

        // 4. Diagnóstico final
        console.log('\n' + '='.repeat(60));
        console.log('📊 DIAGNÓSTICO:');
        if (usuarioDoc.exists && tenantsSnapshot.size > 0) {
            const userData = usuarioDoc.data();
            const tenantId = tenantsSnapshot.docs[0].id;

            if (userData.tenantId === tenantId) {
                console.log('✅ TODO CORRECTO: Usuario vinculado al tenant');
            } else {
                console.log('⚠️ PROBLEMA: Usuario NO vinculado al tenant');
                console.log('   - TenantID esperado:', tenantId);
                console.log('   - TenantID actual:', userData.tenantId || 'null');
                console.log('\n💡 SOLUCIÓN: Ejecutar script de reparación');
            }
        } else {
            console.log('❌ REGISTRO INCOMPLETO');
            if (!usuarioDoc.exists) console.log('   - Falta documento en "usuarios"');
            if (tenantsSnapshot.empty) console.log('   - Falta tenant');
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    process.exit(0);
}

verificarRegistro();
