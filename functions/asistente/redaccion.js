const PATRONES_SENSIBLES = [
  {
    expresion: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    reemplazo: "[EMAIL]",
  },
  {
    expresion: /(?:\+?57[\s-]?)?(?:3\d{2})[\s-]?\d{3}[\s-]?\d{4}\b/g,
    reemplazo: "[TELEFONO]",
  },
  {
    expresion: /\b\d{1,3}(?:\.\d{3}){2,3}\b/g,
    reemplazo: "[DOCUMENTO]",
  },
];

const PATRONES_INYECCION = [
  /ignora(?:r)?\s+(?:todas?\s+)?(?:las?\s+)?instrucciones?/i,
  /(?:muestra|revela|lista).*(?:otros?\s+tenants?|datos?\s+privados?)/i,
  /(?:omite|evita|salta).*(?:permisos?|restricciones?|fuentes?)/i,
  /system\s+prompt|developer\s+message/i,
];

const redactarTexto = (texto) =>
  PATRONES_SENSIBLES.reduce(
    (resultado, patron) =>
      resultado.replace(patron.expresion, patron.reemplazo),
    String(texto ?? "")
  );

const detectarInyeccionPrompt = (texto) =>
  PATRONES_INYECCION.some((patron) => patron.test(String(texto ?? "")));

module.exports = { redactarTexto, detectarInyeccionPrompt };
