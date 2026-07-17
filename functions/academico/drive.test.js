// functions/academico/drive.test.js
// Tests para los servicios de integraciÃ³n con Google Drive.
// Usan inyecciÃ³n de dependencias y mocks del SDK de Google.

'use strict';

const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?scope=drive.readonly');
const mockGetToken = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockRevokeToken = jest.fn().mockResolvedValue({});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        refreshAccessToken: mockRefreshAccessToken,
        setCredentials: mockSetCredentials,
        revokeToken: mockRevokeToken
      }))
    }
  }
}));

const { google } = require('googleapis');
const {
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
} = require('./drive');

// Helpers de mocks
const makeContext = (overrides = {}) => ({
  auth: {
    uid: 'admin-uid',
    token: {
      rol: 'Admin',
      tenantId: 'tenant-abc',
    },
    ...overrides,
  },
});

describe('crearServicioConnectDrive', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      getAccessToken: mockGetAccessToken
    }));
    mockGetAccessToken.mockResolvedValue({ token: 'access-token-sync' });
  });

  const buildService = (config = defaultConfig) => {
    return crearServicioConnectDrive({ googleDriveConfig: config });
  };

  it('lanza error si no hay autenticaciÃ³n', async () => {
    const service = buildService();
    await expect(
      service({ tenantId: 'tenant-abc' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si falta tenantId', async () => {
    const service = buildService();
    const ctx = makeContext();
    await expect(
      service({}, ctx)
    ).rejects.toThrow('El parámetro tenantId es obligatorio');
  });

  it('lanza error si el invocador no es Admin o SuperAdmin', async () => {
    const service = buildService();
    const ctx = makeContext({ token: { rol: 'Asistente', tenantId: 'tenant-abc' } });
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Solo el Admin del tenant puede conectar Google Drive');
  });

  it('lanza error si el tenantId no coincide con el del token del Admin', async () => {
    const service = buildService();
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'otro-tenant' }, ctx)
    ).rejects.toThrow('No autorizado para este tenant');
  });

  it('lanza error si la configuraciÃ³n de Google Drive está incompleta (falta clientId)', async () => {
    const service = buildService({ ...defaultConfig, clientId: null });
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Configuración de Google Drive incompleta');
  });

  it('lanza error si la configuraciÃ³n de Google Drive está incompleta (falta clientSecret)', async () => {
    const service = buildService({ ...defaultConfig, clientSecret: null });
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Configuración de Google Drive incompleta');
  });

  it('lanza error si la configuraciÃ³n de Google Drive está incompleta (falta redirectUri)', async () => {
    const service = buildService({ ...defaultConfig, redirectUri: null });
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Configuración de Google Drive incompleta');
  });

  it('genera la URL de consentimiento OAuth correctamente', async () => {
    const service = buildService();
    const ctx = makeContext();

    const result = await service({ tenantId: 'tenant-abc' }, ctx);

    expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?scope=drive.readonly' });
    expect(google.auth.OAuth2).toHaveBeenCalledWith(
      'google-client-id',
      'google-client-secret',
      'https://app.tudojang.com/oauth-callback'
    );
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: 'tenant-abc',
      prompt: 'consent'
    });
  });

  it('permite que un SuperAdmin genere la URL para cualquier tenant', async () => {
    const service = buildService();
    const ctx = makeContext({ token: { rol: 'SuperAdmin', tenantId: 'master-tenant' } });

    const result = await service({ tenantId: 'cualquier-tenant' }, ctx);

    expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?scope=drive.readonly' });
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
      state: 'cualquier-tenant'
    }));
  });
});

