import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planificarNormalizacion,
  detectarColisionesDeCorreo,
  parsearArgumentos,
  migrar,
} from './normalizar-correos.js';

// --- Fake de Firestore Admin -----------------------------------------------------------
//
// Registra CADA escritura para poder afirmar que en dry-run no hubo ninguna. Un fake que
// solo devuelve datos no permitiria probar lo mas importante de una migracion.

function crearFirestoreFake(estudiantes) {
  const docs = new Map(Object.entries(estudiantes));
  const escrituras = [];
  let commits = 0;

  const construirConsulta = (filtro) => ({
    where: (campo, _op, valor) =>
      construirConsulta((datos) => (!filtro || filtro(datos)) && datos[campo] === valor),
    get: async () => ({
      docs: [...docs.entries()]
        .filter(([, datos]) => !filtro || filtro(datos))
        .map(([id, datos]) => ({ id, data: () => datos })),
    }),
  });

  const firestore = {
    collection: (nombre) => {
      assert.equal(nombre, 'estudiantes', 'la migracion solo debe tocar `estudiantes`');
      return { ...construirConsulta(null), doc: (id) => ({ __id: id }) };
    },
    batch: () => ({
      update: (ref, cambios) => escrituras.push({ id: ref.__id, cambios }),
      commit: async () => {
        commits += 1;
        for (const { id, cambios } of escrituras) {
          const datos = docs.get(id);
          for (const [campo, valor] of Object.entries(cambios)) {
            if (campo === 'tutor.correo') datos.tutor = { ...datos.tutor, correo: valor };
            else datos[campo] = valor;
          }
        }
      },
    }),
  };

  return { firestore, escrituras, docs, commits: () => commits };
}

const silencio = () => {};

// --- Logica pura -----------------------------------------------------------------------

test('planificarNormalizacion: devuelve null si ya esta todo en minusculas', () => {
  const plan = planificarNormalizacion({
    correo: 'juan@gajog.com',
    tutor: { correo: 'papa@gajog.com', nombres: 'MARIA' },
  });

  assert.equal(plan, null);
});

test('planificarNormalizacion: corrige el correo del acudiente con field path anidado', () => {
  const plan = planificarNormalizacion({ tutor: { correo: 'Papa@Gajog.com', nombres: 'MARIA' } });

  // Field path, NO un objeto `tutor` completo: si no, `update` pisaria nombres/telefono.
  assert.deepEqual(plan.cambios, { 'tutor.correo': 'papa@gajog.com' });
});

test('planificarNormalizacion: corrige tambien el correo del alumno', () => {
  const plan = planificarNormalizacion({ correo: '  JUAN@Gajog.com ' });

  assert.deepEqual(plan.cambios, { correo: 'juan@gajog.com' });
});

test('planificarNormalizacion: recorta espacios aunque ya este en minusculas', () => {
  const plan = planificarNormalizacion({ tutor: { correo: 'papa@gajog.com ' } });

  assert.deepEqual(plan.cambios, { 'tutor.correo': 'papa@gajog.com' });
});

test('planificarNormalizacion: ignora documentos sin correos y sin tutor', () => {
  assert.equal(planificarNormalizacion({ nombres: 'JUAN' }), null);
  assert.equal(planificarNormalizacion({ tutor: { nombres: 'MARIA' } }), null);
  assert.equal(planificarNormalizacion({}), null);
});

test('planificarNormalizacion: ignora valores que no son string', () => {
  assert.equal(planificarNormalizacion({ correo: 42, tutor: { correo: null } }), null);
});

test('detectarColisionesDeCorreo: avisa cuando dos alumnos colapsan al mismo correo', () => {
  const colisiones = detectarColisionesDeCorreo([
    { id: 'a', datos: { correo: 'Juan@Gajog.com' } },
    { id: 'b', datos: { correo: 'juan@gajog.com' } },
    { id: 'c', datos: { correo: 'ana@gajog.com' } },
  ]);

  assert.equal(colisiones.length, 1);
  assert.deepEqual(colisiones[0].ids.sort(), ['a', 'b']);
});

test('detectarColisionesDeCorreo: dos hijos del MISMO acudiente no son colision', () => {
  // Colisiones en tutor.correo son normales y esperables: un padre con dos hijos.
  const colisiones = detectarColisionesDeCorreo([
    { id: 'a', datos: { correo: 'juan@gajog.com', tutor: { correo: 'papa@gajog.com' } } },
    { id: 'b', datos: { correo: 'ana@gajog.com', tutor: { correo: 'papa@gajog.com' } } },
  ]);

  assert.deepEqual(colisiones, []);
});

