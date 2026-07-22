const http = require('http');

process.chdir(require('path').resolve(__dirname, '..', 'functions'));

const catalogoSoporte = require('../functions/generated/soporte/catalogo.v1.json');
const { crearServicioAsistente } = require('../functions/asistente/callable');
const { crearProveedorGemini } = require('../functions/asistente/proveedor');
const { calcularCostoMicros, estimarReservaMicros } = require('../functions/asistente/costos');

const { GoogleGenerativeAI } = require('../functions/node_modules/@google/generative-ai');

const PRECIOS_IA = {
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.4,
};
const LIMITES_IA = {
  user: 50_000,
  tenant: 200_000,
  global: 8_000_000,
};
const RESERVA_IA_MICROS = estimarReservaMicros(
  { maxInputTokens: 1_200, maxOutputTokens: 300 },
  PRECIOS_IA,
  4,
);

let localUsedMicros = 0;

const servicioAsistenteIa = crearServicioAsistente({
  enabled: process.env.ASSISTANT_AI_ENABLED === 'true' && !!process.env.GEMINI_API_KEY,
  catalog: catalogoSoporte,
  provider: async (request) => {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    return crearProveedorGemini({ model })(request);
  },
  reserveQuota: async () => {
    localUsedMicros += RESERVA_IA_MICROS;
    const remaining = {
      user: Math.max(0, LIMITES_IA.user - localUsedMicros),
      tenant: Math.max(0, LIMITES_IA.tenant - localUsedMicros),
      global: Math.max(0, LIMITES_IA.global - localUsedMicros),
    };
    return {
      reservation: { estimatedMicros: RESERVA_IA_MICROS },
      remaining,
    };
  },
  reconcileQuota: async (reservation, actualMicros) => {
    localUsedMicros = Math.max(0, localUsedMicros - reservation.estimatedMicros + actualMicros);
  },
  calculateActualCost: (usage) => calcularCostoMicros(usage, PRECIOS_IA),
  recordTelemetry: async () => undefined,
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20_000) {
        req.destroy();
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  if (req.method !== 'POST' || req.url !== '/consultarAsistenteIa') {
    send(res, 404, { error: { message: 'Not found' } });
    return;
  }

  try {
    const body = await readJson(req);
    const data = body.data ?? body;
    const context = {
      auth: {
        uid: data.__debugUid || 'local-user',
        token: {
          tenantId: data.__debugTenantId || 'local-tenant',
          rol: data.__debugRol || data.role || 'Admin',
        },
      },
      app: { appId: 'local-debug' },
    };

    const result = await servicioAsistenteIa(data, context);
    send(res, 200, { result, data: result });
  } catch (error) {
    send(res, 500, {
      error: {
        code: error.code || 'internal',
        message: error.message || 'No fue posible procesar la consulta',
      },
    });
  }
});

const port = Number(process.env.LOCAL_ASSISTANT_PORT || 5055);
server.listen(port, '127.0.0.1', () => {
  console.log(`Local assistant server listening on http://127.0.0.1:${port}`);
});
