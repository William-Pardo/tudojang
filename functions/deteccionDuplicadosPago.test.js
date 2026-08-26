const test = require("node:test");
const assert = require("node:assert/strict");
const { construirAdvertenciaReferenciaDuplicada } = require("./deteccionDuplicadosPago");

test("construirAdvertenciaReferenciaDuplicada devuelve null si no hay referencia", () => {
  assert.equal(construirAdvertenciaReferenciaDuplicada(undefined, [{ id: "rep-2" }], "rep-1"), null);
  assert.equal(construirAdvertenciaReferenciaDuplicada("", [{ id: "rep-2" }], "rep-1"), null);
});

test("construirAdvertenciaReferenciaDuplicada devuelve null sin docs con la misma referencia", () => {
  assert.equal(construirAdvertenciaReferenciaDuplicada("REF-1", [], "rep-1"), null);
});

test("construirAdvertenciaReferenciaDuplicada devuelve null si el único doc encontrado es el propio reporte", () => {
  assert.equal(construirAdvertenciaReferenciaDuplicada("REF-1", [{ id: "rep-1" }], "rep-1"), null);
});

test("construirAdvertenciaReferenciaDuplicada arma la advertencia citando el id del reporte duplicado", () => {
  const advertencia = construirAdvertenciaReferenciaDuplicada("REF-1", [{ id: "rep-2" }], "rep-1");
  assert.equal(
    advertencia,
    "Referencia duplicada: ya existe un pago APROBADO (reporte rep-2) con esta misma referencia."
  );
});

test("construirAdvertenciaReferenciaDuplicada ignora el propio reporte aunque venga junto a un duplicado real", () => {
  const advertencia = construirAdvertenciaReferenciaDuplicada(
    "REF-1",
    [{ id: "rep-1" }, { id: "rep-2" }],
    "rep-1"
  );
  assert.equal(
    advertencia,
    "Referencia duplicada: ya existe un pago APROBADO (reporte rep-2) con esta misma referencia."
  );
});

test("construirAdvertenciaReferenciaDuplicada no revienta si el segundo argumento no es un array", () => {
  assert.equal(construirAdvertenciaReferenciaDuplicada("REF-1", undefined, "rep-1"), null);
  assert.equal(construirAdvertenciaReferenciaDuplicada("REF-1", null, "rep-1"), null);
});
