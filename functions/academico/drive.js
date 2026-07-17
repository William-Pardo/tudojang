// functions/academico/drive.js
// Cloud Functions para la integración con Google Drive del módulo de estudio académico.
// Gestiona el flujo OAuth, refresco de tokens, generación de URLs temporales y sincronización de metadatos.

'use strict';

const admin = require('firebase-admin');
const { google } = require('googleapis');
const { cifrarToken, descifrarToken } = require('./kms');

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

// Fix 2026-07-16 (bug reportado: video/pdf/imagen "cargaban" la URL pero nunca reproducían,
// en los 3 roles): la API de Google Drive NO permite acceso directo desde el navegador a
// `files/{id}?alt=media` -- no manda `Access-Control-Allow-Origin`, así que cualquier fetch()
// (react-pdf) lo bloquea el propio navegador por CORS, y <video>/<img> tampoco reciben los
// bytes reales (Google rechaza el pedido igual, con o sin CORS de por medio). La única forma
// de servir el contenido real al navegador es que NUESTRA Cloud Function lo pida server-side
// (ahí no hay CORS, es servidor-a-servidor) y se lo devuelva al navegador desde nuestro propio
// dominio.
//
// Diseño de seguridad (revisión post-primera-versión, que exponía el access_token de Drive
// en una URL pública con CORS '*' sin volver a validar nada -- señalado como debilidad real):
// esta URL NO lleva ningún secreto embebido, solo identificadores (tenantId, fileId, y
// asignacionId O recursoId). `proxyDriveMedia` exige el ID token REAL de Firebase del que
// hace el pedido (header Authorization, igual que cualquier otra llamada autenticada de la
// app) y vuelve a correr las mismas validaciones de rol/tenant/asignación|recurso antes de
// pedirle los bytes a Drive -- es un segundo punto de enforcement independiente, no confía
// en que el llamador ya haya pasado por getTemporaryFileUrl(Recurso).
const REGION_FUNCTIONS = 'us-central1';
function construirUrlProxyDriveMedia({ tenantId, fileId, asignacionId, recursoId }) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'tudojang';
  const base = `https://${REGION_FUNCTIONS}-${projectId}.cloudfunctions.net/proxyDriveMedia`;
  const params = new URLSearchParams({ tenantId, fileId });
  if (asignacionId) params.set('asignacionId', asignacionId);
  if (recursoId) params.set('recursoId', recursoId);
  return `${base}?${params.toString()}`;
}

// Roles que pueden consumir el archivo real de una ASIGNACIÓN (Estudiante consumiendo su
// material, Tutor confirmando qué se le asignó a su hijo, staff revisando). Compartida entre
// `crearServicioGetTemporaryFileUrl` y `crearServicioProxyDriveMedia` -- el proxy vuelve a
// aplicar el MISMO chequeo de forma independiente, no confía en que ya se aplicó antes.
const ROLES_CONSUMO_ASIGNACION = ['Estudiante', 'Maestro', 'Admin', 'SuperAdmin', 'Tutor', 'Editor', 'Asistente'];

const parseConnectionTimestamp = (data = {}) => {
  const candidates = [
    data.connectedAt,
    data.lastRefreshedAt,
    data.folderUpdatedAt,
    data.disconnectedAt
  ];

  for (const value of candidates) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
};

const ordenarDocsPorConexionReciente = (docs = []) => {
  return [...docs].sort((a, b) => {
    const diff = parseConnectionTimestamp(b.data()) - parseConnectionTimestamp(a.data());
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
};

const seleccionarDocMasReciente = (docs = []) => ordenarDocsPorConexionReciente(docs)[0] || null;

const obtenerConexionActivaMasReciente = async (firestore, tenantId) => {
  const connectionsSnap = await firestore
    .collection('tenants')
    .doc(tenantId)
    .collection('driveConnections')
    .where('status', '==', 'active')
    .get();

  if (connectionsSnap.empty) return null;

  const doc = seleccionarDocMasReciente(connectionsSnap.docs);
  return {
    doc,
    data: doc.data(),
    activeCount: connectionsSnap.docs.length
  };
};

const scopeIncluye = (scope = '', requiredScope) => {
  return String(scope).split(/\s+/).includes(requiredScope);
};

const assertScopeDriveReadonly = (scope = '') => {
  if (scope && !scopeIncluye(scope, DRIVE_READONLY_SCOPE)) {
    const error = new Error(
      'Google no autorizo el alcance drive.readonly requerido para listar carpetas. Desconecta y vuelve a conectar Google Drive aceptando el permiso de lectura.'
    );
    error.code = 'permission-denied';
    throw error;
  }
};

const resumirDriveId = (value = '') => {
  const text = String(value || '');
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
};

/**
 * Crea el servicio para generar la URL de autorización OAuth2 de Google Drive.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.googleDriveConfig - Configuración de Google Drive (clientId, clientSecret, redirectUri)
 */
const crearServicioConnectDrive = ({ googleDriveConfig }) => {
  return async (data, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, redirectUri } = data;
    if (!tenantId) {
      throw new Error('El parámetro tenantId es obligatorio');
    }

    // 2. Validar que el invocador sea Admin del mismo tenant (o SuperAdmin)
    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      throw new Error('Solo el Admin del tenant puede conectar Google Drive');
    }

    if (context.auth.token.rol !== 'SuperAdmin' && tenantId !== context.auth.token.tenantId) {
      throw new Error('No autorizado para este tenant');
    }

    // 3. Obtener credenciales de Drive
    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const resolvedRedirectUri = redirectUri || googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !resolvedRedirectUri) {
      throw new Error('Configuración de Google Drive incompleta (clientId, clientSecret o redirectUri faltantes)');
    }

    // 4. Inicializar cliente OAuth2 de Google
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      resolvedRedirectUri
    );

    // 5. Generar URL de consentimiento de Google Drive.
    // drive.readonly permite listar el contenido de una carpeta institucional seleccionada.
    // drive.file no permite recorrer de forma confiable los hijos de una carpeta elegida con Picker.
    const scopes = [
      DRIVE_READONLY_SCOPE,
      GOOGLE_USERINFO_EMAIL_SCOPE
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Imprescindible para obtener el refresh_token
      scope: scopes,
      state: tenantId, // Guardamos el tenantId en el state de OAuth
      prompt: 'consent' // Forzar consentimiento para garantizar la recepción del refresh_token en cada inicio
    });

    return { url };
  };
};

/**
 * Crea el servicio para procesar el callback de OAuth2.
 * Intercambia el código de autorización por tokens, cifra el refresh_token
 * y persiste la conexión en Firestore.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.googleDriveConfig - Configuración de Google Drive
 * @param {object} deps.firestore - Instancia de admin.firestore()
 */
