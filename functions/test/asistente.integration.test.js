const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const {
  crearAlmacenCuotasFirestore,
  reservarCuota,
  reconciliarCuota,
} = require("../asistente/cuotas");
const {
  obtenerIdentidadConfiable,
  validarSolicitudAsistente,
} = require("../asistente/autorizacion");

const projectId = "demo-tudojang";
const app = admin.initializeApp({ projectId }, "assistant-integration");
const db = app.firestore();

test.beforeEach(async () => {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  assert.equal(response.ok, true);
});

test.after(async () => {
  await app.delete();
});

test("trusted callable context ignores tenant and role supplied by client", () => {
  const identity = obtenerIdentidadConfiable(
    {
      auth: {
        uid: "user-1",
        token: { tenantId: "tenant-trusted", rol: "Admin" },
      },
      app: { appId: "app-check-valid" },
    },
    { tenantId: "tenant-attacker", rol: "SuperAdmin" }
  );

  assert.deepEqual(identity, {
    uid: "user-1",
    tenantId: "tenant-trusted",
    rol: "Admin",
  });
});

test("callable integration rejects missing Firebase Auth context", () => {
  assert.throws(
    () => validarSolicitudAsistente({ app: { appId: "app-check-valid" } }),
    (error) => error.code === "unauthenticated"
  );
});

test("callable integration rejects missing App Check context", () => {
  assert.throws(
    () =>
      validarSolicitudAsistente({
        auth: {
          uid: "user-1",
          token: { tenantId: "tenant-1", rol: "Admin" },
        },
      }),
    (error) => error.code === "failed-precondition"
  );
});

test("Firestore transactions never exceed user, tenant or global quotas", async () => {
  const store = crearAlmacenCuotasFirestore(db);
  const request = {
    uid: "user-1",
    tenantId: "tenant-1",
    period: "2026-06",
    estimatedMicros: 700,
    limits: { user: 2_000, tenant: 3_000, global: 4_000 },
  };

  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => reservarCuota(store, request))
  );

  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    2
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    3
  );

  const userDoc = await db.doc("asistente_cuotas/user__user-1__2026-06").get();
  const tenantDoc = await db.doc("asistente_cuotas/tenant__tenant-1__2026-06").get();
  const globalDoc = await db.doc("asistente_cuotas/global__2026-06").get();

  assert.equal(userDoc.data().usedMicros, 1_400);
  assert.equal(tenantDoc.data().usedMicros, 1_400);
  assert.equal(globalDoc.data().usedMicros, 1_400);
});

test("Firestore reconciliation replaces reserved cost with actual usage", async () => {
  const store = crearAlmacenCuotasFirestore(db);
  const reservation = await reservarCuota(store, {
    uid: "user-2",
    tenantId: "tenant-2",
    period: "2026-06",
    estimatedMicros: 900,
    limits: { user: 2_000, tenant: 3_000, global: 4_000 },
  });

  await reconciliarCuota(store, reservation, 450);

  const userDoc = await db.doc("asistente_cuotas/user__user-2__2026-06").get();
  assert.equal(userDoc.data().usedMicros, 450);
});

test("exhausted global budget degrades without mutating tenant or user usage", async () => {
  await db.doc("asistente_cuotas/global__2026-06").set({
    key: "global/2026-06",
    usedMicros: 4_000,
  });
  const store = crearAlmacenCuotasFirestore(db);

  await assert.rejects(
    () =>
      reservarCuota(store, {
        uid: "user-3",
        tenantId: "tenant-3",
        period: "2026-06",
        estimatedMicros: 100,
        limits: { user: 2_000, tenant: 3_000, global: 4_000 },
      }),
    (error) => error.code === "QUOTA_EXHAUSTED" && error.scope === "global"
  );

  const tenantDoc = await db.doc("asistente_cuotas/tenant__tenant-3__2026-06").get();
  const userDoc = await db.doc("asistente_cuotas/user__user-3__2026-06").get();
  const globalDoc = await db.doc("asistente_cuotas/global__2026-06").get();

  assert.equal(tenantDoc.exists, false);
  assert.equal(userDoc.exists, false);
  assert.equal(globalDoc.data().usedMicros, 4_000);
});
