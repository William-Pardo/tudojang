const crypto = require("node:crypto");

const RETENTION_DAYS = 30;
const hashIdentifier = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const validarNoNegativo = (value, name) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} debe ser no negativo`);
  }
};

const normalizarCuotaRestante = (remaining) => {
  if (remaining == null) return null;
  const normalizada = {};
  for (const scope of ["user", "tenant", "global"]) {
    const value = remaining[scope];
    if (value == null) {
      normalizada[scope] = null;
      continue;
    }
    validarNoNegativo(value, `remaining.${scope}`);
    normalizada[scope] = value;
  }
  return normalizada;
};

const calcularNivelAlertaCosto = (usedMicros, budgetMicros) => {
  validarNoNegativo(usedMicros, "usedMicros");
  if (!Number.isFinite(budgetMicros) || budgetMicros <= 0) {
    throw new TypeError("budgetMicros debe ser positivo");
  }
  const percentage = (usedMicros / budgetMicros) * 100;
  if (percentage >= 100) return 100;
  if (percentage >= 90) return 90;
  if (percentage >= 75) return 75;
  if (percentage >= 50) return 50;
  return null;
};

const crearEventoTelemetria = ({
  uid,
  tenantId,
  intentId = null,
  source,
  latencyMs,
  inputTokens,
  outputTokens,
  costMicros,
  quotaOutcome,
  remaining = null,
  escalationReason = null,
  now = new Date(),
}) => {
  validarNoNegativo(latencyMs, "latencyMs");
  validarNoNegativo(inputTokens, "inputTokens");
  validarNoNegativo(outputTokens, "outputTokens");
  validarNoNegativo(costMicros, "costMicros");

  return {
    uidHash: hashIdentifier(uid),
    tenantHash: hashIdentifier(tenantId),
    intentId,
    source,
    latencyMs,
    inputTokens,
    outputTokens,
    costMicros,
    quotaOutcome,
    remaining: normalizarCuotaRestante(remaining),
    escalationReason,
    createdAt: now.toISOString(),
    retentionUntil: new Date(
      now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
  };
};

module.exports = {
  crearEventoTelemetria,
  hashIdentifier,
  calcularNivelAlertaCosto,
};