describe('crearServicioDriveOAuthCallback', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const makeDocRef = (data = {}, exists = true) => ({
    id: 'conn-123',
    set: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue({ exists, data: () => data }),
  });

  const makeFirestoreForDrive = (connections = [], docRef = null) => {
    const finalDocRef = docRef || makeDocRef({}, false);
    const docs = connections.map((c, index) => {
      const ref = c.ref || c._ref || finalDocRef;
      return {
        id: c.id || ref.id || `conn-${index + 1}`,
        ref,
        data: () => c,
      };
    });
    const getMock = jest.fn().mockResolvedValue({
      empty: docs.length === 0,
      docs,
    });

    return {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            get: getMock,
            limit: jest.fn().mockReturnValue({ get: getMock }),
            doc: jest.fn().mockReturnValue(finalDocRef),
          }),
        }),
      }),
      _getMock: getMock,
      _docRef: finalDocRef,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildService = (firestore, config = defaultConfig) => {
    return crearServicioDriveOAuthCallback({ googleDriveConfig: config, firestore });
  };

  it('lanza error si no hay autenticaciÃ³n', async () => {
    const firestore = makeFirestoreForDrive();
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ email: 'drive-admin@example.com' })
    });
    const service = buildService(firestore, { ...defaultConfig, _fetchFn: fetchFn });
    await expect(
      service({ code: 'code-123', tenantId: 'tenant-abc' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si falta code', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Los parámetros code y tenantId son obligatorios');
  });

  it('lanza error si falta tenantId', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
    const ctx = makeContext();
    await expect(
      service({ code: 'code-123' }, ctx)
    ).rejects.toThrow('Los parámetros code y tenantId son obligatorios');
  });

  it('lanza error si el invocador no es Admin o SuperAdmin', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
    const ctx = makeContext({ token: { rol: 'Estudiante', tenantId: 'tenant-abc' } });
    await expect(
      service({ code: 'code-123', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Solo el Admin del tenant puede conectar Google Drive');
  });

  it('lanza error si el tenantId no coincide con el del token del Admin', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
    const ctx = makeContext();
    await expect(
      service({ code: 'code-123', tenantId: 'otro-tenant' }, ctx)
    ).rejects.toThrow('No autorizado para este tenant');
  });

  it('lanza error si falla el intercambio de tokens en Google', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
    const ctx = makeContext();

    mockGetToken.mockRejectedValue(new Error('Google OAuth Error'));

    await expect(
      service({ code: 'code-invalido', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Error al intercambiar el código por tokens: Google OAuth Error');
  });

  it('intercambia el código por tokens, cifra el refresh_token y guarda la conexión en Firestore', async () => {
    const docRef = makeDocRef({}, false);
    const firestore = makeFirestoreForDrive([], docRef);
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ email: 'drive-admin@example.com' })
    });
    const service = buildService(firestore, { ...defaultConfig, _fetchFn: fetchFn });
    const ctx = makeContext();

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: 12345678,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
      }
    });

    const result = await service({ code: 'code-valido', tenantId: 'tenant-abc' }, ctx);

    expect(result.ok).toBe(true);
    expect(result.connectionId).toBe('conn-123');
    expect(mockGetToken).toHaveBeenCalledWith('code-valido');

    expect(docRef.set).toHaveBeenCalledTimes(1);
    const connectionData = docRef.set.mock.calls[0][0];
    expect(connectionData.tenantId).toBe('tenant-abc');
    expect(connectionData.status).toBe('active');
    expect(connectionData.googleAccountEmail).toBe('drive-admin@example.com');
    expect(connectionData.refreshToken).toBeDefined();
    // Debe ser un string JSON conteniendo content, iv, tag (formato cifrado de kms)
    const parsedKms = JSON.parse(connectionData.refreshToken);
    expect(parsedKms.content).toBeDefined();
    expect(parsedKms.iv).toBeDefined();
    expect(parsedKms.tag).toBeDefined();
  });

  it('usa el refresh_token anterior si la reconexión no lo devuelve y ya existÃ­a conexión', async () => {
    const existingConnection = {
      id: 'conn-123',
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'crypted-old-token', iv: 'iv', tag: 'tag' }),
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      status: 'active',
    };

    const docRef = makeDocRef(existingConnection, true);
    const firestore = makeFirestoreForDrive([existingConnection], docRef);
    const service = buildService(firestore);
    const ctx = makeContext();

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'new-access-token-999',
        expiry_date: 999999,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
      }
    });

    const result = await service({ code: 'code-reconnect', tenantId: 'tenant-abc' }, ctx);

    expect(result.ok).toBe(true);
    expect(docRef.set).toHaveBeenCalledTimes(1);
    const connectionData = docRef.set.mock.calls[0][0];
    expect(connectionData.refreshToken).toBe(existingConnection.refreshToken);
  });

  it('no reutiliza refresh_token anterior si la conexion previa no tenia drive.readonly', async () => {
    const existingConnection = {
      id: 'conn-123',
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'crypted-old-token', iv: 'iv', tag: 'tag' }),
      scope: 'https://www.googleapis.com/auth/drive.file',
      status: 'active',
    };

    const docRef = makeDocRef(existingConnection, true);
    const firestore = makeFirestoreForDrive([existingConnection], docRef);
    const service = buildService(firestore);
    const ctx = makeContext();

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'new-access-token-999',
        expiry_date: 999999,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
      }
    });

    await expect(
      service({ code: 'code-reconnect', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('No se recibio refresh_token reutilizable con permiso drive.readonly');
  });

  it('rechaza el callback si Google devuelve un scope sin drive.readonly', async () => {
    const existingConnection = {
      id: 'conn-123',
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'crypted-old-token', iv: 'iv', tag: 'tag' }),
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      status: 'active',
    };

    const docRef = makeDocRef(existingConnection, true);
    const firestore = makeFirestoreForDrive([existingConnection], docRef);
    const service = buildService(firestore);

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'new-access-token-999',
        expiry_date: 999999,
        scope: 'https://www.googleapis.com/auth/userinfo.email openid',
      }
    });

    await expect(
      service({ code: 'code-reconnect', tenantId: 'tenant-abc' }, makeContext())
    ).rejects.toThrow('Google no autorizo el alcance drive.readonly requerido');

    expect(docRef.set).not.toHaveBeenCalled();
  });

  it('desactiva conexiones activas duplicadas cuando una reconexion trae refresh_token nuevo', async () => {
    const oldRef = makeDocRef({}, true);
    oldRef.id = 'conn-old';
    const newRef = makeDocRef({}, true);
    newRef.id = 'conn-new';
    const olderConnection = {
      id: 'conn-old',
      ref: oldRef,
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'old-token', iv: 'iv', tag: 'tag' }),
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      status: 'active',
      connectedAt: '2026-06-01T00:00:00.000Z',
    };
    const newerConnection = {
      id: 'conn-new',
      ref: newRef,
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'newer-token', iv: 'iv', tag: 'tag' }),
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      status: 'active',
      connectedAt: '2026-07-01T00:00:00.000Z',
    };

    const firestore = makeFirestoreForDrive([olderConnection, newerConnection], newRef);
    const service = buildService(firestore);

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token-123',
        refresh_token: 'brand-new-refresh-token',
        expiry_date: 12345678,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
      }
    });

    const result = await service({ code: 'code-valido', tenantId: 'tenant-abc' }, makeContext());

    expect(result.connectionId).toBe('conn-new');
    expect(newRef.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      refreshToken: expect.any(String),
    }), { merge: true });
    expect(oldRef.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'disconnected',
      disconnectedReason: 'replaced_by_new_drive_connection',
      disconnectedBy: 'admin-uid',
    }), { merge: true });
  });

  it('lanza error si no viene refresh_token y no hay conexión previa', async () => {
    const docRef = makeDocRef({}, false);
    const firestore = makeFirestoreForDrive([], docRef);
    const service = buildService(firestore);
    const ctx = makeContext();

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token-123',
        expiry_date: 12345678,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
      }
    });

    await expect(
      service({ code: 'code-valido', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('No se recibio refresh_token reutilizable con permiso drive.readonly');
  });
});

describe('crearServicioRefreshDriveToken', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  // Usa kms real para cifrar tokens en los tests (sin mock â€” verifica integraciÃ³n real con kms.js)
  const { cifrarToken } = require('./kms');

  const makeConnRef = (data = null) => ({
    id: 'conn-555',
    get: jest.fn().mockResolvedValue({
      exists: data !== null,
      data: () => data
    }),
    set: jest.fn().mockResolvedValue()
  });

  const makeFirestoreForRefresh = (connData = null) => {
    const connRef = makeConnRef(connData);
    return {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue(connRef)
          })
        })
      }),
      _connRef: connRef
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildService = (firestore, config = defaultConfig) =>
    crearServicioRefreshDriveToken({ googleDriveConfig: config, firestore });

  it('lanza error si no hay autenticaciÃ³n', async () => {
    const firestore = makeFirestoreForRefresh();
    const service = buildService(firestore);
    await expect(
      service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si faltan parámetros tenantId o connectionId', async () => {
    const firestore = makeFirestoreForRefresh();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    await expect(service({ tenantId: 'tenant-abc' }, ctx)).rejects.toThrow('tenantId y connectionId son obligatorios');
    await expect(service({ connectionId: 'conn-555' }, ctx)).rejects.toThrow('tenantId y connectionId son obligatorios');
  });

  it('lanza error si el rol no es Admin o SuperAdmin', async () => {
    const firestore = makeFirestoreForRefresh();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Maestro', tenantId: 'tenant-abc' } } };
    await expect(
      service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx)
    ).rejects.toThrow('Solo el Admin del tenant puede renovar el token');
  });

  it('lanza error si el tenantId no coincide', async () => {
    const firestore = makeFirestoreForRefresh();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    await expect(
      service({ tenantId: 'otro-tenant', connectionId: 'conn-555' }, ctx)
    ).rejects.toThrow('No autorizado para este tenant');
  });

  it('lanza error si la conexión no existe en Firestore', async () => {
    const firestore = makeFirestoreForRefresh(null);
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    await expect(
      service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx)
    ).rejects.toThrow('No se encontró la conexión de Drive especificada');
  });

  it('lanza error si la conexión no tiene refreshToken almacenado', async () => {
    const firestore = makeFirestoreForRefresh({ tenantId: 'tenant-abc', status: 'active' });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    await expect(
      service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx)
    ).rejects.toThrow('La conexión no tiene un refresh_token almacenado');
  });

  it('lanza error descriptivo cuando el token ha sido revocado (invalid_grant)', async () => {
    const encryptedToken = await cifrarToken('old-refresh-token');
    const firestore = makeFirestoreForRefresh({
      tenantId: 'tenant-abc',
      status: 'active',
      refreshToken: encryptedToken
    });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    mockRefreshAccessToken.mockRejectedValue(new Error('invalid_grant: Token has been expired or revoked'));

    await expect(
      service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx)
    ).rejects.toThrow('El refresh_token ha sido revocado. El usuario debe reconectar Google Drive.');
  });

  it('renueva el access_token y actualiza Firestore correctamente', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connData = {
      tenantId: 'tenant-abc',
      status: 'active',
      scope: 'https://www.googleapis.com/auth/drive.file',
      refreshToken: encryptedToken
    };
    const firestore = makeFirestoreForRefresh(connData);
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token-xyz',
        expiry_date: 9999999,
        scope: 'https://www.googleapis.com/auth/drive.file'
      }
    });

    const result = await service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe('new-access-token-xyz');
    expect(result.expiryDate).toBe(9999999);

    const setCall = firestore._connRef.set.mock.calls[0];
    expect(setCall[0].status).toBe('active');
    expect(setCall[0].lastRefreshedAt).toBeDefined();
    expect(setCall[1]).toEqual({ merge: true });
  });

  it('cifra y actualiza el nuevo refresh_token si Google lo devuelve', async () => {
    const encryptedToken = await cifrarToken('old-refresh-token');
    const connData = {
      tenantId: 'tenant-abc',
      status: 'active',
      refreshToken: encryptedToken
    };
    const firestore = makeFirestoreForRefresh(connData);
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token-abc',
        refresh_token: 'brand-new-refresh-token',
        expiry_date: 8888888
      }
    });

    await service({ tenantId: 'tenant-abc', connectionId: 'conn-555' }, ctx);

    const setCall = firestore._connRef.set.mock.calls[0];
    const newEncrypted = setCall[0].refreshToken;
    expect(newEncrypted).toBeDefined();
    // Verificar que es el formato KMS cifrado (JSON con iv, content, tag)
    const parsed = JSON.parse(newEncrypted);
    expect(parsed.iv).toBeDefined();
    expect(parsed.content).toBeDefined();
    expect(parsed.tag).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Mocks adicionales para crearServicioGetTemporaryFileUrl