test('parsearArgumentos: dry-run salvo que se pida --aplicar explicitamente', () => {
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang']).aplicar, false);
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang', '--aplicar']).aplicar, true);
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang', '--tenant', 'g']).tenant, 'g');
});

// --- La migracion de punta a punta -----------------------------------------------------

test('migrar: en DRY-RUN no escribe absolutamente nada', async () => {
  const { firestore, escrituras, docs, commits } = crearFirestoreFake({
    'est-1': { tenantId: 't1', correo: 'Juan@Gajog.com', tutor: { correo: 'Papa@Gajog.com' } },
  });

  const res = await migrar({ firestore, aplicar: false, log: silencio });

  assert.equal(escrituras.length, 0);
  assert.equal(commits(), 0);
  assert.equal(res.corregidos, 0);
  assert.equal(res.pendientes, 1, 'igual debe REPORTAR lo que corregiria');
  // El documento quedo intacto.
  assert.equal(docs.get('est-1').correo, 'Juan@Gajog.com');
});

test('migrar: con --aplicar normaliza y deja el resto del tutor intacto', async () => {
  const { firestore, docs } = crearFirestoreFake({
    'est-1': {
      tenantId: 't1',
      correo: 'Juan@Gajog.com',
      tutor: { correo: 'Papa@Gajog.com', nombres: 'MARIA', telefono: '300' },
    },
  });

  const res = await migrar({ firestore, aplicar: true, log: silencio });

  assert.equal(res.corregidos, 1);
  assert.equal(docs.get('est-1').correo, 'juan@gajog.com');
  assert.equal(docs.get('est-1').tutor.correo, 'papa@gajog.com');
  // Lo que NO era correo no se toco.
  assert.equal(docs.get('est-1').tutor.nombres, 'MARIA');
  assert.equal(docs.get('est-1').tutor.telefono, '300');
});

test('migrar: es IDEMPOTENTE -- la segunda corrida no cambia nada', async () => {
  const { firestore, docs } = crearFirestoreFake({
    'est-1': { tenantId: 't1', tutor: { correo: 'Papa@Gajog.com' } },
  });

  const primera = await migrar({ firestore, aplicar: true, log: silencio });
  const segunda = await migrar({ firestore, aplicar: true, log: silencio });

  assert.equal(primera.corregidos, 1);
  assert.equal(segunda.corregidos, 0);
  assert.equal(segunda.pendientes, 0);
  assert.equal(docs.get('est-1').tutor.correo, 'papa@gajog.com');
});

test('migrar: no toca los documentos que ya estaban bien', async () => {
  const { firestore, escrituras } = crearFirestoreFake({
    'est-ok': { tenantId: 't1', correo: 'ana@gajog.com', tutor: { correo: 'mama@gajog.com' } },
    'est-mal': { tenantId: 't1', tutor: { correo: 'Papa@Gajog.com' } },
  });

  await migrar({ firestore, aplicar: true, log: silencio });

  assert.equal(escrituras.length, 1);
  assert.equal(escrituras[0].id, 'est-mal');
});

test('migrar: acotado por --tenant solo alcanza a ese club', async () => {
  const { firestore, docs } = crearFirestoreFake({
    'est-mio': { tenantId: 'gajog', tutor: { correo: 'Papa@Gajog.com' } },
    'est-ajeno': { tenantId: 'otro-club', tutor: { correo: 'Papa@Otro.com' } },
  });

  const res = await migrar({ firestore, tenant: 'gajog', aplicar: true, log: silencio });

  assert.equal(res.leidos, 1);
  assert.equal(docs.get('est-mio').tutor.correo, 'papa@gajog.com');
  assert.equal(docs.get('est-ajeno').tutor.correo, 'Papa@Otro.com', 'no debe tocar otro tenant');
});

test('migrar: reporta las colisiones de correo de alumno', async () => {
  const { firestore } = crearFirestoreFake({
    'est-1': { tenantId: 't1', correo: 'Juan@Gajog.com' },
    'est-2': { tenantId: 't1', correo: 'juan@gajog.com' },
  });

  const res = await migrar({ firestore, aplicar: false, log: silencio });

  assert.equal(res.colisiones.length, 1);
  assert.equal(res.colisiones[0].correo, 'juan@gajog.com');
});
