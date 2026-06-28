const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearRespuestaIa,
  ejecutarProveedor,
} = require("./modelo");

test("crearRespuestaIa returns a typed attributable response", () => {
  assert.deepEqual(
    crearRespuestaIa({
      answer: "Abre Estudiantes y selecciona Agregar estudiante.",
      intentId: "estudiantes.crear",
      catalogVersion: "1.0.0",
      confidence: 0.72,
      remaining: { user: 9, tenant: 90, global: 900 },
    }),
    {
      answer: "Abre Estudiantes y selecciona Agregar estudiante.",
      source: "ai",
      intentId: "estudiantes.crear",
      catalogVersion: "1.0.0",
      confidence: 0.72,
      remaining: { user: 9, tenant: 90, global: 900 },
    }
  );
});

test("crearRespuestaIa rejects answers without catalog attribution", () => {
  assert.throws(
    () =>
      crearRespuestaIa({
        answer: "Respuesta libre",
        catalogVersion: "1.0.0",
        confidence: 0.4,
        remaining: { user: 1, tenant: 1, global: 1 },
      }),
    /intentId/
  );
});

test("ejecutarProveedor normalizes content and token usage", async () => {
  const provider = async () => ({
    text: "  Usa la opción Agregar estudiante.  ",
    usage: { inputTokens: 120, outputTokens: 30 },
  });

  assert.deepEqual(await ejecutarProveedor(provider, { prompt: "pregunta" }), {
    answer: "Usa la opción Agregar estudiante.",
    usage: { inputTokens: 120, outputTokens: 30 },
  });
});

test("ejecutarProveedor converts provider failures into a safe error", async () => {
  const provider = async () => {
    throw new Error("upstream key and internal details");
  };

  await assert.rejects(
    () => ejecutarProveedor(provider, { prompt: "pregunta" }),
    (error) =>
      error.code === "PROVIDER_UNAVAILABLE" &&
      error.message === "El servicio de IA no está disponible"
  );
});
