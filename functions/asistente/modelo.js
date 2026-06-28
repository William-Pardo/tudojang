const crearRespuestaIa = ({
  answer,
  intentId,
  catalogVersion,
  confidence,
  remaining,
}) => {
  if (!String(answer ?? "").trim()) {
    throw new TypeError("answer es obligatorio");
  }
  if (!String(intentId ?? "").trim()) {
    throw new TypeError("intentId es obligatorio");
  }
  if (!String(catalogVersion ?? "").trim()) {
    throw new TypeError("catalogVersion es obligatorio");
  }

  return {
    answer: answer.trim(),
    source: "ai",
    intentId,
    catalogVersion,
    confidence,
    remaining,
  };
};

const ejecutarProveedor = async (provider, request) => {
  try {
    const response = await provider(request);
    const answer = String(response?.text ?? "").trim();
    const inputTokens = response?.usage?.inputTokens;
    const outputTokens = response?.usage?.outputTokens;

    if (
      !answer ||
      !Number.isFinite(inputTokens) ||
      !Number.isFinite(outputTokens)
    ) {
      throw new Error("Respuesta inválida del proveedor");
    }

    return {
      answer,
      usage: { inputTokens, outputTokens },
    };
  } catch {
    const error = new Error("El servicio de IA no está disponible");
    error.code = "PROVIDER_UNAVAILABLE";
    throw error;
  }
};

module.exports = { crearRespuestaIa, ejecutarProveedor };