// ---------------------------------------------------------------------------
const mockGetAccessToken = jest.fn();

// Re-mock de googleapis para incluir getAccessToken (debe hacerse antes de los requires)
// El mock global ya incluye setCredentials. Extendemos para getAccessToken.
beforeAll(() => {
  jest.resetModules(); // no necesario aquÃ­ pero lo dejamos como referencia
  mockGetAccessToken.mockResolvedValue({ token: 'access-token-temporal-xyz' });
});

describe('crearServicioGetTemporaryFileUrl', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const { cifrarToken } = require('./kms');

  // Helper: construye el objeto asignación base
  const makeAsignacion = (overrides = {}) => ({
    tenantId: 'tenant-abc',
    // 'publicada' es el ÚNICO valor que crearServicioPublishAsignacion(esBatch) realmente
    // escribe (functions/academico/asignaciones.js) -- ver EstadoAsignacionAcademica en
    // models/academico/asignacion.ts. Antes este fixture usaba 'activa', un valor que el
    // sistema real nunca persiste, lo que ocultaba que el chequeo de estado en
    // crearServicioGetTemporaryFileUrl estaba roto para toda asignación publicada normal.
    estado: 'publicada',
    recursoId: 'recurso-111',
    ...overrides
  });

  // Helper: construye un mock de asignacionRef con control del estado
  const makeAsignacionRef = (asignacion = null) => ({
    get: jest.fn().mockResolvedValue({
      exists: asignacion !== null,
      data: () => asignacion
    }),
    set: jest.fn().mockResolvedValue()
  });

  // Helper: construye mock de recursoRef
  const makeRecursoRef = () => ({
    set: jest.fn().mockResolvedValue()
  });

  // Helper: construye Firestore completo con asignación y conexión activa
  const makeFirestore = ({
    asignacion = makeAsignacion(),
    connectionData = null,
    asignacionRef = null,
    recursoRef = null
  } = {}) => {
    const _asignacionRef = asignacionRef || makeAsignacionRef(asignacion);
    const _recursoRef = recursoRef || makeRecursoRef();

    const connectionSnap = connectionData !== null
      ? { empty: false, docs: [{ data: () => connectionData }] }
      : { empty: true, docs: [] };

    return {
      collection: jest.fn().mockImplementation((colName) => ({
        doc: jest.fn().mockImplementation((tenantId) => ({
          collection: jest.fn().mockImplementation((subCol) => ({
            doc: jest.fn().mockImplementation((docId) => {
              if (subCol === 'asignaciones') return _asignacionRef;
              if (subCol === 'recursos') return _recursoRef;
              return {};
            }),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(connectionSnap)
          }))
        }))
      })),
      _asignacionRef,
      _recursoRef
    };
  };

  // Helper: mock de fetch que simula Drive API
  const makeFetchFn = ({
    status = 200,
    body = { id: 'file-123', name: 'material.pdf', mimeType: 'application/pdf', trashed: false }
  } = {}) => {
    return jest.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: jest.fn().mockResolvedValue(body)
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Asegurar que getAccessToken estÃ© disponible en el mock de OAuth2
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      getAccessToken: mockGetAccessToken
    }));
    mockGetAccessToken.mockResolvedValue({ token: 'access-token-temporal-xyz' });
  });

  const buildService = (firestore, config = defaultConfig) =>
    crearServicioGetTemporaryFileUrl({ googleDriveConfig: { ...config, _fetchFn: makeFetchFn() }, firestore });

  it('lanza error si no hay autenticaciÃ³n', async () => {
    const firestore = makeFirestore();
    const service = crearServicioGetTemporaryFileUrl({ googleDriveConfig: defaultConfig, firestore });
    await expect(
      service({ tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si faltan parámetros obligatorios', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    await expect(service({ tenantId: 'tenant-abc', asignacionId: 'asig-1' }, ctx))
      .rejects.toThrow('tenantId, asignacionId y fileId son obligatorios');
    await expect(service({ tenantId: 'tenant-abc', fileId: 'file-123' }, ctx))
      .rejects.toThrow('tenantId, asignacionId y fileId son obligatorios');
  });

  it('rechaza acceso si el rol es anónimo/no reconocido (403)', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'RolInexistente', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('No autorizado para acceder a recursos académicos');
    expect(err.code).toBe('permission-denied');
  });

  // Fix 2026-07-16 (bug reportado: Tutor veía el material listado pero al abrirlo recibía
  // "Permisos insuficientes para abrir este recurso de Drive."): Tutor debe poder VER el
  // contenido real (para confirmar que el material correcto fue asignado a su hijo), igual
  // que ya podían Estudiante/Maestro/Admin. El registro de actividad/consumo sigue sin
  // atribuirse al Tutor porque eso lo controla el llamador (CentroEstudios.tsx no pasa
  // estudianteId cuando quien mira es un Tutor), no este chequeo de rol.
  it('permite acceso al rol Tutor (antes rechazado con 403)', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connectionData = { refreshToken: encryptedToken, status: 'active' };
    const fetchFn = makeFetchFn();
    const firestore = makeFirestore({ connectionData });
    const service = crearServicioGetTemporaryFileUrl({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Tutor', tenantId: 'tenant-abc' } } };

    const result = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('file-123');
  });

  it('rechaza acceso si tenantId no coincide con el del token', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'otro-tenant', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('No autorizado para este tenant');
    expect(err.code).toBe('permission-denied');
  });

  it('rechaza si la asignación no existe', async () => {
    const firestore = makeFirestore({ asignacion: null });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('La asignación especificada no existe');
    expect(err.code).toBe('not-found');
  });

  it('rechaza si la asignación está en borrador (aún no publicada) -- regresión del bug de estados inválidos', async () => {
    const firestore = makeFirestore({ asignacion: makeAsignacion({ estado: 'borrador' }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch("la asignación está en estado 'borrador'");
    expect(err.code).toBe('permission-denied');
  });

  it('rechaza si la asignación está vencida (estado vencida)', async () => {
    const firestore = makeFirestore({ asignacion: makeAsignacion({ estado: 'vencida' }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch("la asignación está en estado 'vencida'");
    expect(err.code).toBe('permission-denied');
  });

  it('rechaza si la asignación está bloqueada', async () => {
    const firestore = makeFirestore({ asignacion: makeAsignacion({ estado: 'bloqueada' }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch("la asignación está en estado 'bloqueada'");
    expect(err.code).toBe('permission-denied');
  });

  it('rechaza si la asignación no ha abierto aún (fechaApertura en el futuro)', async () => {
    const futuro = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const firestore = makeFirestore({ asignacion: makeAsignacion({ fechaApertura: futuro }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('aún no está disponible');
  });

  it('rechaza si la asignación ya venciÃ³ por fechaCierre', async () => {
    const pasado = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const firestore = makeFirestore({ asignacion: makeAsignacion({ fechaCierre: pasado }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('ha vencido');
  });

  it('lanza error si no hay conexión de Drive activa para el tenant', async () => {
    const firestore = makeFirestore({ connectionData: null });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };
    await expect(
      service({ tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' }, ctx)
    ).rejects.toThrow('no tiene una conexión de Google Drive activa');
  });

  it('genera URL temporal correctamente para acceso vÃ¡lido', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connectionData = { refreshToken: encryptedToken, status: 'active' };
    const fetchFn = makeFetchFn();
    const firestore = makeFirestore({ connectionData });
    const service = crearServicioGetTemporaryFileUrl({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Estudiante', tenantId: 'tenant-abc' } } };

    const result = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    );

    expect(result.ok).toBe(true);
    // La URL apunta a NUESTRO proxy (no a googleapis.com directo -- Drive no manda CORS para
    // alt=media) y no lleva ningún secreto embebido, solo identificadores. El navegador
    // adjunta su propio ID token de Firebase al pedirla (ver driveService.ts).
    expect(result.url).toContain('/proxyDriveMedia');
    expect(result.url).toContain('fileId=file-123');
    expect(result.url).toContain('tenantId=tenant-abc');
    expect(result.url).toContain('asignacionId=asig-1');
    expect(result.url).not.toContain('access_token');
    expect(result.fileName).toBe('material.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.expiresAt).toBeDefined();
    // expiresAt debe ser ~15 minutos en el futuro
    const expiresAt = new Date(result.expiresAt);
    const diff = expiresAt - new Date();
    expect(diff).toBeGreaterThan(14 * 60 * 1000);
    expect(diff).toBeLessThan(16 * 60 * 1000);
  });

  it('marca el recurso como inaccesible y bloquea la asignación si el archivo fue eliminado (404)', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connectionData = { refreshToken: encryptedToken, status: 'active' };
    const fetchFn = makeFetchFn({ status: 404 });
    const _asignacionRef = makeAsignacionRef(makeAsignacion());
    const _recursoRef = makeRecursoRef();
    const firestore = makeFirestore({ connectionData, asignacionRef: _asignacionRef, recursoRef: _recursoRef });
    const service = crearServicioGetTemporaryFileUrl({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Maestro', tenantId: 'tenant-abc' } } };

    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-eliminado' },
      ctx
    ).catch(e => e);

    expect(err.message).toMatch('ya no existe en Google Drive');
    expect(err.code).toBe('not-found');
    expect(err.archivoBloqueado).toBe(true);
    // Verifica que se bloqueÃ³ la asignación
    expect(_asignacionRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'bloqueada', motivoBloqueo: 'archivo_eliminado' }),
      { merge: true }
    );
    // Verifica que el recurso fue marcado inaccesible
    expect(_recursoRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'inaccesible' }),
      { merge: true }
    );
  });

  it('marca el recurso como inaccesible y bloquea la asignación si el archivo está en papelera', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connectionData = { refreshToken: encryptedToken, status: 'active' };
    const fetchFn = makeFetchFn({
      body: { id: 'file-123', name: 'trash.pdf', mimeType: 'application/pdf', trashed: true }
    });
    const _asignacionRef = makeAsignacionRef(makeAsignacion());
    const _recursoRef = makeRecursoRef();
    const firestore = makeFirestore({ connectionData, asignacionRef: _asignacionRef, recursoRef: _recursoRef });
    const service = crearServicioGetTemporaryFileUrl({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);

    expect(err.message).toMatch('papelera de Drive');
    expect(err.code).toBe('not-found');
    expect(_asignacionRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'bloqueada', motivoBloqueo: 'archivo_en_papelera' }),
      { merge: true }
    );
  });

  it('un SuperAdmin puede acceder con cualquier tenantId', async () => {
    const encryptedToken = await cifrarToken('super-refresh-token');
    const connectionData = { refreshToken: encryptedToken, status: 'active' };
    const fetchFn = makeFetchFn();
    const firestore = makeFirestore({ connectionData });
    const service = crearServicioGetTemporaryFileUrl({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });
    const ctx = { auth: { uid: 'super', token: { rol: 'SuperAdmin', tenantId: 'master' } } };

    const result = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('file-123');
  });
});

describe('crearServicioListDriveFolder', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };
  const { cifrarToken } = require('./kms');

  const makeFirestore = (connectionData = null) => {
    const connections = Array.isArray(connectionData)
      ? connectionData
      : connectionData
        ? [connectionData]
        : [];
    const connectionSnap = {
      empty: connections.length === 0,
      docs: connections.map((item, index) => ({
        id: item.id || `conn-${index + 1}`,
        data: () => item
      }))
    };

    return {
      collection: jest.fn().mockImplementation(() => ({
        doc: jest.fn().mockImplementation(() => ({
          collection: jest.fn().mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(connectionSnap)
          }))
        }))
      }))
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      getAccessToken: mockGetAccessToken
    }));
    mockGetAccessToken.mockResolvedValue({ token: 'access-token-list' });
  });

  it('rechaza usuarios no autenticados', async () => {
    const service = crearServicioListDriveFolder({
      googleDriveConfig: defaultConfig,
      firestore: makeFirestore()
    });

    await expect(service({ tenantId: 'tenant-abc', folderId: 'root' }, { auth: null }))
      .rejects.toThrow('No autenticado');
  });

  it('lista archivos y carpetas de una carpeta Drive activa', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        files: [
          {
            id: 'folder-1',
            name: 'Teoria',
            mimeType: 'application/vnd.google-apps.folder',
            webViewLink: 'https://drive.google.com/folders/folder-1',
            parents: ['root'],
            modifiedTime: '2026-06-29T00:00:00Z'
          },
          {
            id: 'file-1',
            name: 'manual.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.google.com/file/d/file-1/view',
            parents: ['root'],
            modifiedTime: '2026-06-29T00:00:00Z',
            size: '1200'
          }
        ]
      })
    });
    const service = crearServicioListDriveFolder({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore: makeFirestore({ refreshToken: encryptedToken, status: 'active' })
    });

    const result = await service(
      { tenantId: 'tenant-abc', folderId: 'root' },
      { auth: { uid: 'admin-uid', token: { rol: 'Admin', tenantId: 'tenant-abc' } } }
    );

    const [url] = fetchFn.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get('q')).toBe("'root' in parents and trashed = false");
    expect(params.get('supportsAllDrives')).toBe('true');
    expect(params.get('includeItemsFromAllDrives')).toBe('true');
    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer access-token-list' } })
    );
    expect(result.files).toEqual([
      expect.objectContaining({ id: 'folder-1', name: 'Teoria', mimeType: 'application/vnd.google-apps.folder' }),
      expect.objectContaining({ id: 'file-1', name: 'manual.pdf', mimeType: 'application/pdf', size: 1200 })
    ]);
  });

  it('usa la conexion activa mas reciente al listar una carpeta Drive', async () => {
    const oldEncryptedToken = await cifrarToken('old-refresh-token');
    const newEncryptedToken = await cifrarToken('new-refresh-token');
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ files: [] })
    });
    const service = crearServicioListDriveFolder({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore: makeFirestore([
        {
          id: 'conn-old',
          refreshToken: oldEncryptedToken,
          status: 'active',
          connectedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'conn-new',
          refreshToken: newEncryptedToken,
          status: 'active',
          connectedAt: '2026-07-01T00:00:00.000Z',
        },
      ])
    });

    await service(
      { tenantId: 'tenant-abc', folderId: 'root' },
      { auth: { uid: 'admin-uid', token: { rol: 'Admin', tenantId: 'tenant-abc' } } }
    );

    expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: 'new-refresh-token' });
  });

  it('rechaza tenant diferente para usuarios que no son SuperAdmin', async () => {
    const service = crearServicioListDriveFolder({
      googleDriveConfig: defaultConfig,
      firestore: makeFirestore()
    });

    const err = await service(
      { tenantId: 'tenant-b', folderId: 'root' },
      { auth: { uid: 'admin-uid', token: { rol: 'Admin', tenantId: 'tenant-a' } } }
    ).catch(e => e);

    expect(err.message).toContain('No autorizado para este tenant');
    expect(err.code).toBe('permission-denied');
  });

  it('incluye el detalle seguro de Google cuando Drive devuelve 403', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        error: {
          status: 'PERMISSION_DENIED',
          message: 'The user does not have sufficient permissions for this file.'
        }
      }))
    });
    const service = crearServicioListDriveFolder({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore: makeFirestore({ refreshToken: encryptedToken, status: 'active' })
    });

    const err = await service(
      { tenantId: 'tenant-abc', folderId: 'folder-real' },
      { auth: { uid: 'admin-uid', token: { rol: 'Admin', tenantId: 'tenant-abc' } } }
    ).catch(e => e);

    expect(err.code).toBe('permission-denied');
    expect(err.message).toContain('PERMISSION_DENIED');
    expect(err.message).toContain('sufficient permissions');
  });
});