const crearServicioDriveOAuthCallback = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { code, tenantId, redirectUri } = data;
    if (!code || !tenantId) {
      throw new Error('Los parámetros code y tenantId son obligatorios');
    }

    // 2. Validar rol (Admin o SuperAdmin)
    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      throw new Error('Solo el Admin del tenant puede conectar Google Drive');
    }

    if (context.auth.token.rol !== 'SuperAdmin' && tenantId !== context.auth.token.tenantId) {
      throw new Error('No autorizado para este tenant');
    }

    // 3. Obtener credenciales de Drive
    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const resolvedRedirectUri = redirectUri || googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !resolvedRedirectUri) {
      throw new Error('Configuración de Google Drive incompleta (clientId, clientSecret o redirectUri faltantes)');
    }

    // 4. Inicializar cliente OAuth2 y realizar el intercambio de tokens
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      resolvedRedirectUri
    );

    let tokens;
    try {
      const response = await oauth2Client.getToken(code);
      tokens = response.tokens;
    } catch (err) {
      throw new Error('Error al intercambiar el código por tokens: ' + err.message);
    }

    const { access_token, refresh_token, expiry_date, scope } = tokens;

    if (!access_token) {
      throw new Error('No se recibió access_token de Google');
    }

    assertScopeDriveReadonly(scope);

    // 5. Cifrar el refresh_token si viene en la respuesta
    let encryptedRefreshToken = null;
    if (refresh_token) {
      encryptedRefreshToken = await cifrarToken(refresh_token);
    }

    // 6. Guardar en Firestore: tenants/{tenantId}/driveConnections/{connId}
    const connectionsCol = firestore.collection('tenants').doc(tenantId).collection('driveConnections');
    
    // Buscar si ya existe una conexión para reutilizar su ID y no duplicar registros
    const snapshot = await connectionsCol.get();
    const docsExistentes = snapshot.empty ? [] : snapshot.docs;
    const activeDocs = docsExistentes.filter((doc) => doc.data()?.status === 'active');
    const docActivoMasReciente = seleccionarDocMasReciente(activeDocs);
    const docMasReciente = seleccionarDocMasReciente(docsExistentes);
    let connRef;
    let oldData = {};
    if (docActivoMasReciente) {
      connRef = docActivoMasReciente.ref;
      oldData = docActivoMasReciente.data();
    } else if (docMasReciente) {
      connRef = docMasReciente.ref;
      oldData = docMasReciente.data();
    } else {
      connRef = connectionsCol.doc();
    }

    let googleAccountEmail = '';
    try {
      const fetchFn = googleDriveConfig._fetchFn || fetch;
      const tokenInfoResponse = await fetchFn(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access_token)}`
      );
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        googleAccountEmail = typeof tokenInfo.email === 'string' ? tokenInfo.email : '';
      }
    } catch (_) {
      googleAccountEmail = '';
    }

    const connectionData = {
      id: connRef.id,
      tenantId,
      connectedAt: new Date().toISOString(),
      connectedBy: context.auth.uid,
      scope: scope || DRIVE_READONLY_SCOPE,
      expiryDate: expiry_date || (Date.now() + 3600 * 1000),
      status: 'active'
    };

    if (googleAccountEmail) {
      connectionData.googleAccountEmail = googleAccountEmail;
    }

    // Si recibimos un nuevo refresh_token, lo actualizamos. Si no, mantenemos el anterior
    if (encryptedRefreshToken) {
      connectionData.refreshToken = encryptedRefreshToken;
    } else if (
      oldData.refreshToken &&
      oldData.status === 'active' &&
      scopeIncluye(oldData.scope, DRIVE_READONLY_SCOPE)
    ) {
      connectionData.refreshToken = oldData.refreshToken;
    } else {
      throw new Error('No se recibio refresh_token reutilizable con permiso drive.readonly. Desconecta y vuelve a conectar Google Drive para renovar el consentimiento.');
    }

    await connRef.set(connectionData, { merge: true });

    if (encryptedRefreshToken && activeDocs.length > 1) {
      const ahora = new Date().toISOString();
      const connRefId = connRef.id || connRef.path;
      const duplicadas = activeDocs.filter((doc) => {
        const docRefId = doc.ref?.id || doc.ref?.path;
        return doc.ref !== connRef && doc.id !== connRefId && docRefId !== connRefId;
      });

      await Promise.all(duplicadas.map((doc) => doc.ref.set({
        status: 'disconnected',
        disconnectedAt: ahora,
        disconnectedBy: context.auth.uid,
        disconnectedReason: 'replaced_by_new_drive_connection'
      }, { merge: true })));
    }

    return { ok: true, connectionId: connRef.id };
  };
};

/**
 * Crea el servicio para renovar el access_token de Google Drive.
 * Descifra el refresh_token almacenado con KMS, solicita un nuevo access_token
 * a Google y actualiza el documento en Firestore.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.googleDriveConfig - Configuración de Google Drive
 * @param {object} deps.firestore - Instancia de admin.firestore()
 */
const crearServicioRefreshDriveToken = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, connectionId } = data;
    if (!tenantId || !connectionId) {
      throw new Error('Los parámetros tenantId y connectionId son obligatorios');
    }

    // 2. Validar rol (Admin o SuperAdmin)
    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      throw new Error('Solo el Admin del tenant puede renovar el token de Google Drive');
    }

    if (context.auth.token.rol !== 'SuperAdmin' && tenantId !== context.auth.token.tenantId) {
      throw new Error('No autorizado para este tenant');
    }

    // 3. Obtener la conexión existente desde Firestore
    const connRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('driveConnections')
      .doc(connectionId);

    const connSnap = await connRef.get();
    if (!connSnap.exists) {
      throw new Error('No se encontró la conexión de Drive especificada');
    }

    const connData = connSnap.data();
    if (!connData.refreshToken) {
      throw new Error('La conexión no tiene un refresh_token almacenado');
    }

    // 4. Descifrar el refresh_token con KMS
    let plaintextRefreshToken;
    try {
      plaintextRefreshToken = await descifrarToken(connData.refreshToken);
    } catch (err) {
      throw new Error('Error al descifrar el refresh_token: ' + err.message);
    }

    // 5. Obtener credenciales de Drive
    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Configuración de Google Drive incompleta (clientId, clientSecret o redirectUri faltantes)');
    }

    // 6. Inicializar cliente OAuth2 y solicitar nuevo access_token
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });

    let tokens;
    try {
      const response = await oauth2Client.refreshAccessToken();
      tokens = response.credentials;
    } catch (err) {
      // Detectar token revocado explícitamente
      const isRevoked = err.message && (
        err.message.includes('Token has been expired or revoked') ||
        err.message.includes('invalid_grant')
      );
      if (isRevoked) {
        throw new Error('El refresh_token ha sido revocado. El usuario debe reconectar Google Drive.');
      }
      throw new Error('Error al renovar el access_token de Google: ' + err.message);
    }

    const { access_token, refresh_token: new_refresh_token, expiry_date, scope } = tokens;

    if (!access_token) {
      throw new Error('No se recibió access_token de Google en la renovación');
    }

    // 7. Si Google devuelve un nuevo refresh_token, cifrarlo y actualizar
    const updateData = {
      expiryDate: expiry_date || (Date.now() + 3600 * 1000),
      scope: scope || connData.scope,
      status: 'active',
      lastRefreshedAt: new Date().toISOString()
    };

    if (new_refresh_token) {
      updateData.refreshToken = await cifrarToken(new_refresh_token);
    }

    await connRef.set(updateData, { merge: true });

    return {
      ok: true,
      accessToken: access_token,
      expiryDate: updateData.expiryDate
    };
  };
};

/**
 * Crea el servicio para listar archivos y subcarpetas de Google Drive.
 * Usa la conexion activa del tenant y devuelve solo metadatos seguros para la UI.
 *
 * @param {object} deps
 * @param {object} deps.googleDriveConfig
 * @param {object} deps.firestore
 */
const crearServicioListDriveFolder = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, folderId = 'root' } = data || {};
    if (!tenantId) {
      throw new Error('El parámetro tenantId es obligatorio');
    }

    const rolesPermitidos = ['Admin', 'SuperAdmin', 'Maestro', 'Editor'];
    if (!rolesPermitidos.includes(context.auth.token.rol)) {
      const error = new Error('No autorizado para explorar Google Drive');
      error.code = 'permission-denied';
      throw error;
    }

    if (context.auth.token.rol !== 'SuperAdmin' && context.auth.token.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);

    if (!conexionActiva) {
      throw new Error('El tenant no tiene una conexión de Google Drive activa');
    }

    const connData = conexionActiva.data;
    if (!connData.refreshToken) {
      throw new Error('La conexión de Drive no tiene refresh_token almacenado');
    }

    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Configuración de Google Drive incompleta');
    }

    const plaintextRefreshToken = await descifrarToken(connData.refreshToken);
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });

    let accessToken;
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      accessToken = tokenResponse.token;
    } catch (err) {
      throw new Error('Error al obtener access_token de Drive: ' + err.message);
    }

    const safeFolderId = String(folderId || 'root').replace(/'/g, "\\'");
    const query = `'${safeFolderId}' in parents and trashed = false`;
    const fields = 'files(id,name,mimeType,webViewLink,parents,modifiedTime,size)';
    const params = new URLSearchParams({
      q: query,
      fields,
      orderBy: 'folder,name',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      pageSize: '100'
    });
    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

    const fetchFn = googleDriveConfig._fetchFn || fetch;
    const response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.status === 401 || response.status === 403) {
      let detail = '';
      try {
        const rawBody = await response.text();
        if (rawBody) {
          const parsed = JSON.parse(rawBody);
          const googleStatus = parsed?.error?.status;
          const googleMessage = parsed?.error?.message;
          detail = [googleStatus, googleMessage].filter(Boolean).join(': ');
        }
      } catch (_) {
        detail = '';
      }

      console.warn('[drive:listDriveFolder:permission-denied]', {
        tenantId,
        folderId: resumirDriveId(safeFolderId),
        connectionId: conexionActiva.doc.id,
        activeConnections: conexionActiva.activeCount,
        scope: connData.scope || '',
        googleAccountEmail: connData.googleAccountEmail || '',
        googleError: detail || `HTTP ${response.status}`
      });

      const error = new Error(
        detail
          ? `Permisos insuficientes en Drive o token expirado: ${detail}`
          : 'Permisos insuficientes en Drive o token expirado'
      );
      error.code = 'permission-denied';
      throw error;
    }

    if (response.status === 404) {
      const error = new Error('Carpeta inaccesible o eliminada en Drive');
      error.code = 'not-found';
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Error al listar carpeta Drive: HTTP ${response.status}`);
    }

    const body = await response.json();
    const files = Array.isArray(body.files) ? body.files : [];

    return {
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        parents: file.parents,
        modifiedTime: file.modifiedTime,
        size: file.size === undefined ? undefined : Number(file.size)
      }))
    };
  };
};

