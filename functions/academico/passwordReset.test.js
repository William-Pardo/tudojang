'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicioSendPasswordReset, construirHtml, construirEnlacePropio } = require('./passwordReset');

// Formato REAL que devuelve admin.auth().generatePasswordResetLink() para mode=resetPassword
// (confirmado 2026-07-15 con el link real recibido por el usuario): apunta primero a la
// página genérica de Firebase (authDomain/__/auth/action), no directo a nuestra app.
const LINK_FORMATO_REAL_FIREBASE =
  'https://tudojang.firebaseapp.com/__/auth/action?apiKey=AIzaSyDummy&mode=resetPassword' +
  '&oobCode=vov4O2yrAOY2OnDRdUs4-ao-HAYJnvxiS9WtSX7ec1kAAAGfZwA74A' +
  '&continueUrl=https://tudojang.com/%23/restablecer-clave&lang=en';

function deps(overrides = {}) {
  const enviados = [];
  return {
    enviados,
    dep: {
      auth: {
        getUserByEmail: async () => ({ uid: 'uid-1', displayName: '' }),
        generatePasswordResetLink: async () => LINK_FORMATO_REAL_FIREBASE,
      },
      enviarCorreo: async (_client, msg) => { enviados.push(msg); },
      resend: {},
      appUrl: 'https://tudojang.com',
      ...overrides,
    },
  };
}

test('reescribe el link real de Firebase a nuestra propia página con el oobCode', async () => {
  const { enviados, dep } = deps();
  const servicio = crearServicioSendPasswordReset(dep);

  await servicio({ email: 'carlos@test.com' });

  assert.equal(enviados.length, 1);
  // El correo NO debe contener el link genérico de Firebase...
  assert.doesNotMatch(enviados[0].html, /firebaseapp\.com\/__\/auth\/action/);
  // ...sino el link propio con el oobCode real extraído.
  assert.match(
    enviados[0].html,
    /https:\/\/tudojang\.com\/#\/restablecer-clave\?oobCode=vov4O2yrAOY2OnDRdUs4-ao-HAYJnvxiS9WtSX7ec1kAAAGfZwA74A/
  );
});

test('construirEnlacePropio extrae el oobCode del link real y arma el link propio', () => {
  const propio = construirEnlacePropio(LINK_FORMATO_REAL_FIREBASE, 'https://tudojang.com');
  assert.equal(
    propio,
    'https://tudojang.com/#/restablecer-clave?oobCode=vov4O2yrAOY2OnDRdUs4-ao-HAYJnvxiS9WtSX7ec1kAAAGfZwA74A'
  );
});

test('construirEnlacePropio cae al link original si no encuentra oobCode (defensivo)', () => {
  const propio = construirEnlacePropio('https://sin-oobcode.com/x', 'https://tudojang.com');
  assert.equal(propio, 'https://sin-oobcode.com/x');
});

test('usa resolverNombreReal (Firestore) en vez del prefijo del email o displayName vacío', async () => {
  const { enviados, dep } = deps({
    resolverNombreReal: async (email) => (email === 'carlos.pardo.ia@test.com' ? 'Carlos Pardo' : null),
  });
  const servicio = crearServicioSendPasswordReset(dep);

  await servicio({ email: 'carlos.pardo.ia@test.com' });

  assert.match(enviados[0].html, /Estimado <span[^>]*>Carlos Pardo<\/span>/);
  assert.doesNotMatch(enviados[0].html, />carlos\.pardo\.ia</);
});

test('si resolverNombreReal no encuentra nada, cae a displayName y luego al prefijo del email', async () => {
  const { enviados, dep } = deps({
    auth: {
      getUserByEmail: async () => ({ uid: 'uid-1', displayName: 'Del Auth' }),
      generatePasswordResetLink: async () => LINK_FORMATO_REAL_FIREBASE,
    },
    resolverNombreReal: async () => null,
  });
  const servicio = crearServicioSendPasswordReset(dep);

  await servicio({ email: 'carlos@test.com' });

  assert.match(enviados[0].html, /Estimado <span[^>]*>Del Auth<\/span>/);
});

test('si resolverNombreReal explota, no revienta el envío -- cae al fallback', async () => {
  const { enviados, dep } = deps({
    resolverNombreReal: async () => { throw new Error('Firestore caído'); },
  });
  const servicio = crearServicioSendPasswordReset(dep);

  const res = await servicio({ email: 'carlos@test.com' });

  assert.equal(res.ok, true);
  assert.equal(enviados.length, 1); // igual se envía
});

test('no revela si el email no existe (retorna ok sin enviar, sin error)', async () => {
  const { enviados, dep } = deps({
    auth: {
      getUserByEmail: async () => { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e; },
      generatePasswordResetLink: async () => { throw new Error('no deberia llamarse'); },
    },
  });
  const servicio = crearServicioSendPasswordReset(dep);

  const res = await servicio({ email: 'nadie@test.com' });

  assert.equal(res.ok, true);
  assert.equal(res.enviado, false);
  assert.equal(enviados.length, 0);
});

test('rechaza email invalido', async () => {
  const { dep } = deps();
  const servicio = crearServicioSendPasswordReset(dep);
  await assert.rejects(() => servicio({ email: '' }), /Email invalido/);
  await assert.rejects(() => servicio({ email: 'no-es-email' }), /Email invalido/);
});

test('si el correo (Resend) falla, igual retorna ok con enviado=false (no revienta)', async () => {
  const { dep } = deps({
    enviarCorreo: async () => { throw new Error('Resend rechazo'); },
  });
  const servicio = crearServicioSendPasswordReset(dep);

  const res = await servicio({ email: 'carlos@test.com' });

  assert.equal(res.ok, true);
  assert.equal(res.enviado, false);
});

test('si el dominio no está en Authorized domains, da un mensaje operable (no el generico interno)', async () => {
  const { dep } = deps({
    auth: {
      getUserByEmail: async () => ({ uid: 'uid-1', displayName: 'Carlos' }),
      generatePasswordResetLink: async () => {
        const e = new Error('Domain not allowlisted by project');
        throw e;
      },
    },
  });
  const servicio = crearServicioSendPasswordReset(dep);

  await assert.rejects(
    () => servicio({ email: 'carlos@test.com' }),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      assert.match(err.message, /Authorized domains/);
      assert.match(err.message, /tudojang\.com/);
      return true;
    }
  );
});

test('construirHtml reemplaza ambos placeholders', () => {
  const html = construirHtml({ nombreUsuario: 'Ana', enlaceRecuperacion: 'https://x.com/y' });
  assert.match(html, />Ana<\/span>/);
  assert.match(html, /https:\/\/x\.com\/y/);
  assert.doesNotMatch(html, /\{\{/);
});