describe('crearServicioDisconnectDrive', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };
  const { cifrarToken } = require('./kms');

  beforeEach(() => {
    jest.clearAllMocks();
    mockRevokeToken.mockResolvedValue({});
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      revokeToken: mockRevokeToken
    }));
  });

  const makeFirestoreWithActiveConnection = (connectionData) => {
    const connRef = {
      set: jest.fn().mockResolvedValue()
    };
    const getMock = jest.fn().mockResolvedValue({
      empty: false,
      docs: [{
        ref: connRef,
        data: () => connectionData
      }]
    });

    return {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              get: getMock
            })
          })
        })
      }),
      _connRef: connRef,
      _getMock: getMock
    };
  };

  it('revoca el token y marca la conexion activa como desconectada', async () => {
    const encryptedToken = await cifrarToken('refresh-token-to-revoke');
    const firestore = makeFirestoreWithActiveConnection({
      refreshToken: encryptedToken,
      status: 'active'
    });
    const service = crearServicioDisconnectDrive({ googleDriveConfig: defaultConfig, firestore });

    const result = await service({ tenantId: 'tenant-abc' }, makeContext());

    expect(result).toEqual({ ok: true, disconnectedCount: 1 });
    expect(mockRevokeToken).toHaveBeenCalledWith('refresh-token-to-revoke');
    expect(firestore._connRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'disconnected',
        disconnectedBy: 'admin-uid'
      }),
      { merge: true }
    );
  });

  it('rechaza desconexion si el rol no es Admin ni SuperAdmin', async () => {
    const firestore = makeFirestoreWithActiveConnection({ status: 'active' });
    const service = crearServicioDisconnectDrive({ googleDriveConfig: defaultConfig, firestore });

    await expect(
      service({ tenantId: 'tenant-abc' }, makeContext({ token: { rol: 'Tutor', tenantId: 'tenant-abc' } }))
    ).rejects.toThrow('Solo el Admin del tenant puede desconectar Google Drive');
  });
});