/**
 * Crea el servicio para desconectar Google Drive de un tenant.
 * Marca las conexiones activas como desconectadas y revoca el refresh_token cuando Google lo permite.
 *
 * @param {object} deps
 * @param {object} deps.googleDriveConfig
 * @param {object} deps.firestore
 */
const crearServicioDisconnectDrive = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId } = data || {};
    if (!tenantId) {
      throw new Error('El parÃ¡metro tenantId es obligatorio');
    }

    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      const error = new Error('Solo el Admin del tenant puede desconectar Google Drive');
      error.code = 'permission-denied';
      throw error;
    }

    if (context.auth.token.rol !== 'SuperAdmin' && context.auth.token.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    const connectionsSnap = await firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('driveConnections')
      .where('status', '==', 'active')
      .get();

    if (connectionsSnap.empty) {
      return { ok: true, disconnectedCount: 0 };
    }

    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    const ahora = new Date().toISOString();

    let disconnectedCount = 0;
    for (const doc of connectionsSnap.docs) {
      const connData = doc.data();
      let revokeError = null;

      if (connData.refreshToken && clientId && clientSecret && redirectUri) {
        try {
          const plaintextRefreshToken = await descifrarToken(connData.refreshToken);
          const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
          await oauth2Client.revokeToken(plaintextRefreshToken);
        } catch (err) {
          revokeError = err.message || 'No se pudo revocar el token en Google';
        }
      }

      const updateData = {
        status: 'disconnected',
        disconnectedAt: ahora,
        disconnectedBy: context.auth.uid,
        folderId: admin.firestore.FieldValue.delete(),
        activeFolderId: admin.firestore.FieldValue.delete()
      };

      if (revokeError) {
        updateData.revokeError = revokeError;
      } else {
        updateData.revokeError = admin.firestore.FieldValue.delete();
      }

      await doc.ref.set(updateData, { merge: true });
      disconnectedCount += 1;
    }

    return { ok: true, disconnectedCount };
  };
};

/**
 * Devuelve la conexion activa de Drive para un tenant, incluyendo carpeta activa.
 *
 * @param {object} deps
 * @param {object} deps.firestore
 */
