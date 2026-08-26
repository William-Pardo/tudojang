/**
 * Lógica pura de detección de comprobante duplicado, extraída de
 * analizarComprobanteEstudiante (index.js) para poder testearla sin mockear Firestore.
 * Solo decide, a partir de docs YA CONSULTADOS, si hay que advertir -- el fetch real
 * (query a reportes_pagos_estudiantes) sigue viviendo en index.js.
 */
const construirAdvertenciaReferenciaDuplicada = (referencia, docsConMismaReferencia, reporteIdPropio) => {
  if (!referencia) return null;
  if (!Array.isArray(docsConMismaReferencia) || docsConMismaReferencia.length === 0) return null;

  const duplicado = docsConMismaReferencia.find((doc) => doc.id !== reporteIdPropio);
  if (!duplicado) return null;

  return `Referencia duplicada: ya existe un pago APROBADO (reporte ${duplicado.id}) con esta misma referencia.`;
};

module.exports = { construirAdvertenciaReferenciaDuplicada };