describe('crearServicioGetDriveConnection y crearServicioSetDriveFolder', () => {
  const makeFirestoreWithActiveConnection = (connectionData = null) => {
    const connRef = {
      set: jest.fn().mockResolvedValue()
    };
    const connections = Array.isArray(connectionData)
      ? connectionData
      : connectionData
        ? [connectionData]
        : [];
    const docs = connections.map((item, index) => ({
      id: item.id || 'conn-123',
      ref: item.ref || connRef,
      data: () => item
    }));
    const getMock = jest.fn().mockResolvedValue({
      empty: docs.length === 0,
      docs
    });
    const whereMock = jest.fn().mockReturnValue({
      get: getMock,
      limit: jest.fn().mockReturnValue({ get: getMock })
    });

    return {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            where: whereMock
          })
        })
      }),
      _connRef: connRef,
      _whereMock: whereMock
    };
  };

  it('devuelve conexion activa con activeFolderId persistido', async () => {
    const firestore = makeFirestoreWithActiveConnection({
      status: 'active',
      activeFolderId: 'folder-firestore',
      googleAccountEmail: 'drive-admin@example.com'
    });
    const service = crearServicioGetDriveConnection({ firestore });

    const result = await service({ tenantId: 'tenant-abc' }, makeContext());

    expect(result).toEqual({
      connected: true,
      connectionId: 'conn-123',
      activeFolderId: 'folder-firestore',
      activeFolderName: '',
      googleAccountEmail: 'drive-admin@example.com',
      status: 'active'
    });
    expect(firestore._whereMock).toHaveBeenCalledWith('status', '==', 'active');
  });

  it('devuelve la conexion activa mas reciente cuando existen duplicadas', async () => {
    const firestore = makeFirestoreWithActiveConnection([
      {
        id: 'conn-old',
        status: 'active',
        activeFolderId: 'folder-old',
        connectedAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'conn-new',
        status: 'active',
        activeFolderId: 'folder-new',
        googleAccountEmail: 'drive-new@example.com',
        connectedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    const service = crearServicioGetDriveConnection({ firestore });

    const result = await service({ tenantId: 'tenant-abc' }, makeContext());

    expect(result).toEqual({
      connected: true,
      connectionId: 'conn-new',
      activeFolderId: 'folder-new',
      activeFolderName: '',
      googleAccountEmail: 'drive-new@example.com',
      status: 'active'
    });
  });

  it('devuelve disconnected cuando no hay conexion activa', async () => {
    const firestore = makeFirestoreWithActiveConnection(null);
    const service = crearServicioGetDriveConnection({ firestore });

    const result = await service({ tenantId: 'tenant-abc' }, makeContext());

    expect(result).toEqual({ connected: false });
  });

  it('guarda activeFolderId en la conexion activa del tenant', async () => {
    const firestore = makeFirestoreWithActiveConnection({ status: 'active' });
    const service = crearServicioSetDriveFolder({ firestore });

    const result = await service(
      { tenantId: 'tenant-abc', folderId: 'folder-real-123' },
      makeContext()
    );

    expect(result).toEqual({
      ok: true,
      connectionId: 'conn-123',
      activeFolderId: 'folder-real-123',
      activeFolderName: ''
    });
    expect(firestore._connRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        activeFolderId: 'folder-real-123',
        folderId: 'folder-real-123',
        folderUpdatedBy: 'admin-uid'
      }),
      { merge: true }
    );
  });

  it('rechaza guardar carpeta si el rol no es Admin ni SuperAdmin', async () => {
    const firestore = makeFirestoreWithActiveConnection({ status: 'active' });
    const service = crearServicioSetDriveFolder({ firestore });

    await expect(
      service(
        { tenantId: 'tenant-abc', folderId: 'folder-real-123' },
        makeContext({ token: { rol: 'Maestro', tenantId: 'tenant-abc' } })
      )
    ).rejects.toThrow('Solo el Admin del tenant puede definir la carpeta activa de Drive');
  });
});

