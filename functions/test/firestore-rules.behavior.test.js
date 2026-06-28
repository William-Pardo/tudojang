const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

const projectId = "demo-tudojang";
let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync(
        path.resolve(__dirname, "..", "..", "firestore.rules"),
        "utf8"
      ),
    },
  });
});

test.beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "tickets_soporte", "ticket-1"), {
      userId: "user-1",
      tenantId: "tenant-1",
      category: "estudiantes",
      summary: "Resumen mínimo",
      source: "local",
      status: "open",
    });
  });
});

test.after(async () => {
  await environment.cleanup();
});

const client = (uid, tenantId, rol, extraClaims = {}) =>
  environment.authenticatedContext(uid, { tenantId, rol, ...extraClaims }).firestore();

test("ticket owner in the same tenant can read the ticket", async () => {
  const snapshot = await assertSucceeds(
    getDoc(doc(client("user-1", "tenant-1", "Admin"), "tickets_soporte", "ticket-1"))
  );
  assert.equal(snapshot.data().summary, "Resumen mínimo");
});

test("another tenant cannot read or infer the ticket", async () => {
  await assertFails(
    getDoc(doc(client("user-2", "tenant-2", "Admin"), "tickets_soporte", "ticket-1"))
  );
});

test("SuperAdmin can read tickets across tenants", async () => {
  const snapshot = await assertSucceeds(
    getDoc(doc(client("master-1", "master", "SuperAdmin"), "tickets_soporte", "ticket-1"))
  );
  assert.equal(snapshot.data().tenantId, "tenant-1");
});

test("ordinary clients cannot create or update tickets", async () => {
  const db = client("user-1", "tenant-1", "Admin");
  await assertFails(
    setDoc(doc(db, "tickets_soporte", "ticket-2"), {
      userId: "user-1",
      tenantId: "tenant-1",
      summary: "Intento directo",
    })
  );
  await assertFails(
    updateDoc(doc(db, "tickets_soporte", "ticket-1"), {
      status: "resolved",
    })
  );
});

test("even SuperAdmin cannot mutate tickets directly from the client", async () => {
  await assertFails(
    updateDoc(
      doc(
        client("master-1", "master", "SuperAdmin"),
        "tickets_soporte",
        "ticket-1"
      ),
      { status: "resolved" }
    )
  );
});

test("clients cannot write quota documents", async () => {
  await assertFails(
    setDoc(
      doc(
        client("user-1", "tenant-1", "Admin"),
        "asistente_cuotas",
        "user__user-1__2026-06"
      ),
      { usedMicros: 0 }
    )
  );
});

test("student can write own academic progress on real progress path", async () => {
  const db = client("est-1", "tenant-1", "Estudiante");

  await assertSucceeds(
    setDoc(
      doc(db, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    )
  );
});

test("tutor cannot write student academic progress but can read it in same tenant", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "vinculos", "tutor@test.com_est-1"),
      {
        tenantId: "tenant-1",
        tutorEmail: "tutor@test.com",
        estudianteId: "est-1",
      }
    );
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    );
  });

  const tutorDb = client("tutor-1", "tenant-1", "Tutor", { email: "tutor@test.com" });

  const snapshot = await assertSucceeds(
    getDoc(doc(tutorDb, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"))
  );
  assert.deepEqual(snapshot.data().paginasVistas, [1, 2]);

  await assertFails(
    setDoc(
      doc(tutorDb, "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2, 3],
        segundosUnicos: [],
      }
    )
  );
});

test("unlinked tutor cannot read student academic progress", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "tenants", "tenant-1", "progreso", "est-1", "asignaciones", "asig-1"),
      {
        tenantId: "tenant-1",
        asignacionId: "asig-1",
        paginasVistas: [1, 2],
        segundosUnicos: [],
      }
    );
  });

  await assertFails(
    getDoc(
      doc(
        client("tutor-2", "tenant-1", "Tutor", { email: "otro@test.com" }),
        "tenants",
        "tenant-1",
        "progreso",
        "est-1",
        "asignaciones",
        "asig-1"
      )
    )
  );
});