const crearServicioGetDriveConnection = ({ firestore }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId } = data || {};
    if (!tenantId) {
      throw new Error('El parámetro tenantId es obligatorio');
    }

    const rolesPermitidos = ['Admin', 'SuperAdmin', 'Maestro', 'Editor'];
    if (!rolesPermitidos.includes(context.auth.token.rol)) {
      const error = new Error('No autorizado para consultar Google Drive');
      error.code = 'permission-denied';
      throw error;
    }

    if (context.auth.token.rol !== 'SuperAdmin' && context.auth.token.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);

    if (!conexionActiva) {
      return { connected: false };
    }

    const doc = conexionActiva.doc;
    const connData = conexionActiva.data;
    const activeFolderId = connData.activeFolderId || connData.folderId || '';

      return {
        connected: true,
        connectionId: doc.id,
        activeFolderId,
        activeFolderName: connData.activeFolderName || connData.folderName || '',
        googleAccountEmail: connData.googleAccountEmail || '',
        status: connData.status || 'active'
      };
  };
};

/**
 * Persiste la carpeta activa de Drive en la conexion activa del tenant.
 *
 * @param {object} deps
 * @param {object} deps.firestore
 */
const crearServicioSetDriveFolder = ({ firestore }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, folderId, folderName } = data || {};
    if (!tenantId || !folderId) {
      throw new Error('Los parámetros tenantId y folderId son obligatorios');
    }

    if (
      context.auth.token.rol !== 'Admin' &&
      context.auth.token.rol !== 'SuperAdmin'
    ) {
      const error = new Error('Solo el Admin del tenant puede definir la carpeta activa de Drive');
      error.code = 'permission-denied';
      throw error;
    }

    if (context.auth.token.rol !== 'SuperAdmin' && context.auth.token.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);

    if (!conexionActiva) {
      throw new Error('El tenant no tiene una conexión de Google Drive activa');
    }

    const doc = conexionActiva.doc;
    const activeFolderId = String(folderId).trim();
    if (!activeFolderId) {
      throw new Error('El parámetro folderId no puede estar vacío');
    }
    const activeFolderName = String(folderName || '').trim();

    const updateData = {
      activeFolderId,
      folderId: activeFolderId,
      folderUpdatedAt: new Date().toISOString(),
      folderUpdatedBy: context.auth.uid
    };

    if (activeFolderName) {
      updateData.activeFolderName = activeFolderName;
      updateData.folderName = activeFolderName;
    }

    await doc.ref.set(updateData, { merge: true });

    return {
      ok: true,
      connectionId: doc.id,
      activeFolderId,
      activeFolderName
    };
  };
};

/**
 * Crea el servicio para generar URLs temporales de acceso a archivos de Drive.
 * Valida rol del solicitante, tenantId, existencia de asignación activa y genera
 * un enlace de descarga temporal (15 minutos) usando el access_token del tenant.
 * Si el archivo fue eliminado, marca el recurso como `inaccesible` y bloquea la asignación.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.googleDriveConfig - Configuración OAuth de Google Drive
 * @param {object} deps.firestore - Instancia de admin.firestore()
 */