describe('crearServicioSyncDriveMetadata', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const { cifrarToken } = require('./kms');

  beforeEach(() => {
    jest.clearAllMocks();
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      getAccessToken: mockGetAccessToken
    }));
    mockGetAccessToken.mockResolvedValue({ token: 'access-token-sync' });
  });

  it('retorna 200 si recibe una confirmacion de canal de sincronizacion (sync)', async () => {
    const firestore = {};
    const service = crearServicioSyncDriveMetadata({ googleDriveConfig: defaultConfig, firestore });
    const req = {
      headers: { 'x-goog-resource-state': 'sync' },
      query: {},
      body: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  it('retorna 400 si falta el tenantId y el fileId', async () => {
    const firestore = {};
    const service = crearServicioSyncDriveMetadata({ googleDriveConfig: defaultConfig, firestore });
    const req = {
      headers: {},
      query: {},
      body: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('Falta tenantId o fileId') });
  });

  it('sincroniza metadatos de archivo (nombre) si el archivo cambio de nombre', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connData = { refreshToken: encryptedToken, status: 'active' };
    const connSnap = { empty: false, docs: [{ data: () => connData }] };

    const recursoData = {
      tenantId: 'tenant-abc',
      externalFileId: 'file-123',
      nombre: 'nombre-viejo.pdf',
      mimeType: 'application/pdf',
      tamanoBytes: 500,
      estado: 'aprobado'
    };
    const recursoRef = {
      update: jest.fn().mockResolvedValue()
    };

    const fetchFn = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'file-123',
        name: 'nombre-nuevo.pdf',
        mimeType: 'application/pdf',
        size: '500',
        version: '2',
        modifiedTime: '2026-06-25T20:00:00Z',
        trashed: false
      })
    });

    const firestore = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === 'tenants') {
          return {
            doc: jest.fn().mockImplementation((tId) => ({
              collection: jest.fn().mockImplementation((subCol) => {
                if (subCol === 'recursos') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue({
                      forEach: (cb) => cb({ id: 'recurso-abc', ref: recursoRef, data: () => recursoData })
                    })
                  };
                }
                if (subCol === 'driveConnections') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue(connSnap)
                  };
                }
                return {};
              })
            }))
          };
        }
        return {};
      })
    };

    const service = crearServicioSyncDriveMetadata({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });

    const req = {
      headers: {},
      query: { tenantId: 'tenant-abc', fileId: 'file-123' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(recursoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'nombre-nuevo.pdf',
        version: '2',
        fechaModificacionDrive: '2026-06-25T20:00:00Z'
      })
    );
  });

  it('marca el recurso como inaccesible, bloquea asignaciones y crea alerta si el archivo es eliminado (404)', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connData = { refreshToken: encryptedToken, status: 'active' };
    const connSnap = { empty: false, docs: [{ data: () => connData }] };

    const recursoData = {
      tenantId: 'tenant-abc',
      externalFileId: 'file-deleted',
      nombre: 'archivo.pdf',
      estado: 'aprobado'
    };
    const recursoRef = {
      update: jest.fn().mockResolvedValue()
    };

    const asignacionData = {
      estado: 'activa',
      recursoId: 'recurso-abc'
    };
    const asignacionRef = { id: 'asig-123' };
    const asignacionesSnap = {
      docs: [{ id: 'asig-123', ref: asignacionRef, data: () => asignacionData }]
    };

    const alertRef = {
      id: 'alert-777',
      set: jest.fn().mockResolvedValue()
    };

    const batchMock = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue()
    };

    const fetchFn = jest.fn().mockResolvedValue({
      status: 404,
      ok: false
    });

    const firestore = {
      batch: jest.fn().mockReturnValue(batchMock),
      collection: jest.fn().mockImplementation((col) => {
        if (col === 'tenants') {
          return {
            doc: jest.fn().mockImplementation((tId) => ({
              collection: jest.fn().mockImplementation((subCol) => {
                if (subCol === 'recursos') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue({
                      forEach: (cb) => cb({ id: 'recurso-abc', ref: recursoRef, data: () => recursoData })
                    })
                  };
                }
                if (subCol === 'driveConnections') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue(connSnap)
                  };
                }
                if (subCol === 'asignaciones') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue(asignacionesSnap)
                  };
                }
                if (subCol === 'alertas') {
                  return {
                    doc: jest.fn().mockReturnValue(alertRef)
                  };
                }
                return {};
              })
            }))
          };
        }
        return {};
      })
    };

    const service = crearServicioSyncDriveMetadata({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });

    const req = {
      headers: {},
      query: { tenantId: 'tenant-abc', fileId: 'file-deleted' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(recursoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: 'inaccesible',
        motivoInaccesible: 'archivo_eliminado_de_drive'
      })
    );
    expect(batchMock.update).toHaveBeenCalledWith(
      asignacionRef,
      expect.objectContaining({
        estado: 'bloqueada',
        motivoBloqueo: 'archivo_eliminado'
      })
    );
    expect(batchMock.commit).toHaveBeenCalled();
    expect(alertRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'archivo_eliminado',
        recursoId: 'recurso-abc',
        externalFileId: 'file-deleted',
        asignacionesBloqueadas: ['asig-123']
      })
    );
  });

  it('sincroniza buscando por collectionGroup si no se especifica tenantId', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connData = { refreshToken: encryptedToken, status: 'active' };
    const connSnap = { empty: false, docs: [{ data: () => connData }] };

    const recursoData = {
      tenantId: 'tenant-group',
      externalFileId: 'file-group',
      nombre: 'group-file.pdf',
      estado: 'aprobado'
    };
    const recursoRef = {
      update: jest.fn().mockResolvedValue()
    };

    const fetchFn = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'file-group',
        name: 'group-file-nuevo.pdf',
        trashed: false
      })
    });

    const firestore = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === 'tenants') {
          return {
            doc: jest.fn().mockImplementation((tId) => ({
              collection: jest.fn().mockImplementation((subCol) => {
                if (subCol === 'driveConnections') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue(connSnap)
                  };
                }
                return {};
              })
            }))
          };
        }
        return {};
      }),
      collectionGroup: jest.fn().mockImplementation((colGroup) => {
        if (colGroup === 'recursos') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              forEach: (cb) => cb({ id: 'recurso-group', ref: recursoRef, data: () => recursoData })
            })
          };
        }
        return {};
      })
    };

    const service = crearServicioSyncDriveMetadata({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });

    const req = {
      headers: {},
      query: { fileId: 'file-group' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestore.collectionGroup).toHaveBeenCalledWith('recursos');
    expect(recursoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'group-file-nuevo.pdf'
      })
    );
  });

  it('sincroniza todos los recursos de un tenant si el fileId coincide con el folderId de una conexion', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const connData = { refreshToken: encryptedToken, folderId: 'folder-root', tenantId: 'tenant-folder', status: 'active' };
    const connSnap = { empty: false, docs: [{ data: () => connData }] };

    const recursoData = {
      tenantId: 'tenant-folder',
      externalFileId: 'file-child-1',
      nombre: 'child-1.pdf',
      estado: 'aprobado'
    };
    const recursoRef = {
      update: jest.fn().mockResolvedValue()
    };

    const fetchFn = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'file-child-1',
        name: 'child-1-updated.pdf',
        trashed: false
      })
    });

    const firestore = {
      collection: jest.fn().mockImplementation((col) => {
        if (col === 'tenants') {
          return {
            doc: jest.fn().mockImplementation((tId) => ({
              collection: jest.fn().mockImplementation((subCol) => {
                if (subCol === 'recursos') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue({
                      forEach: (cb) => cb({ id: 'recurso-child', ref: recursoRef, data: () => recursoData })
                    })
                  };
                }
                if (subCol === 'driveConnections') {
                  return {
                    where: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue(connSnap)
                  };
                }
                return {};
              })
            }))
          };
        }
        return {};
      }),
      collectionGroup: jest.fn().mockImplementation((colGroup) => {
        if (colGroup === 'recursos') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              forEach: () => {}
            })
          };
        }
        if (colGroup === 'driveConnections') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => connData }]
            })
          };
        }
        return {};
      })
    };

    const service = crearServicioSyncDriveMetadata({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore
    });

    const req = {
      headers: {},
      query: { fileId: 'folder-root' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await service(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestore.collectionGroup).toHaveBeenCalledWith('driveConnections');
    expect(recursoRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'child-1-updated.pdf'
      })
    );
  });
});

