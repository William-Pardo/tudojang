const test = require("node:test");
const assert = require("node:assert/strict");
const { crearProveedorGemini } = require("./proveedor");

test("Gemini provider sends bounded source-grounded instructions", async () => {
  let request;
  const model = {
    generateContent: async (input) => {
      request = input;
      return {
        response: {
          text: () => "Respuesta basada en catálogo",
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 25,
          },
        },
      };
    },
  };
  const provider = crearProveedorGemini({ model });

  const result = await provider({
    question: "¿Cómo agrego un estudiante?",
    context: [],
    snippets: [
      {
        id: "students.manage",
        label: "Crear estudiante",
        steps: ["Abre Estudiantes.", "Pulsa Agregar Estudiante."],
        route: "/estudiantes",
      },
    ],
    maxOutputTokens: 300,
  });

  assert.equal(request.generationConfig.maxOutputTokens, 300);
  assert.equal(request.contents[0].parts[0].text.includes("students.manage"), true);
  assert.deepEqual(result, {
    text: "Respuesta basada en catálogo",
    usage: { inputTokens: 120, outputTokens: 25 },
  });
});

test("Gemini provider rejects responses without usage metadata", async () => {
  const provider = crearProveedorGemini({
    model: {
      generateContent: async () => ({
        response: { text: () => "Respuesta sin métricas" },
      }),
    },
  });

  await assert.rejects(
    () =>
      provider({
        question: "Pregunta",
        context: [],
        snippets: [{ id: "intent", steps: ["Paso"] }],
        maxOutputTokens: 300,
      }),
    /métricas/
  );
});
