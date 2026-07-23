const test = require('node:test');
const assert = require('node:assert/strict');
const { estaEnVentana, tieneHorario, calcularRetraso } = require('./ventanaClaseEnVivo');

// Clase 18:00-19:00 hora Bogota (UTC-5) => ventana [17:45, 19:15] Bogota = [22:45Z, 00:15Z(+1)].
const jornada = { fecha: '2026-07-25', horaInicio: '18:00', horaFin: '19:00' };

test('estaEnVentana: dentro del horario de la clase', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-25T23:30:00Z')).dentro, true);
});

test('estaEnVentana: en el borde de apertura (inicio-15) inclusive', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-25T22:45:00Z')).dentro, true);
});

test('estaEnVentana: en el borde de cierre (fin+15) inclusive', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-26T00:15:00Z')).dentro, true);
});

test('estaEnVentana: un minuto antes de la apertura => fuera', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-25T22:44:00Z')).dentro, false);
});

test('estaEnVentana: un minuto despues del cierre => fuera', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-26T00:16:00Z')).dentro, false);
});

test('estaEnVentana: dias despues => fuera (la brecha)', () => {
  assert.equal(estaEnVentana(jornada, new Date('2026-07-28T23:30:00Z')).dentro, false);
});

test('tieneHorario: true con los tres campos, false si falta alguno', () => {
  assert.equal(tieneHorario(jornada), true);
  assert.equal(tieneHorario({ fecha: '2026-07-25', horaInicio: '18:00' }), false);
  assert.equal(tieneHorario({}), false);
  assert.equal(tieneHorario(null), false);
});

// Clase inicia 18:00 Bogota = 23:00Z.
test('calcularRetraso: llegar antes de la hora de inicio NO es tarde', () => {
  const r = calcularRetraso(jornada, new Date('2026-07-25T22:50:00Z')); // 17:50, 10 min antes
  assert.equal(r.isLate, false);
  assert.equal(r.minutesLate, 0);
});

test('calcularRetraso: llegar EXACTO a la hora de inicio NO es tarde', () => {
  const r = calcularRetraso(jornada, new Date('2026-07-25T23:00:00Z')); // 18:00 clavado
  assert.equal(r.isLate, false);
  assert.equal(r.minutesLate, 0);
});

test('calcularRetraso: un minuto despues de la hora de inicio YA es tarde', () => {
  const r = calcularRetraso(jornada, new Date('2026-07-25T23:01:00Z')); // 18:01
  assert.equal(r.isLate, true);
  assert.equal(r.minutesLate, 1);
});

test('calcularRetraso: 20 minutos tarde', () => {
  const r = calcularRetraso(jornada, new Date('2026-07-25T23:20:00Z')); // 18:20
  assert.equal(r.isLate, true);
  assert.equal(r.minutesLate, 20);
});