describe('crearServicioGetTemporaryFileUrlRecurso', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const { cifrarToken } = require('./kms');

  const makeRecurso = (overrides = {}) => ({
    tenantId: 'tenant-abc',
    externalFileId: 'file-123',
    nombre: 'material.pdf',
    estado: 'aprobado',
    ...overrides
  });

  const makeRecursoRef = (recurso = makeRecurso()) => ({
    get: jest.fn().mockResolvedValue({
      exists: recurso !== null,
      data: () => recurso
    })
  });

  const makeFirestore = ({ recurso = makeRecurso(), connectionData = null, recursoRef = null } = {}) => {
    const _recursoRef = recursoRef || makeRecursoRef(recurso);
    const connectionSnap = connectionData !== null
      ? { empty: false, docs: [{ data: () => connectionData }] }
      : { empty: true, docs: [] };

    return {
      collection: jest.fn().mockImplementation(() => ({
        doc: jest.fn().mockImplementation(() => ({
          collection: jest.fn().mockImplementation((subCol) => ({
            doc: jest.fn().mockImplementation(() => {
              if (subCol === 'recursos') return _recursoRef;
              return {};
            }),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(connectionSnap)
          }))
        }))
      })),
      _recursoRef
    };
  };

  const makeFetchFn = ({
    status = 200,
    body = { id: 'file-123', name: 'material.pdf', mimeType: 'application/pdf', trashed: false }
  } = {}) => jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body)
  });

  beforeEach(() => {
    jest.clearAllMocks();
    google.auth.OAuth2.mockImplementation(() => ({
      generateAuthUrl: mockGenerateAuthUrl,
      getToken: mockGetToken,
      refreshAccessToken: mockRefreshAccessToken,
      setCredentials: mockSetCredentials,
      getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token-preview-xyz' })
    }));
  });

  const buildService = (firestore, config = defaultConfig) =>
    crearServicioGetTemporaryFileUrlRecurso({ googleDriveConfig: { ...config, _fetchFn: makeFetchFn() }, firestore });

  it('lanza error si no hay autenticación', async () => {
    const firestore = makeFirestore();
    const service = crearServicioGetTemporaryFileUrlRecurso({ googleDriveConfig: defaultConfig, firestore });
    await expect(
      service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si faltan parámetros obligatorios', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    await expect(service({ tenantId: 'tenant-abc' }, ctx)).rejects.toThrow('tenantId y recursoId son obligatorios');
  });

  it.each(['Admin', 'SuperAdmin', 'Editor', 'Asistente', 'Maestro'])(
    'permite acceso al rol staff %s',
    async (rol) => {
      const encryptedToken = await cifrarToken('valid-refresh-token');
      const firestore = makeFirestore({ connectionData: { refreshToken: encryptedToken, status: 'active' } });
      const service = buildService(firestore);
      const ctx = { auth: { uid: 'u1', token: { rol, tenantId: rol === 'SuperAdmin' ? 'otro-tenant' : 'tenant-abc' } } };

      const result = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx);
      expect(result.ok).toBe(true);
      expect(result.url).toContain('file-123');
    }
  );

  it.each(['Estudiante', 'Tutor'])('rechaza el rol %s (esto es Biblioteca, no consumo de asignación)', async (rol) => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol, tenantId: 'tenant-abc' } } };
    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('permission-denied');
  });

  it('rechaza si el tenantId no coincide con el del token (excepto SuperAdmin)', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'otro-tenant' } } };
    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('permission-denied');
  });

  it('lanza not-found si el recurso no existe', async () => {
    const firestore = makeFirestore({ recursoRef: makeRecursoRef(null) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('not-found');
  });

  it('lanza failed-precondition si el recurso no tiene archivo de Drive asociado', async () => {
    const firestore = makeFirestore({ recurso: makeRecurso({ externalFileId: undefined }) });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };
    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('failed-precondition');
  });

  it('genera la URL temporal correctamente cuando todo es válido', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedToken, status: 'active' } });
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Maestro', tenantId: 'tenant-abc' } } };

    const result = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx);

    expect(result.ok).toBe(true);
    expect(result.url).toContain('/proxyDriveMedia');
    expect(result.url).toContain('fileId=file-123');
    expect(result.url).toContain('tenantId=tenant-abc');
    expect(result.url).toContain('recursoId=recurso-1');
    expect(result.url).not.toContain('access_token');
    expect(result.fileName).toBe('material.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.expiresAt).toBeDefined();
  });

  it('lanza not-found si el archivo fue eliminado de Drive (404), sin bloquear ninguna asignación', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedToken, status: 'active' } });
    const service = crearServicioGetTemporaryFileUrlRecurso({
      googleDriveConfig: { ...defaultConfig, _fetchFn: makeFetchFn({ status: 404 }) },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('not-found');
  });

  it('lanza not-found si el archivo está en la papelera de Drive', async () => {
    const encryptedToken = await cifrarToken('valid-refresh-token');
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedToken, status: 'active' } });
    const service = crearServicioGetTemporaryFileUrlRecurso({
      googleDriveConfig: {
        ...defaultConfig,
        _fetchFn: makeFetchFn({ body: { id: 'file-123', name: 'material.pdf', mimeType: 'application/pdf', trashed: true } })
      },
      firestore
    });
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    const err = await service({ tenantId: 'tenant-abc', recursoId: 'recurso-1' }, ctx).catch((e) => e);
    expect(err.code).toBe('not-found');
  });
});

