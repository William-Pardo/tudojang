// functions/academico/kms.js
// Servicio de cifrado de tokens para seguridad en base de datos.
// Utiliza un cifrado AES-256-GCM robusto en modo local/emulador para permitir pruebas
// sin necesidad de configurar Google Cloud KMS en producción.

'use strict';

const crypto = require('crypto');

// Clave de derivación estática para emulación local/test
const FALLBACK_KEY = crypto.scryptSync('tudojang-secret-salt-key-kms-v1', 'salt-tudojang', 32);

/**
 * Cifra un texto plano (por ejemplo, el refresh_token de Google Drive).
 *
 * @param {string} plaintext - Texto plano a cifrar
 * @returns {Promise<string>} JSON con el contenido cifrado, vector de inicialización y tag de autenticación
 */
const cifrarToken = async (plaintext) => {
  if (!plaintext) {
    throw new Error('El texto a cifrar no puede estar vacío');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FALLBACK_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted,
    tag: authTag
  });
};

/**
 * Descifra un token previamente cifrado.
 *
 * @param {string} ciphertextJson - JSON stringificado que contiene iv, content y tag
 * @returns {Promise<string>} Texto plano descifrado
 */
const descifrarToken = async (ciphertextJson) => {
  if (!ciphertextJson) {
    throw new Error('El contenido a descifrar no puede estar vacío');
  }

  try {
    const { iv, content, tag } = JSON.parse(ciphertextJson);
    if (!iv || !content || !tag) {
      throw new Error('Formato de datos de cifrado inválido');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', FALLBACK_KEY, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error('Error al descifrar token: ' + err.message);
  }
};

module.exports = { cifrarToken, descifrarToken };
