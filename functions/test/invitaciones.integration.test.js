// functions/test/invitaciones.integration.test.js
// Tests de integración para la Cloud Function inviteUser usando firebase-functions-test.

const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const projectId = "demo-tudojang";

// Configurar variables de entorno para que el SDK de Firebase se conecte a los emuladores
process.env.GCLOUD_PROJECT = projectId;
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}
process.env.APP_URL = "https://app.tudojang.com";
process.env.RESEND_API_KEY = "re_test_key";

// Interceptar y mockear el módulo de correo antes de que index.js lo requiera
const emailModule = require("../email");
const sentEmails = [];
emailModule.enviarCorreo = async (resend, message) => {
  sentEmails.push(message);
  return "mock-email-id-123";
};

// Requerir index.js para exportar las funciones e inicializar el SDK de Admin por defecto
const myFunctions = require("../index.js");

// Inicializar firebase-functions-test en modo offline para obtener la función wrap
const testEnv = require("firebase-functions-test")();
const wrappedInviteUser = testEnv.wrap(myFunctions.inviteUser);
const wrappedAcceptInvitation = testEnv.wrap(myFunctions.acceptInvitation);

test.beforeEach(async () => {
  sentEmails.length = 0; // Limpiar historial de correos enviados

  // Limpiar base de datos del emulador de Firestore
  const firestoreRes = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  assert.equal(firestoreRes.ok, true);

  // Limpiar usuarios del emulador de Auth
  const authRes = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`,
    {
      method: "DELETE",
      headers: {
        Authorization: "Bearer owner",
      },
    }
  );
  assert.equal(authRes.ok, true);
});

test.after(async () => {
  testEnv.cleanup();
});

test("inviteUser: lanza error si no hay autenticación", async () => {
  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email: "estudiante@example.com", rol: "Estudiante", tenantId: "tenant-1" },
        {} // Contexto de autenticación vacío
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: lanza error si el rol del invocador no es Admin o SuperAdmin", async () => {
  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email: "estudiante@example.com", rol: "Estudiante", tenantId: "tenant-1" },
        {
          auth: {
            uid: "caller-uid",
            token: {
              rol: "Profesor", // Rol no autorizado
              tenantId: "tenant-1",
            },
          },
        }
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: lanza error si el tenantId no coincide con el del invocador", async () => {
  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email: "estudiante@example.com", rol: "Estudiante", tenantId: "tenant-2" }, // tenantId diferente
        {
          auth: {
            uid: "caller-uid",
            token: {
              rol: "Admin",
              tenantId: "tenant-1",
            },
          },
        }
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: lanza error si el rol invitado es inválido", async () => {
  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email: "estudiante@example.com", rol: "Admin", tenantId: "tenant-1" }, // Admin no es un rol académico válido de invitación
        {
          auth: {
            uid: "caller-uid",
            token: {
              rol: "Admin",
              tenantId: "tenant-1",
            },
          },
        }
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: lanza error si el email es inválido", async () => {
  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email: "email-invalido", rol: "Estudiante", tenantId: "tenant-1" },
        {
          auth: {
            uid: "caller-uid",
            token: {
              rol: "Admin",
              tenantId: "tenant-1",
            },
          },
        }
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: lanza error si el usuario ya existe en Firebase Auth", async () => {
  const email = "existente@example.com";
  // Crear usuario en el emulador de Auth
  await admin.auth().createUser({
    email,
    password: "password123",
  });

  await assert.rejects(
    async () => {
      await wrappedInviteUser(
        { email, rol: "Estudiante", tenantId: "tenant-1" },
        {
          auth: {
            uid: "caller-uid",
            token: {
              rol: "Admin",
              tenantId: "tenant-1",
            },
          },
        }
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("inviteUser: crea invitación, envía correo y guarda en Firestore (Estudiante)", async () => {
  const email = "estudiante@example.com";
  const tenantId = "tenant-1";
  const rol = "Estudiante";

  const result = await wrappedInviteUser(
    { email, rol, tenantId },
    {
      auth: {
        uid: "admin-uid",
        token: {
          rol: "Admin",
          tenantId,
        },
      },
    }
  );

  assert.equal(result.ok, true);
  assert.ok(result.invitacionId);
  assert.ok(result.expiraEn);

  // Verificar que el documento exista en Firestore
  const db = admin.firestore();
  const docRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(result.invitacionId);
  const docSnap = await docRef.get();

  assert.equal(docSnap.exists, true);
  const data = docSnap.data();
  assert.equal(data.email, email);
  assert.equal(data.rol, rol);
  assert.equal(data.tenantId, tenantId);
  assert.equal(data.estado, "pendiente");
  assert.equal(data.creadoPor, "admin-uid");
  assert.ok(data.creadoEn);
  assert.ok(data.expiraEn);
  assert.ok(data.actionLink);

  // Verificar que se haya enviado el correo con los detalles correctos
  assert.equal(sentEmails.length, 1);
  const emailMsg = sentEmails[0];
  assert.deepEqual(emailMsg.to, [email]);
  assert.match(emailMsg.subject, /cuenta de estudiante está lista/);
  assert.match(emailMsg.html, /Activar mi cuenta/);
  assert.match(emailMsg.html, new RegExp(data.actionLink));
});

test("inviteUser: crea invitación y envía correo correcto para Tutor", async () => {
  const email = "tutor@example.com";
  const tenantId = "tenant-1";
  const rol = "Tutor";

  const result = await wrappedInviteUser(
    { email, rol, tenantId },
    {
      auth: {
        uid: "admin-uid",
        token: {
          rol: "Admin",
          tenantId,
        },
      },
    }
  );

  assert.equal(result.ok, true);
  assert.ok(result.invitacionId);

  // Verificar documento en Firestore
  const db = admin.firestore();
  const docSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(result.invitacionId)
    .get();
  assert.equal(docSnap.exists, true);
  const data = docSnap.data();
  assert.equal(data.rol, rol);

  // Verificar correo del Tutor
  assert.equal(sentEmails.length, 1);
  const emailMsg = sentEmails[0];
  assert.deepEqual(emailMsg.to, [email]);
  assert.match(emailMsg.subject, /portal de seguimiento de tu estudiante/);
});

test("acceptInvitation: lanza error si faltan parámetros requeridos", async () => {
  await assert.rejects(
    async () => {
      await wrappedAcceptInvitation({}, {});
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("acceptInvitation: lanza error si la contraseña tiene menos de 8 caracteres", async () => {
  await assert.rejects(
    async () => {
      await wrappedAcceptInvitation(
        { invitacionId: "inv-123", tenantId: "tenant-abc", password: "corta" },
        {}
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("acceptInvitation: lanza error si la invitación no existe en Firestore", async () => {
  await assert.rejects(
    async () => {
      await wrappedAcceptInvitation(
        { invitacionId: "inv-no-existente", tenantId: "tenant-abc", password: "password123" },
        {}
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("acceptInvitation: lanza error si la invitación ya fue aceptada", async () => {
  const db = admin.firestore();
  const tenantId = "tenant-abc";
  const invitacionId = "inv-aceptada";

  // Crear invitación en Firestore en estado 'aceptada'
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .set({
      id: invitacionId,
      email: "estudiante@example.com",
      rol: "Estudiante",
      tenantId,
      estado: "aceptada",
      expiraEn: new Date(Date.now() + 86400000).toISOString(),
    });

  await assert.rejects(
    async () => {
      await wrappedAcceptInvitation(
        { invitacionId, tenantId, password: "password123" },
        {}
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );
});

test("acceptInvitation: lanza error y marca como vencida si la invitación expiró", async () => {
  const db = admin.firestore();
  const tenantId = "tenant-abc";
  const invitacionId = "inv-vencida";
  const pastDate = new Date(Date.now() - 3600000).toISOString(); // expiró hace 1 hora

  // Crear invitación pendiente pero ya expirada
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .set({
      id: invitacionId,
      email: "estudiante@example.com",
      rol: "Estudiante",
      tenantId,
      estado: "pendiente",
      expiraEn: pastDate,
    });

  await assert.rejects(
    async () => {
      await wrappedAcceptInvitation(
        { invitacionId, tenantId, password: "password123" },
        {}
      );
    },
    (err) => {
      assert.equal(err.code, "internal");
      assert.match(err.message, /No fue posible/);
      return true;
    }
  );

  // Verificar que el estado de la invitación se actualizó a 'vencida' en Firestore
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .get();
  
  assert.equal(snap.exists, true);
  assert.equal(snap.data().estado, "vencida");
});

test("acceptInvitation: acepta correctamente para un usuario nuevo en Firebase Auth", async () => {
  const db = admin.firestore();
  const tenantId = "tenant-abc";
  const invitacionId = "inv-valida-estudiante";
  const email = "estudiante-nuevo@example.com";
  const rol = "Estudiante";

  // Crear una invitación válida y pendiente
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .set({
      id: invitacionId,
      email,
      rol,
      tenantId,
      estado: "pendiente",
      expiraEn: new Date(Date.now() + 86400000).toISOString(),
    });

  const result = await wrappedAcceptInvitation(
    { invitacionId, tenantId, password: "password123" },
    {}
  );

  assert.equal(result.ok, true);
  assert.ok(result.uid);

  // 1. Verificar que el usuario se haya creado en Firebase Auth
  const authUser = await admin.auth().getUser(result.uid);
  assert.equal(authUser.email, email);
  assert.equal(authUser.emailVerified, true);

  // 2. Verificar los custom claims asignados
  assert.deepEqual(authUser.customClaims, {
    rol,
    tenantId,
  });

  // 3. Verificar el documento del usuario en la colección `usuarios` de Firestore
  const userSnap = await db.collection("usuarios").doc(result.uid).get();
  assert.equal(userSnap.exists, true);
  const userData = userSnap.data();
  assert.equal(userData.id, result.uid);
  assert.equal(userData.email, email);
  assert.equal(userData.rol, rol);
  assert.equal(userData.tenantId, tenantId);
  assert.equal(userData.creadoDesdeInvitacion, invitacionId);
  assert.ok(userData.creadoEn);

  // 4. Verificar que la invitación fue marcada como aceptada
  const invSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .get();
  
  assert.equal(invSnap.exists, true);
  const invData = invSnap.data();
  assert.equal(invData.estado, "aceptada");
  assert.equal(invData.uid, result.uid);
  assert.ok(invData.aceptadaEn);
});

test("acceptInvitation: acepta correctamente para un usuario que ya existía en Firebase Auth", async () => {
  const db = admin.firestore();
  const tenantId = "tenant-abc";
  const invitacionId = "inv-valida-tutor";
  const email = "tutor-existente@example.com";
  const rol = "Tutor";

  // Pre-crear el usuario en Firebase Auth sin claims
  const preUser = await admin.auth().createUser({
    email,
    password: "passwordPrevia",
  });

  // Crear invitación válida pendiente
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .set({
      id: invitacionId,
      email,
      rol,
      tenantId,
      estado: "pendiente",
      expiraEn: new Date(Date.now() + 86400000).toISOString(),
    });

  const result = await wrappedAcceptInvitation(
    { invitacionId, tenantId, password: "passwordNuevaValida" },
    {}
  );

  assert.equal(result.ok, true);
  assert.equal(result.uid, preUser.uid);

  // 1. Verificar custom claims del usuario existente
  const authUser = await admin.auth().getUser(result.uid);
  assert.deepEqual(authUser.customClaims, {
    rol,
    tenantId,
  });

  // 2. Verificar documento en usuarios
  const userSnap = await db.collection("usuarios").doc(result.uid).get();
  assert.equal(userSnap.exists, true);
  assert.equal(userSnap.data().rol, rol);

  // 3. Verificar estado de la invitación
  const invSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invitaciones")
    .doc(invitacionId)
    .get();
  assert.equal(invSnap.data().estado, "aceptada");
});