describe('crearServicioProxyDriveMedia', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const { cifrarToken } = require('./kms');

  const makeReq = ({ headers = {}, query = {}, method = 'GET' } = {}) => ({ headers, query, method });

  const makeRes = () => {
    const res = {
      statusCode: null,
      headers: {},
      body: undefined,
    };
    res.set = jest.fn((k, v) => { res.headers[k] = v; return res; });
    res.status = jest.fn((code) => { res.statusCode = code; return res; });
    res.send = jest.fn((body) => { res.body = body; return res; });
    return res;
  };

  const makeAuth = (decoded = { rol: 'Estudiante', tenantId: 'tenant-abc' }) => ({
    verifyIdToken: jest.fn().mockResolvedValue(decoded),
  });

  const makeAsignacion = (overrides = {}) => ({
    tenantId: 'tenant-abc',
    estado: 'publicada',
    recursoId: 'recurso-111',
    ...overrides,
  });

  const makeFirestore = ({
    asignacion = makeAsignacion(),
    recurso = { tenantId: 'tenant-abc', externalFileId: 'file-123' },
    connectionData = { refreshToken: null, status: 'active' },
    asignacionExiste = true,
    recursoExiste = true,
  } = {}) => ({
    collection: jest.fn().mockImplementation((colName) => ({
      doc: jest.fn().mockImplementation(() => ({
        collection: jest.fn().mockImplementation((subCol) => ({
          doc: jest.fn().mockImplementation(() => ({
            get: jest.fn().mockResolvedValue(
              subCol === 'asignaciones'
                ? { exists: asignacionExiste, data: () => asignacion }
                : { exists: recursoExiste, data: () => recurso }
            ),
          })),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue(
            connectionData ? { empty: false, docs: [{ data: () => connectionData }] } : { empty: true, docs: [] }
          ),
        })),
      })),
    })),
  });

  // El handler ahora hace DOS llamadas a Drive por pedido: (1) `fields=mimeType` para saber si
  // el archivo es nativo de Google (Docs/Slides/Sheets, que no tienen bytes propios y necesitan
  // /export) y (2) la descarga real (alt=media o export). `metaStatus`/`mimeType` controlan la
  // primera; `status`/`body`/`contentType` controlan la segunda.
  const makeFetchFn = ({
    status = 200,
    body = 'contenido-binario-del-archivo',
    contentType = 'video/mp4',
    mimeType = 'application/octet-stream',
    metaStatus = 200,
  } = {}) => jest.fn().mockImplementation((url) => {
    if (String(url).includes('fields=mimeType')) {
      return Promise.resolve({
        ok: metaStatus >= 200 && metaStatus < 300,
        status: metaStatus,
        json: async () => ({ mimeType }),
      });
    }
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h) => (h === 'content-type' ? contentType : null) },
      arrayBuffer: async () => Buffer.from(body),
    });
  });

  let encryptedRefreshToken;
  beforeAll(async () => {
    encryptedRefreshToken = await cifrarToken('valid-refresh-token');
  });

  beforeEach(() => {
    google.auth.OAuth2.mockImplementation(() => ({
      setCredentials: mockSetCredentials,
      getAccessToken: jest.fn().mockResolvedValue({ token: 'access-token-server-side' }),
    }));
  });

  it('responde 204 y no exige auth para preflight OPTIONS', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({ method: 'OPTIONS', headers: { origin: 'https://tudojang.com' } });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://tudojang.com');
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('no agrega Access-Control-Allow-Origin para un origen no permitido', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({ method: 'OPTIONS', headers: { origin: 'https://sitio-malicioso.test' } });
    const res = makeRes();

    await servicio(req, res);

    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('rechaza con 401 si falta el header Authorization', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({ query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' } });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rechaza con 401 si el ID token de Firebase es inválido', async () => {
    const firestore = makeFirestore();
    const auth = { verifyIdToken: jest.fn().mockRejectedValue(new Error('token vencido')) };
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer token-invalido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rechaza con 400 si faltan parámetros (necesita asignacionId O recursoId)', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza con 403 si el tenantId del token no coincide (Admin, no-SuperAdmin)', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth({ rol: 'Admin', tenantId: 'otro-tenant' });
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rechaza con 403 el rol Tutor pidiendo la vista previa de Biblioteca (recursoId) -- solo staff', async () => {
    const firestore = makeFirestore();
    const auth = makeAuth({ rol: 'Tutor', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', recursoId: 'recurso-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rechaza con 404 si la asignación no existe', async () => {
    const firestore = makeFirestore({ asignacionExiste: false });
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza con 403 si la asignación no está publicada', async () => {
    const firestore = makeFirestore({ asignacion: makeAsignacion({ estado: 'borrador' }) });
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rechaza con 404 si el recurso de Biblioteca no existe (modo vista previa)', async () => {
    const firestore = makeFirestore({ recursoExiste: false });
    const auth = makeAuth({ rol: 'Admin', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', recursoId: 'recurso-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sirve los bytes reales con el Content-Type correcto para una asignación válida (Estudiante)', async () => {
    const fetchFn = makeFetchFn({ contentType: 'video/mp4', body: 'bytes-del-video' });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth({ rol: 'Estudiante', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido', origin: 'https://tudojang.com' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(auth.verifyIdToken).toHaveBeenCalledWith('id-token-valido');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['Content-Type']).toBe('video/mp4');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://tudojang.com');
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.body).toContain('bytes-del-video');
    // El fetch a Google usa el access_token generado SERVER-SIDE (Authorization header) --
    // nunca un token que haya viajado desde el navegador.
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('file-123'),
      expect.objectContaining({ headers: { Authorization: 'Bearer access-token-server-side' } })
    );
  });

  it('sirve los bytes reales para una vista previa de Biblioteca válida (Admin, sin asignación)', async () => {
    const fetchFn = makeFetchFn({ contentType: 'application/pdf', body: 'bytes-del-pdf' });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth({ rol: 'Admin', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', recursoId: 'recurso-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
  });

  it('devuelve 500 si el tenant no tiene conexión de Drive activa', async () => {
    const firestore = makeFirestore({ connectionData: null });
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({ googleDriveConfig: defaultConfig, firestore, auth });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('propaga el status de Google si Drive responde con error al pedir los bytes', async () => {
    const fetchFn = makeFetchFn({ status: 404 });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('propaga el status si falla la verificación previa de mimeType', async () => {
    const fetchFn = makeFetchFn({ metaStatus: 403 });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth();
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', asignacionId: 'asig-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // Bug real reportado 2026-07-16: un instructor asignó como "PDF" un archivo que en Drive
  // es en realidad un Google Doc nativo (no un .pdf subido). `alt=media` rechaza esos archivos
  // con 403 -- el navegador mostraba "Permisos insuficientes" aunque el usuario SÍ tenía
  // permiso, porque el verdadero problema era el endpoint usado, no el rol/tenant/asignación.
  it('usa /export en vez de alt=media para un Google Doc nativo (Drive rechaza alt=media con 403 para estos archivos)', async () => {
    const fetchFn = makeFetchFn({ mimeType: 'application/vnd.google-apps.document', body: 'bytes-del-pdf-exportado' });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth({ rol: 'Admin', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', recursoId: 'recurso-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.body).toContain('bytes-del-pdf-exportado');

    const urlsLlamadas = fetchFn.mock.calls.map(([url]) => String(url));
    expect(urlsLlamadas.some((u) => u.includes('/export') && u.includes('mimeType=application%2Fpdf'))).toBe(true);
    expect(urlsLlamadas.some((u) => u.includes('alt=media'))).toBe(false);
  });

  it('sigue usando alt=media (sin /export) para un archivo binario normal, no nativo de Google', async () => {
    const fetchFn = makeFetchFn({ mimeType: 'application/pdf', body: 'bytes-del-pdf-real' });
    const firestore = makeFirestore({ connectionData: { refreshToken: encryptedRefreshToken, status: 'active' } });
    const auth = makeAuth({ rol: 'Admin', tenantId: 'tenant-abc' });
    const servicio = crearServicioProxyDriveMedia({
      googleDriveConfig: { ...defaultConfig, _fetchFn: fetchFn },
      firestore,
      auth,
    });
    const req = makeReq({
      headers: { authorization: 'Bearer id-token-valido' },
      query: { tenantId: 'tenant-abc', fileId: 'file-123', recursoId: 'recurso-1' },
    });
    const res = makeRes();

    await servicio(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const urlsLlamadas = fetchFn.mock.calls.map(([url]) => String(url));
    expect(urlsLlamadas.some((u) => u.includes('alt=media'))).toBe(true);
    expect(urlsLlamadas.some((u) => u.includes('/export'))).toBe(false);
  });
});

