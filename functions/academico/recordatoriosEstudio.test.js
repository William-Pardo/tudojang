'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioRecordatoriosEstudio } = require('./recordatoriosEstudio');

const ahoraFijo = new Date('2026-07-18T12:00:00Z');

function horas(n) {
  return new Date(ahoraFijo.getTime() + n * 60 * 60 * 1000).toISOString();
}

function dias(n) {
  return new Date(ahoraFijo.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

// aplicaAlEstudiante real es servicios/academico/asignacionService.ts:aplicaAlEstudiante;
// acá se replica el mismo contrato minimo (destinatario.tipo grupo/estudiante) para no
// depender del build de TypeScript en estos tests de functions/.
function aplicaAlEstudiante(asignacion, estudiante) {
  const { destinatario } = asignacion;
  if (destinatario.tipo === 'estudiante') return (destinatario.estudianteIds || []).includes(estudiante.id);
  if (destinatario.tipo === 'grupo') return destinatario.grupo === estudiante.grupo || destinatario.grupo === 'Todos';
  return false;
}

function crearDeps({ asignaciones, estudiantes, avancePorEstudiante = {}, ultimosRecordatorios = {} }) {
  const creadas = [];
  return {
    creadas,
    deps: {
      listarAsignacionesVigentes: async () => asignaciones,
      listarEstudiantesActivos: async () => estudiantes,
      obtenerAvancePorAsignacion: async (tenantId, estudianteId) => avancePorEstudiante[estudianteId] || [],
      obtenerFechaUltimoRecordatorio: async (estudianteId, asignacionId, situacion) => {
        const clave = `${estudianteId}::${asignacionId}::${situacion}`;
        return ultimosRecordatorios[clave];
      },
      obtenerUltimoComentario: async () => undefined,
      crearNotificacion: async (n) => { creadas.push(n); },
      aplicaAlEstudiante,
    },
  };
}

test('envía "por_vencer_sin_iniciar" cuando cierra en menos de 48h y no la tocó', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com' },
    ],
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 1);
  assert.equal(creadas[0].estudianteId, 'e1');
  assert.equal(creadas[0].tipo, 'RecordatorioEstudio');
  assert.equal(creadas[0].situacion, 'por_vencer_sin_iniciar');
  assert.equal(creadas[0].asignacionId, 'a1');
  assert.match(creadas[0].mensaje, /Poomsae 1/);
});

test('no duplica dentro del cooldown (recordatorio ya enviado hace menos de 24h)', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com' },
    ],
    ultimosRecordatorios: {
      'e1::a1::por_vencer_sin_iniciar': horas(-10), // enviado hace 10h
    },
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 0);
  assert.equal(creadas.length, 0);
});

test('vuelve a enviar cuando ya pasó el cooldown (24h+)', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com' },
    ],
    ultimosRecordatorios: {
      'e1::a1::por_vencer_sin_iniciar': horas(-25), // enviado hace 25h
    },
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 1);
});

test('no envía a un estudiante que no pertenece al grupo destinatario', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Competencia' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com' },
    ],
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 0);
  assert.equal(creadas.length, 0);
});

test('no cruza asignaciones de un tenant con estudiantes de otro tenant', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't2', nombres: 'Ana', grupo: 'Todos', correo: 'ana@test.com' },
    ],
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 0);
  assert.equal(creadas.length, 0);
});

test('envía "inactividad_prolongada" cuando no hubo ningún otro recordatorio en la corrida', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com', ultimaActividadEn: dias(-20) },
    ],
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 1);
  assert.equal(creadas[0].situacion, 'inactividad_prolongada');
  assert.equal(creadas[0].asignacionId, undefined);
});

test('no apila "inactividad_prolongada" sobre un recordatorio específico ya enviado en la misma corrida', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com', ultimaActividadEn: dias(-20) },
    ],
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 1);
  assert.equal(creadas[0].situacion, 'por_vencer_sin_iniciar');
});

test('no envía nada si el estudiante ya completó la asignación', async () => {
  const { creadas, deps } = crearDeps({
    asignaciones: [
      { id: 'a1', tenantId: 't1', titulo: 'Poomsae 1', destinatario: { tipo: 'grupo', grupo: 'Todos' }, fechaApertura: dias(-10), fechaCierre: horas(30) },
    ],
    estudiantes: [
      { id: 'e1', tenantId: 't1', nombres: 'Ana', grupo: 'Infantil', correo: 'ana@test.com' },
    ],
    avancePorEstudiante: {
      e1: [{ asignacionId: 'a1', porcentajeConsumo: 100 }],
    },
  });
  const servicio = crearServicioRecordatoriosEstudio(deps);

  const res = await servicio(ahoraFijo);

  assert.equal(res.creadas, 0);
});
