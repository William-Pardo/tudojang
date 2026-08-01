import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planificarBackfill,
  parsearArgumentos,
  backfillEstadoMatricula,
} from './backfillEstadoMatricula.js';

// --- Fake de Firestore Admin -----------------------------------------------------------
//
// Mismo patron que scripts/normalizar-correos.test.js: registra CADA escritura para poder
// afirmar que en dry-run no hubo ninguna.

function crearFirestoreFake(estudiantes) {
  const docs = new Map(Object.entries(estudiantes).map(([id, datos]) => [id, { ...datos }]));
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
      assert.equal(nombre, 'estudiantes', 'el backfill solo debe tocar `estudiantes`');
      return { ...construirConsulta(null), doc: (id) => ({ __id: id }) };
    },
    batch: () => ({
      update: (ref, cambios) => escrituras.push({ id: ref.__id, cambios }),
      commit: async () => {
        commits += 1;
        for (const { id, cambios } of escrituras) {
          Object.assign(docs.get(id), cambios);
        }
      },
    }),
  };

  return { firestore, escrituras, docs, commits: () => commits };
}

const silencio = () => {};

// --- Logica pura (planificarBackfill) ---------------------------------------------------
//
// Regla D3 del diseno: ausencia TOTAL de valor => 'activo'. Cualquier valor YA presente
// (incluido 'retirado') se deja intacto -- este script rellena lo ausente, nunca corrige.

test('planificarBackfill: doc sin estadoMatricula necesita el default "activo"', () => {
  const plan = planificarBackfill({ nombres: 'Juan' });
  assert.deepEqual(plan, { cambios: { estadoMatricula: 'activo' } });
});

test('planificarBackfill: doc sin ningun campo (objeto vacio) tambien necesita el default', () => {
  const plan = planificarBackfill({});
  assert.deepEqual(plan, { cambios: { estadoMatricula: 'activo' } });
});

test('planificarBackfill: doc con estadoMatricula "activo" ya puesto no se toca', () => {
  assert.equal(planificarBackfill({ estadoMatricula: 'activo' }), null);
});

test('planificarBackfill: doc con estadoMatricula "retirado" (cualquier valor existente) no se toca', () => {
  assert.equal(planificarBackfill({ estadoMatricula: 'retirado' }), null);
});

// --- CLI ----------------------------------------------------------------------------------

test('parsearArgumentos: dry-run salvo que se pida --aplicar explicitamente', () => {
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang']).aplicar, false);
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang', '--aplicar']).aplicar, true);
  assert.equal(parsearArgumentos(['--proyecto', 'tudojang', '--tenant', 'g']).tenant, 'g');
});

// --- El backfill de punta a punta ----------------------------------------------------------

test('backfillEstadoMatricula: en DRY-RUN no escribe absolutamente nada', async () => {
  const { firestore, escrituras, docs, commits } = crearFirestoreFake({
    e1: { tenantId: 't1', nombres: 'Juan' },
  });

  const res = await backfillEstadoMatricula({ firestore, aplicar: false, log: silencio });

  assert.equal(escrituras.length, 0);
  assert.equal(commits(), 0);
  assert.equal(res.corregidos, 0);
  assert.equal(res.pendientes, 1, 'igual debe REPORTAR lo que completaria');
  assert.equal(docs.get('e1').estadoMatricula, undefined);
});

test('backfillEstadoMatricula: con --aplicar materializa "activo" en los docs sin el campo', async () => {
  const { firestore, docs } = crearFirestoreFake({
    e1: { tenantId: 't1', nombres: 'Juan' },
    e2: { tenantId: 't1', nombres: 'Ana' },
  });

  const res = await backfillEstadoMatricula({ firestore, aplicar: true, log: silencio });

  assert.equal(res.corregidos, 2);
  assert.equal(docs.get('e1').estadoMatricula, 'activo');
  assert.equal(docs.get('e2').estadoMatricula, 'activo');
});

test('backfillEstadoMatricula: no toca documentos que ya tienen CUALQUIER valor existente', async () => {
  const { firestore, docs, escrituras } = crearFirestoreFake({
    'e-ya-activo': { tenantId: 't1', estadoMatricula: 'activo' },
    'e-ya-retirado': { tenantId: 't1', estadoMatricula: 'retirado' },
    'e-sin-campo': { tenantId: 't1' },
  });

  await backfillEstadoMatricula({ firestore, aplicar: true, log: silencio });

  assert.equal(escrituras.length, 1);
  assert.equal(escrituras[0].id, 'e-sin-campo');
  assert.equal(docs.get('e-ya-activo').estadoMatricula, 'activo');
  assert.equal(docs.get('e-ya-retirado').estadoMatricula, 'retirado', 'NUNCA pisa un valor existente, ni siquiera retirado');
});

test('backfillEstadoMatricula: es IDEMPOTENTE -- la segunda corrida no cambia nada', async () => {
  const { firestore, docs } = crearFirestoreFake({
    e1: { tenantId: 't1', nombres: 'Juan' },
  });

  const primera = await backfillEstadoMatricula({ firestore, aplicar: true, log: silencio });
  const segunda = await backfillEstadoMatricula({ firestore, aplicar: true, log: silencio });

  assert.equal(primera.corregidos, 1);
  assert.equal(segunda.corregidos, 0);
  assert.equal(segunda.pendientes, 0);
  assert.equal(docs.get('e1').estadoMatricula, 'activo');
});

test('backfillEstadoMatricula: no modifica ningun otro campo del documento (historialPagos, progreso, asistencia)', async () => {
  const { firestore, docs } = crearFirestoreFake({
    e1: { tenantId: 't1', nombres: 'Juan', saldoDeudor: 5000, historialPagos: [{ monto: 1 }] },
  });

  await backfillEstadoMatricula({ firestore, aplicar: true, log: silencio });

  assert.equal(docs.get('e1').nombres, 'Juan');
  assert.equal(docs.get('e1').saldoDeudor, 5000);
  assert.deepEqual(docs.get('e1').historialPagos, [{ monto: 1 }]);
});

test('backfillEstadoMatricula: acotado por --tenant solo alcanza a ese club', async () => {
  const { firestore, docs } = crearFirestoreFake({
    'e-mio': { tenantId: 'gajog' },
    'e-ajeno': { tenantId: 'otro-club' },
  });

  const res = await backfillEstadoMatricula({ firestore, tenant: 'gajog', aplicar: true, log: silencio });

  assert.equal(res.leidos, 1);
  assert.equal(docs.get('e-mio').estadoMatricula, 'activo');
  assert.equal(docs.get('e-ajeno').estadoMatricula, undefined, 'no debe tocar otro tenant');
});
