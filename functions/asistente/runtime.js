const estaIaHabilitada = (environment = process.env) =>
  environment.ASSISTANT_AI_ENABLED === "true" &&
  typeof environment.GEMINI_API_KEY === "string" &&
  environment.GEMINI_API_KEY.trim().length > 0;

const obtenerPeriodoMensual = (date = new Date()) =>
  date.toISOString().slice(0, 7);

module.exports = { estaIaHabilitada, obtenerPeriodoMensual };