const crearServicioGetTemporaryFileUrl = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, asignacionId, fileId } = data;

    // 2. Validar parámetros requeridos
    if (!tenantId || !asignacionId || !fileId) {
      throw new Error('Los parámetros tenantId, asignacionId y fileId son obligatorios');
    }

    // 3. Roles con acceso al archivo real de Drive.
    // Fix 2026-07-16 (bug reportado: Tutor veía el material listado pero al abrirlo recibía
    // "Permisos insuficientes"): se agrega Tutor -- puede VER el contenido para confirmar que
    // el material correcto fue asignado a su hijo, igual que ya podía Estudiante/Maestro/Admin.
    // También Editor/Asistente, para la Vista previa reutilizada en Biblioteca (poder abrir el
    // contenido real de un recurso antes de aprobarlo/asignarlo, mismos roles que ya gestionan
    // la Biblioteca vía isInstructor() en firestore.rules).
    // El registro de actividad/consumo sigue atado a que el llamador pase estudianteId (ver
    // useRegistrarActividad) -- CentroEstudios.tsx solo lo pasa cuando el que mira es el propio
    // Estudiante, nunca cuando es un Tutor/staff revisando, así que esto NO infla métricas.
    if (!context.auth.token.rol || !ROLES_CONSUMO_ASIGNACION.includes(context.auth.token.rol)) {
      const error = new Error('No autorizado para acceder a recursos académicos');
      error.code = 'permission-denied';
      throw error;
    }

    // 4. Validar que el tenantId coincida (excepto SuperAdmin)
    if (
      context.auth.token.rol !== 'SuperAdmin' &&
      context.auth.token.tenantId !== tenantId
    ) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    // 5. Verificar que la asignación existe, está activa y el estudiante es destinatario
    const asignacionRef = firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('asignaciones')
      .doc(asignacionId);

    const asignacionSnap = await asignacionRef.get();
    if (!asignacionSnap.exists) {
      const error = new Error('La asignación especificada no existe');
      error.code = 'not-found';
      throw error;
    }

    const asignacion = asignacionSnap.data();
    const ahora = new Date();

    // Verificar que la asignación corresponde al tenant correcto
    if (asignacion.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    // Verificar que la asignación esté en estado activo (no vencida, no bloqueada).
    // Fix 2026-07-16: el chequeo comparaba contra ['activa', 'en_progreso'], valores que
    // el sistema real NUNCA persiste -- crearServicioPublishAsignacion(esBatch) siempre
    // escribe estado: 'publicada' (ver EstadoAsignacionAcademica en models/academico/asignacion.ts).
    // Esto bloqueaba con permission-denied el acceso a CUALQUIER archivo de Drive (video,
    // pdf, imagen) para toda asignación publicada normalmente. El test que "cubría" esto
    // usaba un fixture con estado: 'activa', un valor inventado que nunca ocurre en producción.
    const estadosValidos = ['publicada'];
    if (!estadosValidos.includes(asignacion.estado)) {
      const error = new Error(
        `Acceso denegado: la asignación está en estado '${asignacion.estado}'`
      );
      error.code = 'permission-denied';
      throw error;
    }

    // Verificar fecha de apertura
    if (asignacion.fechaApertura) {
      const fechaApertura = asignacion.fechaApertura instanceof Date
        ? asignacion.fechaApertura
        : asignacion.fechaApertura.toDate ? asignacion.fechaApertura.toDate() : new Date(asignacion.fechaApertura);
      if (ahora < fechaApertura) {
        const error = new Error('La asignación aún no está disponible');
        error.code = 'permission-denied';
        throw error;
      }
    }

    // Verificar fecha de cierre
    if (asignacion.fechaCierre) {
      const fechaCierre = asignacion.fechaCierre instanceof Date
        ? asignacion.fechaCierre
        : asignacion.fechaCierre.toDate ? asignacion.fechaCierre.toDate() : new Date(asignacion.fechaCierre);
      if (ahora > fechaCierre) {
        const error = new Error('La asignación ha vencido');
        error.code = 'permission-denied';
        throw error;
      }
    }

    // 6. Obtener la conexión de Drive activa del tenant
    const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);

    if (!conexionActiva) {
      throw new Error('El tenant no tiene una conexión de Google Drive activa');
    }

    const connData = conexionActiva.data;
    if (!connData.refreshToken) {
      throw new Error('La conexión de Drive no tiene refresh_token almacenado');
    }

    // 7. Obtener credenciales y refrescar el access_token
    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Configuración de Google Drive incompleta');
    }

    const plaintextRefreshToken = await descifrarToken(connData.refreshToken);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });

    let accessToken;
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      accessToken = tokenResponse.token;
    } catch (err) {
      throw new Error('Error al obtener access_token de Drive: ' + err.message);
    }

    // 8. Verificar que el archivo existe en Drive y generar la URL temporal
    // La URL temporal (a nuestro proxy, ver construirUrlProxyDriveMedia) tiene una duración
    // efectiva de ~15 min (el access_token de Google expira en 3600s, pero se usa esa convención)

    // Verificar que el archivo existe haciendo una solicitud de metadatos
    const driveMetaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed`;
    let fileMeta;
    try {
      const fetchFn = googleDriveConfig._fetchFn || fetch;
      const metaResponse = await fetchFn(driveMetaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (metaResponse.status === 404) {
        throw new Error('FILE_NOT_FOUND');
      }

      if (!metaResponse.ok) {
        throw new Error(`Error de Drive: ${metaResponse.status}`);
      }

      fileMeta = await metaResponse.json();
    } catch (err) {
      if (err.message === 'FILE_NOT_FOUND' || err.message.includes('404')) {
        // Marcar el recurso como inaccesible y bloquear la asignación
        await asignacionRef.set({ estado: 'bloqueada', motivoBloqueo: 'archivo_eliminado' }, { merge: true });

        // Actualizar el recurso académico si tenemos el recursoId
        if (asignacion.recursoId) {
          await firestore
            .collection('tenants')
            .doc(tenantId)
            .collection('recursos')
            .doc(asignacion.recursoId)
            .set({ estado: 'inaccesible', motivoInaccesible: 'archivo_eliminado_de_drive' }, { merge: true });
        }

        const error = new Error('El archivo ya no existe en Google Drive. La asignación ha sido bloqueada.');
        error.code = 'not-found';
        error.archivoBloqueado = true;
        throw error;
      }
      throw new Error('Error verificando archivo en Drive: ' + err.message);
    }

    if (fileMeta.trashed) {
      // El archivo fue enviado a la papelera
      await asignacionRef.set({ estado: 'bloqueada', motivoBloqueo: 'archivo_en_papelera' }, { merge: true });

      if (asignacion.recursoId) {
        await firestore
          .collection('tenants')
          .doc(tenantId)
          .collection('recursos')
          .doc(asignacion.recursoId)
          .set({ estado: 'inaccesible', motivoInaccesible: 'archivo_en_papelera_de_drive' }, { merge: true });
      }

      const error = new Error('El archivo está en la papelera de Drive. La asignación ha sido bloqueada.');
      error.code = 'not-found';
      error.archivoBloqueado = true;
      throw error;
    }

    // 9. Generar la URL temporal -- apunta a NUESTRO proxy (ver construirUrlProxyDriveMedia),
    // no a googleapis.com directo (Drive no manda CORS para alt=media, el navegador nunca
    // puede pedirlo directo).
    // La URL expira cuando expira el access_token (máx 1h, usamos la convención de 15 min para la UI)
    const expiresAt = new Date(ahora.getTime() + 15 * 60 * 1000).toISOString();
    const temporaryUrl = construirUrlProxyDriveMedia({ tenantId, fileId, asignacionId });

    return {
      ok: true,
      url: temporaryUrl,
      fileName: fileMeta.name,
      mimeType: fileMeta.mimeType,
      expiresAt
    };
  };
};

// Roles que pueden previsualizar un recurso de la Biblioteca (mismo criterio que
// isInstructor() en firestore.rules -- son quienes ya pueden crear/editar/aprobar
// recursos ahí, así que ya tienen acceso administrativo a esos archivos).
const ROLES_PREVIEW_BIBLIOTECA = ['Admin', 'SuperAdmin', 'Editor', 'Asistente', 'Maestro'];

/**
 * Vista previa de un recurso de la Biblioteca, para Admin/Editor/Asistente/Maestro --
 * pedido explícito del usuario (2026-07-16): "para que puedan ver los materiales así
 * asegurar la asignación del material correcto... dar más confianza sobre el archivo".
 *
 * A diferencia de `crearServicioGetTemporaryFileUrl` (que exige una AsignacionAcademica
 * real, publicada y vigente -- consumo por un estudiante), esta función valida
 * directamente contra el recurso de Biblioteca: no depende de que exista ninguna
 * asignación, para poder previsualizar un archivo ANTES de asignarlo a una clase.
 * Se deja standalone (no reutiliza el cuerpo de crearServicioGetTemporaryFileUrl) a
 * propósito: esa función tiene 126 tests cubriendo el camino de consumo real y no vale
 * la pena arriesgar una regresión ahí por compartir código con un flujo administrativo
 * distinto.
 */
const crearServicioGetTemporaryFileUrlRecurso = ({ googleDriveConfig, firestore }) => {
  return async (data, context) => {
    if (!context.auth) {
      throw new Error('No autenticado');
    }

    const { tenantId, recursoId } = data;
    if (!tenantId || !recursoId) {
      throw new Error('Los parámetros tenantId y recursoId son obligatorios');
    }

    if (!context.auth.token.rol || !ROLES_PREVIEW_BIBLIOTECA.includes(context.auth.token.rol)) {
      const error = new Error('No autorizado para previsualizar recursos de la biblioteca');
      error.code = 'permission-denied';
      throw error;
    }

    if (context.auth.token.rol !== 'SuperAdmin' && context.auth.token.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    const recursoRef = firestore.collection('tenants').doc(tenantId).collection('recursos').doc(recursoId);
    const recursoSnap = await recursoRef.get();
    if (!recursoSnap.exists) {
      const error = new Error('El recurso especificado no existe');
      error.code = 'not-found';
      throw error;
    }

    const recurso = recursoSnap.data();
    if (recurso.tenantId !== tenantId) {
      const error = new Error('No autorizado para este tenant');
      error.code = 'permission-denied';
      throw error;
    }

    if (!recurso.externalFileId) {
      const error = new Error('El recurso no tiene un archivo de Drive asociado');
      error.code = 'failed-precondition';
      throw error;
    }

    const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);
    if (!conexionActiva) {
      throw new Error('El tenant no tiene una conexión de Google Drive activa');
    }
    const connData = conexionActiva.data;
    if (!connData.refreshToken) {
      throw new Error('La conexión de Drive no tiene refresh_token almacenado');
    }

    const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Configuración de Google Drive incompleta');
    }

    const plaintextRefreshToken = await descifrarToken(connData.refreshToken);
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });

    let accessToken;
    try {
      const tokenResponse = await oauth2Client.getAccessToken();
      accessToken = tokenResponse.token;
    } catch (err) {
      throw new Error('Error al obtener access_token de Drive: ' + err.message);
    }

    const fileId = recurso.externalFileId;
    const driveMetaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,trashed`;

    let fileMeta;
    try {
      const fetchFn = googleDriveConfig._fetchFn || fetch;
      const metaResponse = await fetchFn(driveMetaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (metaResponse.status === 404) {
        const error = new Error('El archivo ya no existe en Google Drive.');
        error.code = 'not-found';
        throw error;
      }
      if (!metaResponse.ok) {
        throw new Error(`Error de Drive: ${metaResponse.status}`);
      }
      fileMeta = await metaResponse.json();
    } catch (err) {
      if (err.code === 'not-found') throw err;
      throw new Error('Error verificando archivo en Drive: ' + err.message);
    }

    if (fileMeta.trashed) {
      const error = new Error('El archivo está en la papelera de Drive.');
      error.code = 'not-found';
      throw error;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return {
      ok: true,
      url: construirUrlProxyDriveMedia({ tenantId, fileId, recursoId }),
      fileName: fileMeta.name,
      mimeType: fileMeta.mimeType,
      expiresAt,
    };
  };
};

