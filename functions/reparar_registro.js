// Script de reparación: Crea el usuario y lo vincula al tenant existente
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function repararRegistro() {
    const email = 'gengepardo@gmail.com';
    const password = 'Cambiar123';

    console.log('\n🔧 INICIANDO REPARACIÓN PARA:', email);
    console.log('='.repeat(60));

    try {
        // 1. Buscar tenant existente
        console.log('\n1️⃣ Buscando tenant existente...');
        const tenantsSnapshot = await db.collection('tenants')
            .where('emailClub', '==', email)
            .get();

        if (tenantsSnapshot.empty) {
            console.log('❌ NO hay tenants para este email. Debes registrarte de nuevo.');
            process.exit(1);
        }

        const tenantDoc = tenantsSnapshot.docs[0];
        const tenantData = tenantDoc.data();
        const tenantId = tenantDoc.id;

        console.log('✅ Tenant encontrado:');
        console.log('   - ID:', tenantId);
        console.log('   - Nombre:', tenantData.nombreClub);
        console.log('   - Slug:', tenantData.slug);

        // 2. Crear usuario en Auth
        console.log('\n2️⃣ Creando usuario en Firebase Auth...');
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: tenantData.representanteLegal || 'Director',
                disabled: false
            });
            console.log('✅ Usuario creado en Auth:');
            console.log('   - UID:', userRecord.uid);
        } catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                console.log('⚠️ Usuario ya existe en Auth, obteniendo datos...');
                userRecord = await admin.auth().getUserByEmail(email);
                console.log('   - UID:', userRecord.uid);
            } else {
                throw authError;
            }
        }

        // 3. Crear/Actualizar documento en colección 'usuarios'
        console.log('\n3️⃣ Creando documento en colección "usuarios"...');
        await db.collection('usuarios').doc(userRecord.uid).set({
            tenantId: tenantId,
            nombreUsuario: tenantData.representanteLegal || 'Director',
            email: email,
            rol: 'Admin',
            whatsapp: tenantData.pagoNequi || '',
            numeroIdentificacion: tenantData.ccRepresentante || '00000000',
            sedeId: 'sede-principal',
            fcmTokens: [],
            requiereCambioPassword: true
        });
        console.log('✅ Documento creado/actualizado');

        // 4. Verificación final
        console.log('\n4️⃣ Verificando reparación...');
        const usuarioDoc = await db.collection('usuarios').doc(userRecord.uid).get();
        const userData = usuarioDoc.data();

        console.log('\n' + '='.repeat(60));
        console.log('✅ REPARACIÓN COMPLETADA CON ÉXITO');
        console.log('='.repeat(60));
        console.log('\n📋 DATOS DE ACCESO:');
        console.log('   - Email:', email);
        console.log('   - Contraseña:', password);
        console.log('   - Slug:', tenantData.slug);
        console.log('   - TenantID:', userData.tenantId);
        console.log('\n🚀 AHORA PUEDES:');
        console.log('   1. Ir a: https://tudojang.web.app/#/login');
        console.log('   2. Ingresar con el email y contraseña de arriba');
        console.log('   3. Acceder a todas las secciones del dashboard');
        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ ERROR EN REPARACIÓN:', error.message);
        console.error(error);
    }

    process.exit(0);
}

repararRegistro();
