/**
 * Script para setup automático de datos de prueba: Tutor + Estudiante + vínculo
 *
 * USO:
 * 1. Levantá emulator: firebase emulators:start --only firestore
 * 2. Correlo: npx ts-node scripts/setup-tutor-test.ts
 * 3. Loguea en http://localhost:5173 con:
 *    - Tutor: padre@test.com / password123
 *    - Estudiante: hijo@test.com / password123
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDummyForEmulator',
  authDomain: 'localhost:9099',
  projectId: 'demo-project',
  storageBucket: 'demo-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef1234567890',
};

// Conectar al emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function setupTutorTest() {
  console.log('🔧 Configurando datos de prueba para Tutor...\n');

  const tenantId = 'test-tenant-001';
  const tutorEmail = 'padre@test.com';
  const tutorPassword = 'password123';
  const estudianteEmail = 'hijo@test.com';
  const estudiantePassword = 'password123';
  const nombreEstudiante = 'Juan Pérez';

  try {
    // 1. Crear Tutor en Auth
    console.log('1️⃣  Creando cuenta Tutor...');
    let tutorUser;
    try {
      tutorUser = await createUserWithEmailAndPassword(auth, tutorEmail, tutorPassword);
      console.log(`   ✅ Tutor creado: ${tutorUser.user.uid}`);
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('   ⚠️  Tutor ya existe, usando existente');
        const signIn = await signInWithEmailAndPassword(auth, tutorEmail, tutorPassword);
        tutorUser = signIn;
      } else throw e;
    }

    // 2. Crear Estudiante en Auth
    console.log('\n2️⃣  Creando cuenta Estudiante...');
    let estudianteUser;
    try {
      estudianteUser = await createUserWithEmailAndPassword(auth, estudianteEmail, estudiantePassword);
      console.log(`   ✅ Estudiante creado: ${estudianteUser.user.uid}`);
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('   ⚠️  Estudiante ya existe, usando existente');
        const signIn = await signInWithEmailAndPassword(auth, estudianteEmail, estudiantePassword);
        estudianteUser = signIn;
      } else throw e;
    }

    const tutorUid = tutorUser.user.uid;
    const estudianteUid = estudianteUser.user.uid;

    // 3. Crear documento Usuario para Tutor
    console.log('\n3️⃣  Creando doc Usuario para Tutor...');
    await setDoc(doc(db, 'usuarios', tutorUid), {
      id: tutorUid,
      email: tutorEmail,
      rol: 'Tutor',
      tenantId,
      nombre: 'Padre Test',
      apellido: 'Test',
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅ Usuario Tutor guardado');

    // 4. Crear documento Usuario para Estudiante
    console.log('\n4️⃣  Creando doc Usuario para Estudiante...');
    await setDoc(doc(db, 'usuarios', estudianteUid), {
      id: estudianteUid,
      email: estudianteEmail,
      rol: 'Estudiante',
      tenantId,
      nombre: 'Juan',
      apellido: 'Pérez',
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅ Usuario Estudiante guardado');

    // 5. Crear documento Estudiante (modelo académico)
    console.log('\n5️⃣  Creando doc Estudiante (modelo académico)...');
    const estudianteDocId = `estudiante-${estudianteUid.substring(0, 8)}`;
    await setDoc(doc(db, 'estudiantes', estudianteDocId), {
      id: estudianteDocId,
      tenantId,
      nombre: nombreEstudiante,
      email: estudianteEmail,
      rol: 'Estudiante',
      authUid: estudianteUid, // ✨ CRÍTICO: authUid sincronizado
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
    console.log('   ✅ Estudiante académico guardado');

    // 6. Crear vínculo Tutor→Estudiante
    console.log('\n6️⃣  Creando vínculo Tutor↔Estudiante...');
    const vinculoId = `${tutorEmail}_${estudianteDocId}`;
    await setDoc(doc(db, 'tenants', tenantId, 'vinculos', vinculoId), {
      id: vinculoId,
      tutorEmail: tutorEmail.toLowerCase(),
      tutorId: tutorUid,
      estudianteId: estudianteDocId,
      studentAuthUid: estudianteUid, // ✨ CRÍTICO: para Firestore rules
      tenantId,
      creadoEn: new Date().toISOString(),
    });
    console.log('   ✅ Vínculo creado');

    // 7. Crear Tenant
    console.log('\n7️⃣  Creando Tenant...');
    await setDoc(doc(db, 'tenants', tenantId), {
      id: tenantId,
      nombre: 'Test Dojo',
      nombreCorto: 'TestDojo',
      email: 'admin@test.com',
      telefonoContacto: '+57 300 000 0000',
      ciudad: 'Bogotá',
      estado: 'activo',
    });
    console.log('   ✅ Tenant creado');

    // 8. Crear una asignación de prueba (materiales)
    console.log('\n8️⃣  Creando asignación de materiales...');
    const asignacionId = `asignacion-${Date.now()}`;
    await setDoc(doc(db, 'tenants', tenantId, 'asignaciones', asignacionId), {
      id: asignacionId,
      tenantId,
      estudianteId: estudianteDocId,
      materialAsignado: ['Material Karate Básico', 'Video Técnica Punch'],
      fechaAsignacion: new Date().toISOString().split('T')[0],
      estado: 'activa',
    });
    console.log('   ✅ Asignación creada');

    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETADO — LISTO PARA TESTEAR');
    console.log('='.repeat(60));
    console.log('\n📱 CREDENCIALES TUTOR:');
    console.log(`   Email: ${tutorEmail}`);
    console.log(`   Password: ${tutorPassword}`);
    console.log(`\n🧒 CREDENCIALES ESTUDIANTE:`);
    console.log(`   Email: ${estudianteEmail}`);
    console.log(`   Password: ${estudiantePassword}`);
    console.log(`\n🎯 FLUJO A TESTEAR:`);
    console.log(`   1. Navega a http://localhost:5173`);
    console.log(`   2. Loguea como TUTOR (${tutorEmail})`);
    console.log(`   3. Deberías ver:`);
    console.log(`      - /centro-estudios → "Materiales de ${nombreEstudiante}" con 2 materiales REALES`);
    console.log(`      - /mi-perfil → "Estado de Pago del Estudiante" → "Al día" (no mock)`);
    console.log(`      - Sidebar sin /estudiantes, /eventos, /tienda (bloqueadas para Tutor)`);
    console.log(`      - Console limpia (sin permission-denied errors)`);
    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupTutorTest().then(() => process.exit(0));
