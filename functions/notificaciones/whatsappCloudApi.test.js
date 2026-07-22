'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { enviarWhatsAppCloudApi } = require('./whatsappCloudApi');

const CREDENCIALES_VALIDAS = {
  token: 'token-test-123',
  phoneNumberId: '1234567890',
};

test('enviarWhatsAppCloudApi retorna exito y mensajeId cuando Meta responde 200', async (t) => {
  t.mock.method(axios, 'post', async (url, body, config) => {
    assert.equal(
      url,
      'https://graph.facebook.com/v20.0/1234567890/messages'
    );
    assert.equal(body.messaging_product, 'whatsapp');
    assert.equal(body.to, '573001234567');
    assert.equal(body.type, 'template');
    assert.equal(body.template.name, 'clase_finalizada_notificacion');
    assert.equal(body.template.language.code, 'es');
    assert.deepEqual(
      body.template.components[0].parameters.map((p) => p.text),
      ['Juan Perez', '18:30', 'Sede Norte', 'Taekwondo Infantil']
    );
    assert.equal(config.headers.Authorization, 'Bearer token-test-123');
    return {
      status: 200,
      data: { messages: [{ id: 'wamid.XXX' }] },
    };
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: ['Juan Perez', '18:30', 'Sede Norte', 'Taekwondo Infantil'],
    ...CREDENCIALES_VALIDAS,
  });

  assert.deepEqual(resultado, { exito: true, mensajeId: 'wamid.XXX' });
  assert.equal(axios.post.mock.callCount(), 1);
});

test('enviarWhatsAppCloudApi retorna error sin llamar a axios si falta el token', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('axios no deberia ser invocado');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    token: '',
    phoneNumberId: '1234567890',
  });

  assert.equal(resultado.exito, false);
  assert.ok(resultado.error);
  assert.equal(axios.post.mock.callCount(), 0);
});

test('enviarWhatsAppCloudApi retorna error sin llamar a axios si falta el phoneNumberId', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('axios no deberia ser invocado');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    token: 'token-test-123',
    phoneNumberId: '',
  });

  assert.equal(resultado.exito, false);
  assert.ok(resultado.error);
  assert.equal(axios.post.mock.callCount(), 0);
});

test('enviarWhatsAppCloudApi retorna error sin llamar a axios si el telefono esta vacio', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('axios no deberia ser invocado');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    ...CREDENCIALES_VALIDAS,
  });

  assert.equal(resultado.exito, false);
  assert.ok(resultado.error);
  assert.equal(axios.post.mock.callCount(), 0);
});

test('enviarWhatsAppCloudApi retorna error sin llamar a axios si el telefono no es numerico', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('axios no deberia ser invocado');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '+57-300-abcd',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    ...CREDENCIALES_VALIDAS,
  });

  assert.equal(resultado.exito, false);
  assert.ok(resultado.error);
  assert.equal(axios.post.mock.callCount(), 0);
});

test('enviarWhatsAppCloudApi retorna error sin llamar a axios si la plantilla esta vacia', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('axios no deberia ser invocado');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: '',
    parametros: [],
    ...CREDENCIALES_VALIDAS,
  });

  assert.equal(resultado.exito, false);
  assert.ok(resultado.error);
  assert.equal(axios.post.mock.callCount(), 0);
});

test('enviarWhatsAppCloudApi retorna el mensaje de error de Meta cuando axios rechaza con status 4xx', async (t) => {
  const errorMeta = Object.assign(
    new Error('Request failed with status code 401'),
    {
      response: {
        status: 401,
        data: { error: { message: 'Invalid OAuth access token' } },
      },
    }
  );
  t.mock.method(axios, 'post', async () => {
    throw errorMeta;
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    ...CREDENCIALES_VALIDAS,
  });

  assert.equal(resultado.exito, false);
  assert.equal(resultado.error, 'Invalid OAuth access token');
});

test('enviarWhatsAppCloudApi retorna un error generico cuando axios rechaza por fallo de red', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('Network Error');
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
    ...CREDENCIALES_VALIDAS,
  });

  assert.equal(resultado.exito, false);
  assert.equal(resultado.error, 'Network Error');
});

test('enviarWhatsAppCloudApi usa process.env como fallback cuando no se inyectan credenciales', async (t) => {
  const originalToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const originalPhoneId = process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID;
  process.env.WHATSAPP_CLOUD_API_TOKEN = 'token-env';
  process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID = '999999999';

  t.mock.method(axios, 'post', async (url, body, config) => {
    assert.equal(
      url,
      'https://graph.facebook.com/v20.0/999999999/messages'
    );
    assert.equal(config.headers.Authorization, 'Bearer token-env');
    return { status: 200, data: { messages: [{ id: 'wamid.env' }] } };
  });

  t.after(() => {
    process.env.WHATSAPP_CLOUD_API_TOKEN = originalToken;
    process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID = originalPhoneId;
  });

  const resultado = await enviarWhatsAppCloudApi({
    telefono: '573001234567',
    plantilla: 'clase_finalizada_notificacion',
    parametros: [],
  });

  assert.deepEqual(resultado, { exito: true, mensajeId: 'wamid.env' });
});
