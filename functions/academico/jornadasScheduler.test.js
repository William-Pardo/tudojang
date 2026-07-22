const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioIniciarJornadasPorHorario, debeIniciar, fechaHoraBogota } = require('./jornadasScheduler');

// 2026-07-08T13:05:00.000Z == 2026-07-08 08:05 America/Bogota (UTC-5, sin horario de verano).
const AHORA_DENTRO_VENTANA = new Date('2026-07-08T13:05:00.000Z');

function crearSnap(id, data) {
  const updates = [];
  return {
    ref: { update: async (payload) => updates.push({ id, payload }) },
    data: () => data,
    _updates: updates,
  };
}

test('fechaHoraBogota convierte UTC a fecha/hora local de Bogota (UTC-5)', () => {
  const { fecha, hora } = fechaHoraBogota(AHORA_DENTRO_VENTANA);
  assert.equal(fecha, '2026-07-08');
  assert.equal(hora, '08:05');
});

test('fechaHoraBogota cruza correctamente la medianoche UTC hacia el dia anterior en Bogota', () => {
  // 2026-07-08T02:00:00.000Z == 2026-07-07 21:00 America/Bogota (el dia UTC ya avanzo, Bogota no).
  const { fecha, hora } = fechaHoraBogota(new Date('2026-07-08T02:00:00.000Z'));
  assert.equal(fecha, '2026-07-07');
  assert.equal(hora, '21:00');
});

test('debeIniciar: true para confirmada, misma fecha, hora dentro de [horaInicio, horaFin]', () => {
  const jornada = { estado: 'confirmada', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '08:05'), true);
});

test('debeIniciar: true en el borde exacto de horaInicio', () => {
  const jornada = { estado: 'confirmada', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '08:00'), true);
});

test('debeIniciar: false si la hora actual es ANTES de horaInicio', () => {
  const jornada = { estado: 'confirmada', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '07:59'), false);
});

test('debeIniciar: false si la hora actual es DESPUES de horaFin', () => {
  const jornada = { estado: 'confirmada', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '09:01'), false);
});

test('debeIniciar: false si la fecha no coincide (aunque la hora si)', () => {
  const jornada = { estado: 'confirmada', fecha: '2026-07-09', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '08:05'), false);
});

test('debeIniciar: false si el estado no es confirmada ni borrador (en_curso, cancelada, etc)', () => {
  const base = { fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  for (const estado of ['en_curso', 'cancelada', 'cerrada', 'reprogramada']) {
    assert.equal(debeIniciar({ ...base, estado }, '2026-07-08', '08:05'), false, `estado=${estado}`);
  }
});

// Rediseño 2026-07-12 (pedido explicito del usuario: "borrador como estado ya no deberia
// existir", clases malleables por defecto): una jornada en borrador (legacy o creada desde
// JornadasView.tsx) ahora se considera igual de "lista" que una confirmada para el
// auto-inicio -- de lo contrario quedaria visualmente malleable (mismos iconos que
// confirmada) pero nunca arrancaria sola por horario.
test('debeIniciar: true para borrador, misma fecha, hora dentro de [horaInicio, horaFin] (tratada igual que confirmada)', () => {
  const jornada = { estado: 'borrador', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(debeIniciar(jornada, '2026-07-08', '08:05'), true);
});

test('crearServicioIniciarJornadasPorHorario inicia solo las jornadas confirmadas dentro de su ventana', async () => {
  const dentroVentana = crearSnap('j1', {
    tenantId: 'tenant-1', estado: 'confirmada', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00',
  });
  const otraFecha = crearSnap('j2', {
    tenantId: 'tenant-1', estado: 'confirmada', fecha: '2026-07-09', horaInicio: '08:00', horaFin: '09:00',
  });
  const aunNoEmpieza = crearSnap('j3', {
    tenantId: 'tenant-1', estado: 'confirmada', fecha: '2026-07-08', horaInicio: '10:00', horaFin: '11:00',
  });

  const servicio = crearServicioIniciarJornadasPorHorario({
    listarJornadasConfirmadas: async () => [dentroVentana, otraFecha, aunNoEmpieza],
  });

  const resultado = await servicio(AHORA_DENTRO_VENTANA);

  assert.equal(resultado.procesadas, 3);
  assert.equal(resultado.iniciadas, 1);
  assert.deepEqual(dentroVentana._updates, [
    { id: 'j1', payload: { estado: 'en_curso', actualizadoEn: AHORA_DENTRO_VENTANA.toISOString() } },
  ]);
  assert.deepEqual(otraFecha._updates, []);
  assert.deepEqual(aunNoEmpieza._updates, []);
});

test('crearServicioIniciarJornadasPorHorario tambien inicia jornadas en borrador dentro de su ventana (malleables por defecto)', async () => {
  const borradorDentroVentana = crearSnap('j4', {
    tenantId: 'tenant-1', estado: 'borrador', fecha: '2026-07-08', horaInicio: '08:00', horaFin: '09:00',
  });

  const servicio = crearServicioIniciarJornadasPorHorario({
    listarJornadasConfirmadas: async () => [borradorDentroVentana],
  });

  const resultado = await servicio(AHORA_DENTRO_VENTANA);

  assert.equal(resultado.iniciadas, 1);
  assert.deepEqual(borradorDentroVentana._updates, [
    { id: 'j4', payload: { estado: 'en_curso', actualizadoEn: AHORA_DENTRO_VENTANA.toISOString() } },
  ]);
});

test('crearServicioIniciarJornadasPorHorario no procesa nada si no hay jornadas confirmadas', async () => {
  const servicio = crearServicioIniciarJornadasPorHorario({ listarJornadasConfirmadas: async () => [] });

  const resultado = await servicio(AHORA_DENTRO_VENTANA);

  assert.equal(resultado.procesadas, 0);
  assert.equal(resultado.iniciadas, 0);
});
