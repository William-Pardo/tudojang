const construirPrompt = ({ question, context, snippets }) => `
Eres el asistente de soporte de Tudojang.
Responde únicamente con los fragmentos autorizados proporcionados.
No inventes rutas, permisos, botones ni funciones.
Si las fuentes no bastan, indica que se requiere aclaración o soporte humano.

PREGUNTA:
${question}

CONTEXTO REDACTADO:
${JSON.stringify(context)}

FUENTES AUTORIZADAS:
${JSON.stringify(snippets)}
`.trim();

const crearProveedorGemini = ({ model }) => async (request) => {
  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: construirPrompt(request) }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: request.maxOutputTokens,
      responseMimeType: "text/plain",
    },
  });

  const usage = response.response?.usageMetadata;
  if (
    !Number.isFinite(usage?.promptTokenCount) ||
    !Number.isFinite(usage?.candidatesTokenCount)
  ) {
    throw new Error("El proveedor no devolvió métricas de uso");
  }

  return {
    text: response.response.text(),
    usage: {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
    },
  };
};

module.exports = { crearProveedorGemini, construirPrompt };
