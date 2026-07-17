// Script de setup para Tutor test — ejecutable con node puro

const fs = require('fs');
const path = require('path');

// Configurar emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const firebase = require('firebase/app');
require('firebase/firestore');
require('firebase/auth');

const firebaseConfig = {
  apiKey: 'AIzaSyDummyForEmulator',
  authDomain: 'localhost:9099',
  projectId: 'demo-project',
  storageBucket: 'demo-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef1234567890',
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.getFirestore(app);
const auth = firebase.getAuth(app);

async function setupTutorTest() {
  console.log('🔧 Configurando datos de prueba para Tutor...\n');

  const tenantId = 'test-tenant-001';
  const tutorEmail = 'padre@test.com';
  const tutorPassword = 'password123';
  const estudianteEmail = 'hijo@test.com';
  const estudiantePassword = 'password123';
  const nombreEstudiante = 'Juan Pérez';

  try {
    // 1. Crear Tutor
    console.log('1️⃣  Creando Tutor...');
    let tutorUser;
    try {
      tutorUser = await firebase.auth(app).createUserWithEmailAndPassword(tutorEmail, tutorPassword);
      console.log(`   ✅ UID: ${tutorUser.user.uid}`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('   ⚠️  Tutor ya existe');
        tutorUser = await firebase.auth(app).signInWithEmailAndPassword(tutorEmail, tutorPassword);
      } else throw e;
    }

    // 2. Crear Estudiante
    console.log('\n2️⃣  Creando Estudiante...');
    let estudianteUser;
    try {
      estudianteUser = await firebase.auth(app).createUserWithEmailAndPassword(estudianteEmail, estudiantePassword);
      console.log(`   ✅ UID: ${estudianteUser.user.uid}`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('   ⚠️  Estudiante ya existe');
        estudianteUser = await firebase.auth(app).signInWithEmailAndPassword(estudianteEmail, estudiantePassword);
      } else throw e;
    }

    const tutorUid = tutorUser.user.uid;
    const estudianteUid = estudianteUser.user.uid;

    // 3. Documento Usuario Tutor
    console.log('\n3️⃣  Guardando Usuario Tutor...');
    await firebase.firestore(app).collection('usuarios').doc(tutorUid).set({
      id: tutorUid,
      email: tutorEmail,
      rol: 'Tutor',
      tenantId,
      nombre: 'Padre Test',
      apellido: 'Test',
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅');

    // 4. Documento Usuario Estudiante
    console.log('\n4️⃣  Guardando Usuario Estudiante...');
    await firebase.firestore(app).collection('usuarios').doc(estudianteUid).set({
      id: estudianteUid,
      email: estudianteEmail,
      rol: 'Estudiante',
      tenantId,
      nombre: 'Juan',
      apellido: 'Pérez',
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅');

    // 5. Documento Estudiante (académico)
    console.log('\n5️⃣  Guardando Estudiante (modelo académico)...');
    const estudianteDocId = `estudiante-${estudianteUid.substring(0, 8)}`;
    await firebase.firestore(app).collection('estudiantes').doc(estudianteDocId).set({
      id: estudianteDocId,
      tenantId,
      nombre: nombreEstudiante,
      email: estudianteEmail,
      rol: 'Estudiante',
      authUid: estudianteUid,
      estadoPago: 'al_dia',
      saldoDeudor: 0,
      historialPagos: [
        {
          fecha: new Date().toISOString().split('T')[0],
          cantidad: 50000,
          concepto: 'Mensualidad Julio',
          estado: 'pagado',
        },
      ],
    });
    console.log('   ✅');

    // 6. Vínculo Tutor↔Estudiante
    console.log('\n6️⃣  Creando vínculo...');
    const vinculoId = `${tutorEmail}_${estudianteDocId}`;
    await firebase.firestore(app).collection('tenants').doc(tenantId).collection('vinculos').doc(vinculoId).set({
      id: vinculoId,
      tutorEmail: tutorEmail.toLowerCase(),
      tutorId: tutorUid,
      estudianteId: estudianteDocId,
      studentAuthUid: estudianteUid,
      tenantId,
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅');

    // 7. Tenant
    console.log('\n7️⃣  Creando Tenant...');
    await firebase.firestore(app).collection('tenants').doc(tenantId).set({
      id: tenantId,
      nombre: 'Test Dojo',
      nombreCorto: 'TestDojo',
      email: 'admin@test.com',
      telefonoContacto: '+57 300 000 0000',
      ciudad: 'Bogotá',
      estado: 'activo',
    });
    console.log('   ✅');

    // 8. Asignación (materiales)
    console.log('\n8️⃣  Creando asignación de materiales...');
    const asignacionId = `asignacion-${Date.now()}`;
    await firebase.firestore(app).collection('tenants').doc(tenantId).collection('asignaciones').doc(asignacionId).set({
      id: asignacionId,
      tenantId,
      estudianteId: estudianteDocId,
      materialAsignado: ['Material Karate Básico', 'Video Técnica Punch'],
      fechaAsignacion: new Date().toISOString().split('T')[0],
      estado: 'activa',
    });
    console.log('   ✅');

    console.log('\n' + '='.repeat(70));
    console.log('✅ SETUP COMPLETADO — LISTO PARA TESTEAR');
    console.log('='.repeat(70));
    console.log('\n📱 CREDENCIALES TUTOR:');
    console.log(`   Email: ${tutorEmail}`);
    console.log(`   Password: ${tutorPassword}`);
    console.log(`\n🎯 FLUJO A TESTEAR:`);
    console.log(`   1. Ve a http://localhost:5173`);
    console.log(`   2. Loguea con las credenciales arriba`);
    console.log(`   3. Deberías ver:`);
    console.log(`      - /centro-estudios → "Materiales de ${nombreEstudiante}" + 2 materiales REALES`);
    console.log(`      - /mi-perfil → "Estado de Pago: Al día" (NO mock)`);
    console.log(`      - Console (F12) → LIMPIO (sin permission-denied)`);
    console.log('\n' + '='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupTutorTest();
