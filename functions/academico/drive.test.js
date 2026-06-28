// functions/academico/drive.test.js
// Tests para los servicios de integración con Google Drive.
// Usan inyección de dependencias y mocks del SDK de Google.

'use strict';

const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?scope=drive.readonly');
const mockGetToken = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockSetCredentials = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        refreshAccessToken: mockRefreshAccessToken,
        setCredentials: mockSetCredentials
      }))
    }
  }
}));

const { google } = require('googleapis');
const { crearServicioConnectDrive, crearServicioDriveOAuthCallback, crearServicioRefreshDriveToken, crearServicioGetTemporaryFileUrl, crearServicioSyncDriveMetadata } = require('./drive');

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
  });

  const buildService = (config = defaultConfig) => {
    return crearServicioConnectDrive({ googleDriveConfig: config });
  };

  it('lanza error si no hay autenticación', async () => {
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

  it('lanza error si la configuración de Google Drive está incompleta (falta clientId)', async () => {
    const service = buildService({ ...defaultConfig, clientId: null });
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Configuración de Google Drive incompleta');
  });

  it('lanza error si la configuración de Google Drive está incompleta (falta clientSecret)', async () => {
    const service = buildService({ ...defaultConfig, clientSecret: null });
    const ctx = makeContext();
    await expect(
      service({ tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Configuración de Google Drive incompleta');
  });

  it('lanza error si la configuración de Google Drive está incompleta (falta redirectUri)', async () => {
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
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
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
    const getMock = jest.fn().mockResolvedValue({
      empty: connections.length === 0,
      docs: connections.map(c => ({
        ref: finalDocRef,
        data: () => c,
      })),
    });

    return {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: getMock,
            }),
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

  it('lanza error si no hay autenticación', async () => {
    const firestore = makeFirestoreForDrive();
    const service = buildService(firestore);
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
    const service = buildService(firestore);
    const ctx = makeContext();

    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: 12345678,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
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
    expect(connectionData.refreshToken).toBeDefined();
    // Debe ser un string JSON conteniendo content, iv, tag (formato cifrado de kms)
    const parsedKms = JSON.parse(connectionData.refreshToken);
    expect(parsedKms.content).toBeDefined();
    expect(parsedKms.iv).toBeDefined();
    expect(parsedKms.tag).toBeDefined();
  });

  it('usa el refresh_token anterior si la reconexión no lo devuelve y ya existía conexión', async () => {
    const existingConnection = {
      id: 'conn-123',
      tenantId: 'tenant-abc',
      refreshToken: JSON.stringify({ content: 'crypted-old-token', iv: 'iv', tag: 'tag' }),
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
    ).rejects.toThrow('No se recibió refresh_token y no existe una conexión previa');
  });
});

describe('crearServicioRefreshDriveToken', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  // Usa kms real para cifrar tokens en los tests (sin mock — verifica integración real con kms.js)
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

  it('lanza error si no hay autenticación', async () => {
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
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      refreshToken: encryptedToken
    };
    const firestore = makeFirestoreForRefresh(connData);
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Admin', tenantId: 'tenant-abc' } } };

    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'new-access-token-xyz',
        expiry_date: 9999999,
        scope: 'https://www.googleapis.com/auth/drive.readonly'
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
  jest.resetModules(); // no necesario aquí pero lo dejamos como referencia
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
    estado: 'activa',
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
    // Asegurar que getAccessToken esté disponible en el mock de OAuth2
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

  it('lanza error si no hay autenticación', async () => {
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

  it('rechaza acceso si el rol es Tutor (403)', async () => {
    const firestore = makeFirestore();
    const service = buildService(firestore);
    const ctx = { auth: { uid: 'u1', token: { rol: 'Tutor', tenantId: 'tenant-abc' } } };
    const err = await service(
      { tenantId: 'tenant-abc', asignacionId: 'asig-1', fileId: 'file-123' },
      ctx
    ).catch(e => e);
    expect(err.message).toMatch('No autorizado para acceder a recursos académicos');
    expect(err.code).toBe('permission-denied');
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

  it('rechaza si la asignación ya venció por fechaCierre', async () => {
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

  it('genera URL temporal correctamente para acceso válido', async () => {
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
    expect(result.url).toContain('file-123');
    expect(result.url).toContain('access-token-temporal-xyz');
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
    // Verifica que se bloqueó la asignación
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

describe('crearServicioSyncDriveMetadata', () => {
  const defaultConfig = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://app.tudojang.com/oauth-callback'
  };

  const { cifrarToken } = require('./kms');

  beforeEach(() => {
    jest.clearAllMocks();
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