// Orígenes desde los que se puede llamar a proxyDriveMedia. A diferencia de un '*' abierto,
// esto acota qué páginas pueden efectivamente leer la respuesta vía fetch() (react-pdf) --
// <video>/<img> no lo necesitan para reproducir, pero fetch() sí lo exige.
const ORIGENES_PROXY_PERMITIDOS = new Set([
  'https://tudojang.com',
  'https://tudojang.web.app',
  'https://tudojang.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
]);

function resolverOrigenCorsProxy(req) {
  const origin = req.headers && req.headers.origin;
  return origin && ORIGENES_PROXY_PERMITIDOS.has(origin) ? origin : null;
}

// Gotcha real de Drive (bug reportado 2026-07-16: "el pdf no reproduce, permisos
// insuficientes" -- solo con PDF, video e imagen andaban bien con el mismo código):
// `files/{id}?alt=media` SOLO sirve para archivos binarios subidos tal cual. Los archivos
// nativos de Google (creados/editados con Docs, Slides o Sheets -- típico si un
// instructor redactó el material directo en Google Docs en vez de subir un .pdf) no tienen
// bytes propios y Drive rechaza `alt=media` con 403, sin importar los permisos reales del
// usuario. Para esos hay que pedir `/export?mimeType=...` en su lugar. BibliotecaView.tsx
// no filtra el picker de Drive por tipo (ver `describirTipoArchivo`), así que un instructor
// puede asignar perfectamente un Google Doc como "material PDF".
const EXPORT_MIME_POR_TIPO_NATIVO = {
  'application/vnd.google-apps.document': 'application/pdf',
  'application/vnd.google-apps.presentation': 'application/pdf',
  'application/vnd.google-apps.spreadsheet': 'application/pdf',
};

/**
 * Proxy HTTP (onRequest, no callable) que sirve los bytes reales de un archivo de Drive al
 * navegador. Necesario porque `googleapis.com/drive/v3/files/{id}?alt=media` no manda
 * `Access-Control-Allow-Origin` -- ver el comentario extenso junto a
 * `construirUrlProxyDriveMedia` más arriba en este archivo.
 *
 * SEGURIDAD (diseño revisado -- la primera versión confiaba ciegamente en un access_token de
 * Drive embebido en una URL pública con CORS abierto a cualquier origen, sin volver a validar
 * nada): este endpoint exige el ID token REAL de Firebase de quien hace el pedido (header
 * `Authorization: Bearer <idToken>`, igual que cualquier llamada autenticada del resto de la
 * app) y vuelve a correr las MISMAS validaciones de rol/tenant/asignación (o recurso, para el
 * modo Vista previa de Biblioteca) que ya corren `getTemporaryFileUrl`/
 * `getTemporaryFileUrlRecurso` -- es un segundo punto de enforcement independiente, no confía
 * en que el llamador ya pasó por esas funciones. El access_token de Drive en sí NUNCA sale de
 * este servidor: se vuelve a generar acá mismo a partir de la conexión del tenant.
 *
 * Simplificación deliberada (no soporta `Range` -- sin scrubbing fino de video, se descarga
 * completo antes de reproducir): dado el tamaño típico de los materiales de la app y la
 * urgencia de la entrega, se prioriza correctitud sobre soporte de streaming parcial. Queda
 * anotado como mejora futura si algún video real resulta demasiado pesado.
 */
