const validarNumeroNoNegativo = (valor, nombre) => {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new TypeError(`${nombre} debe ser un número no negativo`);
  }
};

const calcularCostoMicros = (uso, precios) => {
  validarNumeroNoNegativo(uso.inputTokens, "input tokens");
  validarNumeroNoNegativo(uso.outputTokens, "output tokens");
  validarNumeroNoNegativo(precios.inputUsdPerMillion, "input price");
  validarNumeroNoNegativo(precios.outputUsdPerMillion, "output price");

  const costoUsd =
    (uso.inputTokens * precios.inputUsdPerMillion +
      uso.outputTokens * precios.outputUsdPerMillion) /
    1_000_000;

  return Math.ceil(costoUsd * 1_000_000);
};

const estimarReservaMicros = (limites, precios, multiplicadorSeguridad = 1) => {
  validarNumeroNoNegativo(multiplicadorSeguridad, "safety multiplier");
  return Math.ceil(
    calcularCostoMicros(
      {
        inputTokens: limites.maxInputTokens,
        outputTokens: limites.maxOutputTokens,
      },
      precios
    ) * multiplicadorSeguridad
  );
};

module.exports = { calcularCostoMicros, estimarReservaMicros };
