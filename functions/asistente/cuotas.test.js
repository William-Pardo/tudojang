const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearAlmacenCuotasMemoria,
  reservarCuota,
  reconciliarCuota,
} = require("./cuotas");

const limites = { user: 2_000, tenant: 3_000, global: 4_000 };

test("reservarCuota atomically updates user, tenant and global usage", async () => {
  const store = crearAlmacenCuotasMemoria();

  const result = await reservarCuota(store, {
    uid: "u1",
    tenantId: "t1",
    period: "2026-06",
    estimatedMicros: 900,
    limits: limites,
  });

  assert.deepEqual(result.remaining, {
    user: 1_100,
    tenant: 2_100,
    global: 3_100,
  });
  assert.deepEqual(store.snapshot(), {
    "global/2026-06": 900,
    "tenant/t1/2026-06": 900,
    "user/u1/2026-06": 900,
  });
});

test("concurrent reservations never exceed the smallest limit", async () => {
  const store = crearAlmacenCuotasMemoria();
  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      reservarCuota(store, {
        uid: "u1",
        tenantId: "t1",
        period: "2026-06",
        estimatedMicros: 700,
        limits: limites,
      })
    )
  );

  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    2
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    3
  );
  assert.equal(store.snapshot()["user/u1/2026-06"], 1_400);
});

test("a rejected reservation leaves every counter unchanged", async () => {
  const store = crearAlmacenCuotasMemoria({
    "global/2026-06": 3_800,
    "tenant/t1/2026-06": 1_000,
    "user/u1/2026-06": 500,
  });

  await assert.rejects(
    () =>
      reservarCuota(store, {
        uid: "u1",
        tenantId: "t1",
        period: "2026-06",
        estimatedMicros: 300,
        limits: limites,
      }),
    (error) => error.code === "QUOTA_EXHAUSTED" && error.scope === "global"
  );

  assert.deepEqual(store.snapshot(), {
    "global/2026-06": 3_800,
    "tenant/t1/2026-06": 1_000,
    "user/u1/2026-06": 500,
  });
});

test("reconciliarCuota replaces the reservation with actual cost", async () => {
  const store = crearAlmacenCuotasMemoria();
  const reservation = await reservarCuota(store, {
    uid: "u1",
    tenantId: "t1",
    period: "2026-06",
    estimatedMicros: 900,
    limits: limites,
  });

  await reconciliarCuota(store, reservation, 450);

  assert.deepEqual(store.snapshot(), {
    "global/2026-06": 450,
    "tenant/t1/2026-06": 450,
    "user/u1/2026-06": 450,
  });
});