const crearServicioProxyDriveMedia = ({ googleDriveConfig, firestore, auth }) => {
  return async (req, res) => {
    const origenPermitido = resolverOrigenCorsProxy(req);
    if (origenPermitido) {
      res.set('Access-Control-Allow-Origin', origenPermitido);
      res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // 1. Exigir y verificar el ID token REAL de Firebase (no un token de Drive).
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).send('Falta el token de autenticación');
      return;
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      res.status(401).send('Token de autenticación inválido');
      return;
    }

    const rol = decodedToken.rol;
    const { tenantId, fileId, asignacionId, recursoId } = req.query;

    if (!tenantId || !fileId || (!asignacionId && !recursoId)) {
      res.status(400).send('Parámetros obligatorios: tenantId, fileId, y asignacionId o recursoId');
      return;
    }

    if (rol !== 'SuperAdmin' && decodedToken.tenantId !== tenantId) {
      res.status(403).send('No autorizado para este tenant');
      return;
    }

    // 2. Re-validar acceso: consumo real (asignación) o vista previa de Biblioteca (recurso).
    if (asignacionId) {
      if (!rol || !ROLES_CONSUMO_ASIGNACION.includes(rol)) {
        res.status(403).send('No autorizado para acceder a recursos académicos');
        return;
      }

      const asignacionSnap = await firestore
        .collection('tenants').doc(tenantId).collection('asignaciones').doc(asignacionId).get();

      if (!asignacionSnap.exists) {
        res.status(404).send('La asignación especificada no existe');
        return;
      }

      const asignacion = asignacionSnap.data();
      if (asignacion.tenantId !== tenantId || asignacion.estado !== 'publicada') {
        res.status(403).send('Acceso denegado a esta asignación');
        return;
      }

      const ahora = new Date();
      if (asignacion.fechaApertura && ahora < new Date(asignacion.fechaApertura)) {
        res.status(403).send('La asignación aún no está disponible');
        return;
      }
      if (asignacion.fechaCierre && ahora > new Date(asignacion.fechaCierre)) {
        res.status(403).send('La asignación ha vencido');
        return;
      }
    } else {
      if (!rol || !ROLES_PREVIEW_BIBLIOTECA.includes(rol)) {
        res.status(403).send('No autorizado para previsualizar recursos de la biblioteca');
        return;
      }

      const recursoSnap = await firestore
        .collection('tenants').doc(tenantId).collection('recursos').doc(recursoId).get();

      if (!recursoSnap.exists || recursoSnap.data().tenantId !== tenantId) {
        res.status(404).send('El recurso especificado no existe');
        return;
      }
    }

    // 3. Recién acá se genera el access_token real de Drive -- siempre server-side, nunca
    // viaja hacia el navegador en ningún momento de este flujo.
    let accessToken;
    try {
      const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tenantId);
      if (!conexionActiva || !conexionActiva.data.refreshToken) {
        res.status(500).send('El tenant no tiene una conexión de Google Drive activa');
        return;
      }

      const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        res.status(500).send('Configuración de Google Drive incompleta');
        return;
      }

      const plaintextRefreshToken = await descifrarToken(conexionActiva.data.refreshToken);
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });
      const tokenResponse = await oauth2Client.getAccessToken();
      accessToken = tokenResponse.token;
    } catch (err) {
      console.error('[proxyDriveMedia] error obteniendo access_token:', err && err.message);
      res.status(500).send('Error al conectar con Google Drive');
      return;
    }

    // 4. Traer los bytes reales del archivo y devolverlos.
    try {
      const fetchFn = (googleDriveConfig && googleDriveConfig._fetchFn) || fetch;

      // Los archivos nativos de Google (Docs/Slides/Sheets) no tienen bytes descargables
      // vía alt=media -- hay que consultar el mimeType real y, si es nativo, pedir /export.
      const metaResponse = await fetchFn(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaResponse.ok) {
        res.status(metaResponse.status).send('No se pudo verificar el archivo de Drive');
        return;
      }

      const { mimeType } = await metaResponse.json();
      const exportMimeType = EXPORT_MIME_POR_TIPO_NATIVO[mimeType];
      const driveUrl = exportMimeType
        ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`
        : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

      const driveResponse = await fetchFn(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

      if (!driveResponse.ok) {
        res.status(driveResponse.status).send('No se pudo obtener el archivo de Drive');
        return;
      }

      const buffer = Buffer.from(await driveResponse.arrayBuffer());
      const contentType = exportMimeType || (driveResponse.headers && driveResponse.headers.get && driveResponse.headers.get('content-type'));
      if (contentType) res.set('Content-Type', contentType);
      res.status(200).send(buffer);
    } catch (err) {
      console.error('[proxyDriveMedia] error:', err && err.message);
      res.status(500).send('Error al obtener el archivo de Drive');
    }
  };
};

/**
 * Crea el servicio para sincronizar metadatos de archivos de Google Drive.
 * Detecta si los archivos fueron renombrados, movidos o eliminados.
 * Si un archivo fue eliminado, marca el recurso como 'inaccesible', bloquea
 * asignaciones relacionadas y emite una alerta para el administrador del tenant.
 *
 * @param {object} deps - Dependencias inyectadas
 * @param {object} deps.googleDriveConfig - Configuración OAuth de Google Drive
 * @param {object} deps.firestore - Instancia de admin.firestore()
 */
const crearServicioSyncDriveMetadata = ({ googleDriveConfig, firestore }) => {
  return async (req, res) => {
    // 1. Detectar si es una confirmación de canal de sincronización de Google (webhook check)
    const resourceState = req.headers['x-goog-resource-state'];
    if (resourceState === 'sync') {
      console.log('Google Drive sync webhook channel verified.');
      return res.status(200).send('OK');
    }

    // 2. Obtener parámetros de la petición o encabezados del webhook
    const tenantId = req.query.tenantId || req.body?.tenantId;
    const fileId = req.query.fileId || req.body?.fileId || req.query.externalFileId || req.body?.externalFileId || req.headers['x-goog-resource-id'];

    if (!tenantId && !fileId) {
      return res.status(400).json({ error: 'Falta tenantId o fileId para realizar la sincronización' });
    }

    try {
      let recursosToSync = [];

      // Caso A: Se especificó un fileId
      if (fileId) {
        if (tenantId) {
          const recursosSnap = await firestore
            .collection('tenants')
            .doc(tenantId)
            .collection('recursos')
            .where('externalFileId', '==', fileId)
            .get();
          recursosSnap.forEach(doc => recursosToSync.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
        } else {
          const recursosSnap = await firestore
            .collectionGroup('recursos')
            .where('externalFileId', '==', fileId)
            .get();
          recursosSnap.forEach(doc => recursosToSync.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
        }

        // Si no se encontró ningún recurso con ese fileId, ver si coincide con folderId de alguna conexión
        if (recursosToSync.length === 0) {
          const connSnap = await firestore
            .collectionGroup('driveConnections')
            .where('folderId', '==', fileId)
            .get();
          
          for (const connDoc of connSnap.docs) {
            const connData = connDoc.data();
            const tId = connData.tenantId;
            const recursosSnap = await firestore
              .collection('tenants')
              .doc(tId)
              .collection('recursos')
              .get();
            recursosSnap.forEach(doc => recursosToSync.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
          }
        }
      }
      // Caso B: Solo se especificó tenantId (sincronizar toda la biblioteca de ese tenant)
      else if (tenantId) {
        const recursosSnap = await firestore
          .collection('tenants')
          .doc(tenantId)
          .collection('recursos')
          .get();
        recursosSnap.forEach(doc => recursosToSync.push({ id: doc.id, ref: doc.ref, data: doc.data() }));
      }

      if (recursosToSync.length === 0) {
        return res.status(200).json({ message: 'No se encontraron recursos para sincronizar', syncedCount: 0 });
      }

      // Agrupar recursos por tenant para optimizar renovación de tokens
      const resourcesByTenant = {};
      recursosToSync.forEach(item => {
        const tId = item.data.tenantId || tenantId;
        if (!resourcesByTenant[tId]) {
          resourcesByTenant[tId] = [];
        }
        resourcesByTenant[tId].push(item);
      });

      const results = [];
      const clientId = googleDriveConfig.clientId || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = googleDriveConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = googleDriveConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
      const fetchFn = googleDriveConfig._fetchFn || fetch;

      for (const tId of Object.keys(resourcesByTenant)) {
        const conexionActiva = await obtenerConexionActivaMasReciente(firestore, tId);

        if (!conexionActiva) {
          results.push({ tenantId: tId, status: 'no_active_connection', count: resourcesByTenant[tId].length });
          continue;
        }

        const connData = conexionActiva.data;
        if (!connData.refreshToken) {
          results.push({ tenantId: tId, status: 'missing_refresh_token', count: resourcesByTenant[tId].length });
          continue;
        }

        let accessToken;
        try {
          const plaintextRefreshToken = await descifrarToken(connData.refreshToken);
          const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
          oauth2Client.setCredentials({ refresh_token: plaintextRefreshToken });
          const tokenResponse = await oauth2Client.getAccessToken();
          accessToken = tokenResponse.token;
        } catch (err) {
          results.push({ tenantId: tId, status: 'auth_error', error: err.message });
          continue;
        }

        const tenantResults = [];
        for (const item of resourcesByTenant[tId]) {
          const recurso = item.data;
          const recursoRef = item.ref;
          const extId = recurso.externalFileId;
          const driveMetaUrl = `https://www.googleapis.com/drive/v3/files/${extId}?fields=id,name,mimeType,size,version,modifiedTime,trashed`;

          let isDeleted = false;
          let isTrashed = false;
          let fileMeta = null;

          try {
            const response = await fetchFn(driveMetaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            if (response.status === 404) {
              isDeleted = true;
            } else if (!response.ok) {
              throw new Error(`Google API status ${response.status}`);
            } else {
              fileMeta = await response.json();
              if (fileMeta.trashed) {
                isTrashed = true;
              }
            }
          } catch (err) {
            if (err.message === 'FILE_NOT_FOUND' || err.message.includes('404')) {
              isDeleted = true;
            } else {
              tenantResults.push({ id: item.id, status: 'error', error: err.message });
              continue;
            }
          }

          const ahoraStr = new Date().toISOString();

          if (isDeleted || isTrashed) {
            const motivo = isDeleted ? 'archivo_eliminado_de_drive' : 'archivo_en_papelera_de_drive';
            const motivoBloqueo = isDeleted ? 'archivo_eliminado' : 'archivo_en_papelera';

            // 1. Actualizar estado del recurso a inaccesible
            await recursoRef.update({
              estado: 'inaccesible',
              motivoInaccesible: motivo,
              actualizadoEn: ahoraStr
            });

            // 2. Buscar y bloquear asignaciones asociadas
            const asignacionesSnap = await firestore
              .collection('tenants')
              .doc(tId)
              .collection('asignaciones')
              .where('recursoId', '==', item.id)
              .get();

            const blockedAsigIds = [];
            const batch = firestore.batch();

            for (const asigDoc of asignacionesSnap.docs) {
              const asigData = asigDoc.data();
              if (asigData.estado === 'activa' || asigData.estado === 'en_progreso') {
                batch.update(asigDoc.ref, {
                  estado: 'bloqueada',
                  motivoBloqueo: motivoBloqueo,
                  actualizadoEn: ahoraStr
                });
                blockedAsigIds.push(asigDoc.id);
              }
            }

            if (blockedAsigIds.length > 0) {
              await batch.commit();
            }

            // 3. Crear alerta para el administrador
            const alertRef = firestore
              .collection('tenants')
              .doc(tId)
              .collection('alertas')
              .doc();

            await alertRef.set({
              id: alertRef.id,
              tipo: 'archivo_eliminado',
              titulo: 'Archivo académico inaccesible',
              mensaje: `El archivo "${recurso.nombre}" fue ${isTrashed ? 'enviado a la papelera' : 'eliminado'} en Google Drive. Se han bloqueado las asignaciones relacionadas.`,
              recursoId: item.id,
              recursoNombre: recurso.nombre,
              externalFileId: extId,
              asignacionesBloqueadas: blockedAsigIds,
              creadoEn: ahoraStr,
              leida: false
            });

            tenantResults.push({ id: item.id, status: 'inaccesible', motivo, blockedAssignmentsCount: blockedAsigIds.length });
          } else {
            // Archivo activo, verificar cambios en metadatos
            const updates = {};
            if (fileMeta.name && fileMeta.name !== recurso.nombre) {
              updates.nombre = fileMeta.name;
            }
            if (fileMeta.mimeType && fileMeta.mimeType !== recurso.mimeType) {
              updates.mimeType = fileMeta.mimeType;
            }
            if (fileMeta.size && Number(fileMeta.size) !== recurso.tamanoBytes) {
              updates.tamanoBytes = Number(fileMeta.size);
            }
            if (fileMeta.version && fileMeta.version !== recurso.version) {
              updates.version = fileMeta.version;
            }
            if (fileMeta.modifiedTime && fileMeta.modifiedTime !== recurso.fechaModificacionDrive) {
              updates.fechaModificacionDrive = fileMeta.modifiedTime;
            }

            // Si estaba inaccesible y ahora está disponible de nuevo, restauramos su estado
            if (recurso.estado === 'inaccesible') {
              updates.estado = recurso.aprobadoPorUid ? 'aprobado' : 'pendiente';
              updates.motivoInaccesible = admin.firestore.FieldValue.delete();
            }

            if (Object.keys(updates).length > 0) {
              updates.actualizadoEn = ahoraStr;
              await recursoRef.update(updates);
              tenantResults.push({ id: item.id, status: 'updated', fields: Object.keys(updates) });
            } else {
              tenantResults.push({ id: item.id, status: 'unchanged' });
            }
          }
        }

        results.push({ tenantId: tId, status: 'completed', resources: tenantResults });
      }

      return res.status(200).json({ ok: true, results });
    } catch (err) {
      console.error('Error general en syncDriveMetadata:', err);
      return res.status(500).json({ error: err.message });
    }
  };
};

module.exports = {
  crearServicioConnectDrive,
  crearServicioDriveOAuthCallback,
  crearServicioRefreshDriveToken,
  crearServicioListDriveFolder,
  crearServicioDisconnectDrive,
  crearServicioGetDriveConnection,
  crearServicioSetDriveFolder,
  crearServicioGetTemporaryFileUrl,
  crearServicioGetTemporaryFileUrlRecurso,
  crearServicioProxyDriveMedia,
  crearServicioSyncDriveMetadata
};
