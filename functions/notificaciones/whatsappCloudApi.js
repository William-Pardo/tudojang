'use strict';

const axios = require('axios');
const { defineSecret } = require('firebase-functions/params');

// Secrets de Firebase Functions v2. Se declaran aca para que el deploy los
// registre y los inyecte via runWith({ secrets: [...] }) en index.js cuando
// exista un callable que use este servicio. La funcion enviarWhatsAppCloudApi
// tambien acepta token/phoneNumberId ya resueltos para poder testear sin
// mockear el SDK de secrets (ver parametros opcionales mas abajo).
const WHATSAPP_CLOUD_API_TOKEN = defineSecret('WHATSAPP_CLOUD_API_TOKEN');
const WHATSAPP_CLOUD_API_PHONE_NUMBER_ID = defineSecret(
  'WHATSAPP_CLOUD_API_PHONE_NUMBER_ID'
);

const WHATSAPP_API_VERSION = 'v20.0';
const WHATSAPP_LANGUAGE_CODE = 'es';

// E.164 sin "+": solo digitos, no puede empezar en 0, entre 7 y 15 digitos.
const TELEFONO_E164_SIN_MAS_REGEX = /^[1-9]\d{6,14}$/;

function esTelefonoValido(telefono) {
  return (
    typeof telefono === 'string' &&
    TELEFONO_E164_SIN_MAS_REGEX.test(telefono.trim())
  );
}

function esPlantillaValida(plantilla) {
  return typeof plantilla === 'string' && plantilla.trim().length > 0;
}

function extraerMensajeErrorMeta(error) {
  const mensajeMeta = error?.response?.data?.error?.message;
  if (mensajeMeta) {
    return mensajeMeta;
  }
  if (error?.message) {
    return error.message;
  }
  return 'Error desconocido al enviar la notificacion de WhatsApp';
}

/**
 * Envia un mensaje de plantilla via Meta WhatsApp Cloud API.
 *
 * @param {object} opciones
 * @param {string} opciones.telefono - Numero E.164 sin "+" (ej: 573001234567).
 * @param {string} opciones.plantilla - Nombre de la plantilla aprobada en Meta.
 * @param {string[]} [opciones.parametros] - Valores posicionales de la plantilla.
 * @param {string} [opciones.token] - Token resuelto (fallback: secret / env).
 * @param {string} [opciones.phoneNumberId] - Phone Number ID resuelto (fallback: secret / env).
 * @returns {Promise<{exito:true,mensajeId:string}|{exito:false,error:string}>}
 */
async function enviarWhatsAppCloudApi({
  telefono,
  plantilla,
  parametros = [],
  token,
  phoneNumberId,
} = {}) {
  const tokenResuelto = token || process.env.WHATSAPP_CLOUD_API_TOKEN || '';
  const phoneNumberIdResuelto =
    phoneNumberId || process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID || '';

  if (!tokenResuelto || !phoneNumberIdResuelto) {
    return {
      exito: false,
      error:
        'Credenciales de WhatsApp Cloud API no configuradas (token o phoneNumberId faltante)',
    };
  }

  if (!esTelefonoValido(telefono)) {
    return {
      exito: false,
      error:
        'Telefono invalido: debe ser un numero en formato E.164 sin "+" (solo digitos)',
    };
  }

  if (!esPlantillaValida(plantilla)) {
    return {
      exito: false,
      error:
        'Plantilla invalida: se requiere el nombre de una plantilla de WhatsApp aprobada',
    };
  }

  const listaParametros = Array.isArray(parametros) ? parametros : [];

  const body = {
    messaging_product: 'whatsapp',
    to: telefono.trim(),
    type: 'template',
    template: {
      name: plantilla.trim(),
      language: { code: WHATSAPP_LANGUAGE_CODE },
      components: [
        {
          type: 'body',
          parameters: listaParametros.map((valor) => ({
            type: 'text',
            text: String(valor),
          })),
        },
      ],
    },
  };

  try {
    const respuesta = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberIdResuelto}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${tokenResuelto}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const mensajeId = respuesta?.data?.messages?.[0]?.id;
    if (!mensajeId) {
      return {
        exito: false,
        error: 'Meta no devolvio un identificador de mensaje valido',
      };
    }

    return { exito: true, mensajeId };
  } catch (error) {
    return {
      exito: false,
      error: extraerMensajeErrorMeta(error),
    };
  }
}

module.exports = {
  enviarWhatsAppCloudApi,
  WHATSAPP_CLOUD_API_TOKEN,
  WHATSAPP_CLOUD_API_PHONE_NUMBER_ID,
};
