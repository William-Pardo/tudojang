const test = require("node:test");
const assert = require("node:assert/strict");
const {
  obtenerIdentidadConfiable,
  validarSolicitudAsistente,
} = require("./autorizacion");

test("obtenerIdentidadConfiable derives uid, tenant and role from trusted context", () => {
  assert.deepEqual(
    obtenerIdentidadConfiable({
      auth: {
        uid: "user-1",
        token: { tenantId: "tenant-1", rol: "Admin" },
      },
      app: { appId: "app-1" },
    }),
    { uid: "user-1", tenantId: "tenant-1", rol: "Admin" }
  );
});

test("obtenerIdentidadConfiable ignores tenant and role sent by the browser", () => {
  assert.deepEqual(
    obtenerIdentidadConfiable(
      {
        auth: {
          uid: "user-1",
          token: { tenantId: "trusted", rol: "Tutor" },
        },
        app: { appId: "app-1" },
      },
      { tenantId: "attacker", rol: "SuperAdmin" }
    ),
    { uid: "user-1", tenantId: "trusted", rol: "Tutor" }
  );
});

test("validarSolicitudAsistente rejects unauthenticated requests", () => {
  assert.throws(
    () => validarSolicitudAsistente({ app: { appId: "app-1" } }),
    (error) => error.code === "unauthenticated"
  );
});

test("validarSolicitudAsistente rejects requests without App Check", () => {
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

test("validarSolicitudAsistente rejects missing trusted tenant or role", () => {
  assert.throws(
    () =>
      validarSolicitudAsistente({
        auth: { uid: "user-1", token: {} },
        app: { appId: "app-1" },
      }),
    (error) => error.code === "permission-denied"
  );
});
