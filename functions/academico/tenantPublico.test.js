const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioResolverTenantPublico } = require('./tenantPublico');

// Fake minimo de Firestore: solo `tenants`, con soporte a where(...).limit(...).get(), unica
// forma de query que usa este servicio. Mismo estilo que crearFirestoreFake en
// academico/sedes.test.js.
function crearFirestoreFake({ tenants = [] } = {}) {
  const tenantsCollection = {
    where: (campo, _op, valor) => ({
      limit: (n) => ({
        get: async () => ({
          docs: tenants
            .filter((t) => t[campo] === valor)
            .slice(0, n)
            .map(({ id, ...data }) => ({ id, data: () => data })),
        }),
      }),
    }),
  };

  return {
    collection: (nombre) => {
      if (nombre === 'tenants') return tenantsCollection;
      throw new Error(`Coleccion no mockeada: ${nombre}`);
    },
  };
}

test('resolverTenantPublico: devuelve solo los campos publicos de un tenant existente', async () => {
  const servicio = crearServicioResolverTenantPublico({
    firestore: crearFirestoreFake({
      tenants: [
        {
          id: 'tenant-1',
          slug: 'cocodrilos',
          nombreClub: 'Cocodrilos TKD',
          colorPrimario: '#111111',
          valorMatricula: 50000,
          pagoNequi: '3001234567',
          estadoSuscripcion: 'activo',
          fechaVencimiento: '2030-01-01',
          // Campo NO publico -- no debe salir nunca de esta funcion.
          wompiPaymentSourceId: 'src_secreto_123',
          representanteLegal: 'Juan Perez',
        },
      ],
    }),
  });

  const resultado = await servicio({ slug: 'cocodrilos' });

  assert.deepEqual(resultado, {
    tenantId: 'tenant-1',
    slug: 'cocodrilos',
    nombreClub: 'Cocodrilos TKD',
    colorPrimario: '#111111',
    valorMatricula: 50000,
    pagoNequi: '3001234567',
    estadoSuscripcion: 'activo',
    fechaVencimiento: '2030-01-01',
  });
  assert.equal('wompiPaymentSourceId' in resultado, false);
  assert.equal('representanteLegal' in resultado, false);
});

test('resolverTenantPublico: normaliza mayusculas/espacios en el slug antes de buscar', async () => {
  const servicio = crearServicioResolverTenantPublico({
    firestore: crearFirestoreFake({
      tenants: [{ id: 'tenant-1', slug: 'cocodrilos', nombreClub: 'Cocodrilos TKD' }],
    }),
  });

  const resultado = await servicio({ slug: '  COCODRILOS  ' });

  assert.equal(resultado.tenantId, 'tenant-1');
});

test('resolverTenantPublico: devuelve null si el slug no existe (mismo contrato que buscarTenantPorSlug)', async () => {
  const servicio = crearServicioResolverTenantPublico({
    firestore: crearFirestoreFake({ tenants: [] }),
  });

  const resultado = await servicio({ slug: 'no-existe' });

  assert.equal(resultado, null);
});

test('resolverTenantPublico: rechaza si falta el slug', async () => {
  const servicio = crearServicioResolverTenantPublico({
    firestore: crearFirestoreFake({ tenants: [] }),
  });

  await assert.rejects(
    () => servicio({}),
    (error) => {
      assert.equal(error.code, 'invalid-argument');
      return true;
    }
  );
});

test('resolverTenantPublico: no requiere auth -- funciona sin `context`', async () => {
  const servicio = crearServicioResolverTenantPublico({
    firestore: crearFirestoreFake({
      tenants: [{ id: 'tenant-1', slug: 'cocodrilos', nombreClub: 'Cocodrilos TKD' }],
    }),
  });

  const resultado = await servicio({ slug: 'cocodrilos' }, undefined);

  assert.equal(resultado.tenantId, 'tenant-1');
});
