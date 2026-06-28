const functions = require("firebase-functions");
const {
  obtenerIdentidadConfiable,
} = require("./autorizacion");
const {
  redactarTexto,
  detectarInyeccionPrompt,
} = require("./redaccion");
const {
  crearRespuestaIa,
  ejecutarProveedor,
} = require("./modelo");

const RESPUESTA_DESACTIVADA =
  "La consulta con IA está desactivada temporalmente. Puedo seguir orientándote con el catálogo local o escalar tu solicitud.";

const crearRespuestaDesactivada = (catalogVersion) => ({
  answer: RESPUESTA_DESACTIVADA,
  source: "human",
  catalogVersion,
  confidence: 0,
  remaining: { user: null, tenant: null, global: null },
  escalation: { reason: "ai_disabled" },
});

const seleccionarFragmentos = (catalog, intentIds, role) => {
  const requested = new Set(Array.isArray(intentIds) ? intentIds.slice(0, 3) : []);
  return catalog.entries
    .filter(
      (entry) =>
        requested.has(entry.id) &&
        entry.roles.includes(role) &&
        entry.status !== "reserved"
    )
    .map(({ id, label, steps, route, sensitivity }) => ({
      id,
      label,
      steps,
      route,
      sensitivity,
    }));
};

const crearError = (code, message) => Object.assign(new Error(message), { code });

const crearServicioAsistente = ({
  enabled,
  catalog,
  provider,
  reserveQuota,
  reconcileQuota = async () => undefined,
  calculateActualCost = () => 0,
  recordTelemetry = async () => undefined,
}) => async (data, context) => {
  const startedAt = Date.now();
  const identity = obtenerIdentidadConfiable(context);
  const question = String(data?.question ?? "").trim().slice(0, 1_200);

  if (!question) {
    throw crearError("invalid-argument", "La pregunta es obligatoria");
  }
  if (detectarInyeccionPrompt(question)) {
    throw crearError("permission-denied", "La solicitud no está permitida");
  }
  if (!enabled) {
    await recordTelemetry({
      uid: identity.uid,
      tenantId: identity.tenantId,
      source: "human",
      latencyMs: Date.now() - startedAt,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      quotaOutcome: "not_applicable",
      remaining: null,
      escalationReason: "ai_disabled",
    });
    return crearRespuestaDesactivada(catalog.catalogVersion);
  }

  const snippets = seleccionarFragmentos(catalog, data?.intentIds, identity.rol);
  if (snippets.length === 0) {
    throw crearError(
      "failed-precondition",
      "No hay fuentes autorizadas para responder"
    );
  }

  let quota;
  try {
    quota = await reserveQuota(identity);
  } catch (error) {
    if (error?.code === "QUOTA_EXHAUSTED") {
      await recordTelemetry({
        uid: identity.uid,
        tenantId: identity.tenantId,
        intentId: snippets[0]?.id ?? null,
        source: "human",
        latencyMs: Date.now() - startedAt,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        quotaOutcome: "exhausted",
        remaining: null,
        escalationReason: `quota_${error.scope ?? "unknown"}`,
      });
    }
    throw error;
  }
  const providerResult = await ejecutarProveedor(provider, {
    question: redactarTexto(question),
    context: Array.isArray(data?.context)
      ? data.context.slice(-4).map((turn) => ({
          role: turn.role,
          text: redactarTexto(String(turn.text ?? "")).slice(0, 500),
        }))
      : [],
    snippets,
    maxOutputTokens: 300,
  });
  const actualCostMicros = calculateActualCost(providerResult.usage);

  await reconcileQuota(
    quota.reservation,
    actualCostMicros
  );
  await recordTelemetry({
    uid: identity.uid,
    tenantId: identity.tenantId,
    intentId: snippets[0].id,
    source: "ai",
    latencyMs: Date.now() - startedAt,
    inputTokens: providerResult.usage.inputTokens,
    outputTokens: providerResult.usage.outputTokens,
    costMicros: actualCostMicros,
    quotaOutcome: "allowed",
    remaining: quota.remaining,
    escalationReason: null,
  });

  return crearRespuestaIa({
    answer: providerResult.answer,
    intentId: snippets[0].id,
    catalogVersion: catalog.catalogVersion,
    confidence: 0.55,
    remaining: quota.remaining,
  });
};

const crearHandlerCallable = (service) => async (data, context) => {
  try {
    return await service(data, context);
  } catch (error) {
    if (error?.code === "QUOTA_EXHAUSTED") {
      throw new functions.https.HttpsError("resource-exhausted", error.message);
    }
    const allowedCodes = new Set([
      "unauthenticated",
      "failed-precondition",
      "permission-denied",
      "invalid-argument",
      "resource-exhausted",
      "unavailable",
      "not-found",
    ]);
    const code = allowedCodes.has(error?.code) ? error.code : "internal";
    throw new functions.https.HttpsError(
      code,
      code === "internal" ? "No fue posible procesar la consulta" : error.message
    );
  }
};

module.exports = {
  crearServicioAsistente,
  crearHandlerCallable,
  seleccionarFragmentos,
};
