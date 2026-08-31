const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioVerificarDuplicadoAspirante } = require('./verificacionDuplicados');

// Lee un valor por path con dot-notation (ej. 'datos.email') sobre un objeto plano -- mismo
// criterio con el que Firestore real resuelve where('datos.email', '==', x) sobre un mapa
// anidado.
function obtenerValorPorPath(objeto, path) {
  return path.split('.').reduce((acc, clave) => (acc == null ? acc : acc[clave]), objeto);
}

// Fake generico de Firestore: soporta encadenar multiples .where(...) (necesario aca --
// verificacionDuplicados.js encadena hasta 3: tenantId, estado, campo) seguido de
// .limit(n).get(). Mismo estilo que crearFirestoreFake en tenantPublico.test.js, generalizado
// para multiples filtros.
function crearFirestoreFake(colecciones = {}) {
  const construirQuery = (docs, filtros) => ({
    where: (campo, _op, valor) => construirQuery(docs, [...filtros, { campo, valor }]),
    limit: (n) => ({
      get: async () => {
        const coincidencias = docs.filter((d) =>
          filtros.every((f) => obtenerValorPorPath(d, f.campo) === f.valor)
        );
        const limitados = coincidencias.slice(0, n);
        return {
          empty: limitados.length === 0,
          docs: limitados.map(({ id, ...data }) => ({ id, data: () => data })),
        };
      },
    }),
  });

  return {
    collection: (nombre) => {
      const docs = colecciones[nombre] || [];
      return { where: (campo, _op, valor) => construirQuery(docs, [{ campo, valor }]) };
    },
  };
}

test('verificarDuplicadoAspirante: rechaza si falta el tenantId', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ correo: 'a@b.com' }),
    (error) => {
      assert.equal(error.code, 'invalid-argument');
      return true;
    }
  );
});

test('verificarDuplicadoAspirante: rechaza si faltan correo y telefono', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({ firestore: crearFirestoreFake() });

  await assert.rejects(
    () => servicio({ tenantId: 'tenant-1' }),
    (error) => {
      assert.equal(error.code, 'invalid-argument');
      return true;
    }
  );
});

test('verificarDuplicadoAspirante: devuelve ambos en false si no hay coincidencias', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({ estudiantes: [], registros_temporales: [] }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'nadie@correo.com', telefono: '3001234567' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: false });
});

test('verificarDuplicadoAspirante: detecta correo ya usado por un estudiante real', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      estudiantes: [
        { id: 'e1', tenantId: 'tenant-1', correo: 'juan@correo.com', telefono: '3000000000', nombres: 'Juan Secreto' },
      ],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'JUAN@correo.com  ' });

  assert.deepEqual(resultado, { correoExiste: true, telefonoExiste: false });
});

test('verificarDuplicadoAspirante: NUNCA devuelve nombre, id u otro dato del match -- solo los 2 booleanos', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      estudiantes: [
        { id: 'e1', tenantId: 'tenant-1', correo: 'juan@correo.com', nombres: 'Juan Secreto', apellidos: 'Perez' },
      ],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'juan@correo.com' });

  assert.deepEqual(Object.keys(resultado).sort(), ['correoExiste', 'telefonoExiste']);
});

test('verificarDuplicadoAspirante: detecta telefono ya usado, normalizando digitos', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      estudiantes: [{ id: 'e1', tenantId: 'tenant-1', telefono: '3001234567' }],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', telefono: '300-123-4567' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: true });
});

test('verificarDuplicadoAspirante: detecta correo de otra solicitud PENDIENTE en registros_temporales', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      registros_temporales: [
        { id: 'r1', tenantId: 'tenant-1', estado: 'pendiente', datos: { email: 'pendiente@correo.com' } },
      ],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'pendiente@correo.com' });

  assert.deepEqual(resultado, { correoExiste: true, telefonoExiste: false });
});

test('verificarDuplicadoAspirante: detecta telefono de otra solicitud PENDIENTE en registros_temporales', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      registros_temporales: [
        { id: 'r1', tenantId: 'tenant-1', estado: 'pendiente', datos: { telefono: '3009998888' } },
      ],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', telefono: '3009998888' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: true });
});

test('verificarDuplicadoAspirante: una solicitud RECHAZADA/PROCESADA no cuenta como duplicado activo', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      registros_temporales: [
        { id: 'r1', tenantId: 'tenant-1', estado: 'rechazado', datos: { email: 'viejo@correo.com' } },
        { id: 'r2', tenantId: 'tenant-1', estado: 'procesado', datos: { telefono: '3005554444' } },
      ],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'viejo@correo.com', telefono: '3005554444' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: false });
});

test('verificarDuplicadoAspirante: aisla por tenant -- un match de otro tenant no cuenta', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      estudiantes: [{ id: 'e1', tenantId: 'tenant-OTRO', correo: 'compartido@correo.com' }],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'compartido@correo.com' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: false });
});

test('verificarDuplicadoAspirante: evalua correo y telefono de forma independiente', async () => {
  const servicio = crearServicioVerificarDuplicadoAspirante({
    firestore: crearFirestoreFake({
      estudiantes: [{ id: 'e1', tenantId: 'tenant-1', correo: 'solo-correo@correo.com', telefono: '3001112222' }],
    }),
  });

  const resultado = await servicio({ tenantId: 'tenant-1', correo: 'no-coincide@correo.com', telefono: '3001112222' });

  assert.deepEqual(resultado, { correoExiste: false, telefonoExiste: true });
});
