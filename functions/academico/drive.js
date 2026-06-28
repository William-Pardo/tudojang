// functions/academico/drive.js
// Cloud Functions para la integración con Google Drive del módulo de estudio académico.
// Gestiona el flujo OAuth, refresco de tokens, generación de URLs temporales y sincronización de metadatos.

'use strict';

const admin = require('firebase-admin');
const { google } = require('googleapis');
const { cifrarToken, descifrarToken } = require('./kms');

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

    // 5. Generar URL de consentimiento de Google Drive (Read-only + Offline access)
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly'
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

    // 5. Cifrar el refresh_token si viene en la respuesta
    let encryptedRefreshToken = null;
    if (refresh_token) {
      encryptedRefreshToken = await cifrarToken(refresh_token);
    }

    // 6. Guardar en Firestore: tenants/{tenantId}/driveConnections/{connId}
    const connectionsCol = firestore.collection('tenants').doc(tenantId).collection('driveConnections');
    
    // Buscar si ya existe una conexión para reutilizar su ID y no duplicar registros
    const snapshot = await connectionsCol.limit(1).get();
    let connRef;
    let oldData = {};
    if (!snapshot.empty) {
      connRef = snapshot.docs[0].ref;
      oldData = snapshot.docs[0].data();
    } else {
      connRef = connectionsCol.doc();
    }

    const connectionData = {
      id: connRef.id,
      tenantId,
      connectedAt: new Date().toISOString(),
      connectedBy: context.auth.uid,
      scope: scope || 'https://www.googleapis.com/auth/drive.readonly',
      expiryDate: expiry_date || (Date.now() + 3600 * 1000),
      status: 'active'
    };

    // Si recibimos un nuevo refresh_token, lo actualizamos. Si no, mantenemos el anterior
    if (encryptedRefreshToken) {
      connectionData.refreshToken = encryptedRefreshToken;
    } else if (oldData.refreshToken) {
      connectionData.refreshToken = oldData.refreshToken;
    } else {
      throw new Error('No se recibió refresh_token y no existe una conexión previa con refresh_token guardado. Intente reconectar forzando el consentimiento.');
    }

    await connRef.set(connectionData, { merge: true });

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

    // 3. Validar que el rol sea Estudiante, Maestro o Admin (no Tutor ni anónimo)
    const rolPermitido = ['Estudiante', 'Maestro', 'Admin', 'SuperAdmin'];
    if (!context.auth.token.rol || !rolPermitido.includes(context.auth.token.rol)) {
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

    // Verificar que la asignación esté en estado activo (no vencida, no bloqueada)
    const estadosValidos = ['activa', 'en_progreso'];
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
    const connectionsSnap = await firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('driveConnections')
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (connectionsSnap.empty) {
      throw new Error('El tenant no tiene una conexión de Google Drive activa');
    }

    const connData = connectionsSnap.docs[0].data();
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
    // La URL temporal de Drive con el access_token tiene una duración efectiva de ~15 min
    // (el access_token de Google expira en 3600s, pero la URL se considera temporal por uso)
    const driveFileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

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

    // 9. Generar la URL temporal con el access_token embebido
    // La URL expira cuando expira el access_token (máx 1h, usamos la convención de 15 min para la UI)
    const expiresAt = new Date(ahora.getTime() + 15 * 60 * 1000).toISOString();
    const temporaryUrl = `${driveFileUrl}&access_token=${accessToken}`;

    return {
      ok: true,
      url: temporaryUrl,
      fileName: fileMeta.name,
      mimeType: fileMeta.mimeType,
      expiresAt
    };
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
        const connectionsSnap = await firestore
          .collection('tenants')
          .doc(tId)
          .collection('driveConnections')
          .where('status', '==', 'active')
          .limit(1)
          .get();

        if (connectionsSnap.empty) {
          results.push({ tenantId: tId, status: 'no_active_connection', count: resourcesByTenant[tId].length });
          continue;
        }

        const connData = connectionsSnap.docs[0].data();
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
  crearServicioGetTemporaryFileUrl,
  crearServicioSyncDriveMetadata
};
