// services/storage/driveService.test.ts
// Tests unitarios del servicio frontend de Google Drive.
// Usan inyección de dependencias para mockear las Cloud Functions.

import {
  crearDriveService,
  DriveConnectionResult,
  DriveOAuthCallbackResult,
  DriveListFolderResult,
  TemporaryFileUrlResult,
  DriveDisconnectResult,
  DriveConnectionInfo,
  DriveSetFolderResult,
} from './driveService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fábrica de mock para `callFn`.
 * Devuelve un spy que, dado el nombre de la función, responde con el valor indicado.
 */
const makeMockCallFn = (responses: Record<string, unknown>) => {
  const spy = jest.fn().mockImplementation((name: string) => {
    return jest.fn().mockResolvedValue({ data: responses[name] });
  });
  return spy;
};

// ---------------------------------------------------------------------------
// Suite: iniciarConexionOAuth
// ---------------------------------------------------------------------------
describe('driveService.iniciarConexionOAuth', () => {
  it('llama a la Cloud Function connectDrive y devuelve la URL de OAuth', async () => {
    const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?scope=drive.file';
    const callFn = makeMockCallFn({
      connectDrive: { url: expectedUrl } as DriveConnectionResult,
    });

    const service = crearDriveService({ callFn });
    const url = await service.iniciarConexionOAuth('tenant-abc');

    expect(callFn).toHaveBeenCalledWith('connectDrive');
    expect(url).toBe(expectedUrl);
  });

  it('pasa el tenantId y el redirectUri opcionales correctamente', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({ data: { url: 'https://oauth.url' } });
      })
    );

    const service = crearDriveService({ callFn });
    await service.iniciarConexionOAuth('tenant-xyz', 'https://app.tudojang.com/callback');

    expect(capturedArgs).toEqual({
      tenantId: 'tenant-xyz',
      redirectUri: 'https://app.tudojang.com/callback',
    });
  });

  it('no incluye redirectUri si no se pasa', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({ data: { url: 'https://oauth.url' } });
      })
    );

    const service = crearDriveService({ callFn });
    await service.iniciarConexionOAuth('tenant-abc');

    expect((capturedArgs as Record<string, unknown>).redirectUri).toBeUndefined();
  });

  it('propaga errores de la Cloud Function', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(new Error('Cloud Function no disponible'))
    );

    const service = crearDriveService({ callFn });
    await expect(service.iniciarConexionOAuth('tenant-abc')).rejects.toThrow(
      'Cloud Function no disponible'
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: procesarCallbackOAuth
// ---------------------------------------------------------------------------
describe('driveService.procesarCallbackOAuth', () => {
  it('llama a driveOAuthCallback con los parámetros correctos y devuelve el connectionId', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({
          data: { ok: true, connectionId: 'conn-789' } as DriveOAuthCallbackResult,
        });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.procesarCallbackOAuth('tenant-abc', 'code-xyz', 'https://redirect.uri');

    expect(callFn).toHaveBeenCalledWith('driveOAuthCallback');
    expect(capturedArgs).toEqual({
      tenantId: 'tenant-abc',
      code: 'code-xyz',
      redirectUri: 'https://redirect.uri',
    });
    expect(result.ok).toBe(true);
    expect(result.connectionId).toBe('conn-789');
  });

  it('propaga errores de la Cloud Function al callback', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(new Error('Código inválido'))
    );

    const service = crearDriveService({ callFn });
    await expect(
      service.procesarCallbackOAuth('tenant-abc', 'bad-code')
    ).rejects.toThrow('Código inválido');
  });
});

// ---------------------------------------------------------------------------
// Suite: listarCarpetaDrive
// ---------------------------------------------------------------------------
describe('driveService.listarCarpetaDrive', () => {
  const mockFiles = [
    { id: 'file-1', name: 'Módulo 1.pdf', mimeType: 'application/pdf' },
    { id: 'folder-1', name: 'Carpeta de Videos', mimeType: 'application/vnd.google-apps.folder' },
  ];

  it('llama a listDriveFolder con el folderId correcto y devuelve la lista de archivos', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({
          data: { files: mockFiles } as DriveListFolderResult,
        });
      })
    );

    const service = crearDriveService({ callFn });
    const files = await service.listarCarpetaDrive('tenant-abc', 'folder-root-id');

    expect(callFn).toHaveBeenCalledWith('listDriveFolder');
    expect(capturedArgs).toEqual({ tenantId: 'tenant-abc', folderId: 'folder-root-id' });
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('Módulo 1.pdf');
  });

  it('usa "root" como folderId por defecto si no se especifica', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({ data: { files: [] } });
      })
    );

    const service = crearDriveService({ callFn });
    await service.listarCarpetaDrive('tenant-abc');

    expect((capturedArgs as Record<string, unknown>).folderId).toBe('root');
  });

  it('devuelve lista vacía si la carpeta no tiene archivos', async () => {
    const callFn = makeMockCallFn({ listDriveFolder: { files: [] } as DriveListFolderResult });
    const service = crearDriveService({ callFn });
    const files = await service.listarCarpetaDrive('tenant-abc', 'empty-folder');
    expect(files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Suite: desconectarDrive
// ---------------------------------------------------------------------------
describe('driveService.desconectarDrive', () => {
  it('llama a disconnectDrive con tenantId y devuelve el resultado', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({
          data: { ok: true, disconnectedCount: 1 } as DriveDisconnectResult,
        });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.desconectarDrive('tenant-abc');

    expect(callFn).toHaveBeenCalledWith('disconnectDrive');
    expect(capturedArgs).toEqual({ tenantId: 'tenant-abc' });
    expect(result).toEqual({ ok: true, disconnectedCount: 1 });
  });
});

// ---------------------------------------------------------------------------
// Suite: obtenerConexionDrive / guardarCarpetaActiva
// ---------------------------------------------------------------------------
describe('driveService.obtenerConexionDrive', () => {
  it('llama a getDriveConnection con tenantId y devuelve carpeta activa', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({
          data: {
            connected: true,
            connectionId: 'conn-123',
            activeFolderId: 'folder-abc',
            status: 'active',
          } as DriveConnectionInfo,
        });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.obtenerConexionDrive('tenant-abc');

    expect(callFn).toHaveBeenCalledWith('getDriveConnection');
    expect(capturedArgs).toEqual({ tenantId: 'tenant-abc' });
    expect(result).toEqual({
      connected: true,
      connectionId: 'conn-123',
      activeFolderId: 'folder-abc',
      status: 'active',
    });
  });
});

describe('driveService.guardarCarpetaActiva', () => {
  it('llama a setDriveFolder con tenantId y folderId', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({
          data: {
            ok: true,
            connectionId: 'conn-123',
            activeFolderId: 'folder-abc',
          } as DriveSetFolderResult,
        });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.guardarCarpetaActiva('tenant-abc', 'folder-abc');

    expect(callFn).toHaveBeenCalledWith('setDriveFolder');
    expect(capturedArgs).toEqual({ tenantId: 'tenant-abc', folderId: 'folder-abc' });
    expect(result).toEqual({
      ok: true,
      connectionId: 'conn-123',
      activeFolderId: 'folder-abc',
    });
  });
});

// ---------------------------------------------------------------------------
// Suite: obtenerUrlTemporal
// ---------------------------------------------------------------------------
describe('driveService.obtenerUrlTemporal', () => {
  const mockUrlResult: TemporaryFileUrlResult = {
    ok: true,
    url: 'https://www.googleapis.com/drive/v3/files/file-abc?alt=media&access_token=tok-xyz',
    fileName: 'modulo1.pdf',
    mimeType: 'application/pdf',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  it('llama a getTemporaryFileUrl con los parámetros correctos y devuelve la URL', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({ data: mockUrlResult });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.obtenerUrlTemporal('tenant-abc', 'asig-1', 'file-abc');

    expect(callFn).toHaveBeenCalledWith('getTemporaryFileUrl');
    expect(capturedArgs).toEqual({
      tenantId: 'tenant-abc',
      asignacionId: 'asig-1',
      fileId: 'file-abc',
    });
    expect(result.ok).toBe(true);
    expect(result.url).toContain('file-abc');
    expect(result.fileName).toBe('modulo1.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.expiresAt).toBeDefined();
  });

  it('propaga error 403 cuando la asignación está vencida', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(
        Object.assign(new Error('La asignación ha vencido'), { code: 'permission-denied' })
      )
    );

    const service = crearDriveService({ callFn });
    await expect(
      service.obtenerUrlTemporal('tenant-abc', 'asig-vencida', 'file-abc')
    ).rejects.toThrow('La asignación ha vencido');
  });

  it('propaga error cuando el archivo fue eliminado de Drive', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(
        Object.assign(
          new Error('El archivo ya no existe en Google Drive. La asignación ha sido bloqueada.'),
          { code: 'not-found', archivoBloqueado: true }
        )
      )
    );

    const service = crearDriveService({ callFn });
    const err = await service
      .obtenerUrlTemporal('tenant-abc', 'asig-1', 'file-eliminado')
      .catch((e) => e);

    expect(err.message).toMatch('ya no existe en Google Drive');
    expect(err.code).toBe('not-found');
  });

  it('propaga error genérico de la Cloud Function', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(new Error('Error interno del servidor'))
    );

    const service = crearDriveService({ callFn });
    await expect(
      service.obtenerUrlTemporal('tenant-abc', 'asig-1', 'file-abc')
    ).rejects.toThrow('Error interno del servidor');
  });
});

// ---------------------------------------------------------------------------
// Suite: obtenerUrlTemporalRecurso (Vista previa de Biblioteca, sin asignación)
// ---------------------------------------------------------------------------
describe('driveService.obtenerUrlTemporalRecurso', () => {
  const mockUrlResult: TemporaryFileUrlResult = {
    ok: true,
    url: 'https://www.googleapis.com/drive/v3/files/file-abc?alt=media&access_token=tok-xyz',
    fileName: 'modulo1.pdf',
    mimeType: 'application/pdf',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  it('llama a getTemporaryFileUrlRecurso con tenantId y recursoId (sin asignacionId ni fileId)', async () => {
    let capturedArgs: unknown;
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockImplementation((args: unknown) => {
        capturedArgs = args;
        return Promise.resolve({ data: mockUrlResult });
      })
    );

    const service = crearDriveService({ callFn });
    const result = await service.obtenerUrlTemporalRecurso('tenant-abc', 'recurso-1');

    expect(callFn).toHaveBeenCalledWith('getTemporaryFileUrlRecurso');
    expect(capturedArgs).toEqual({ tenantId: 'tenant-abc', recursoId: 'recurso-1' });
    expect(result.ok).toBe(true);
    expect(result.url).toContain('file-abc');
  });

  it('propaga permission-denied cuando el rol no es staff (Estudiante/Tutor)', async () => {
    const callFn = jest.fn().mockImplementation((_name: string) =>
      jest.fn().mockRejectedValue(
        Object.assign(new Error('No autorizado para previsualizar recursos de la biblioteca'), { code: 'permission-denied' })
      )
    );

    const service = crearDriveService({ callFn });
    const err = await service.obtenerUrlTemporalRecurso('tenant-abc', 'recurso-1').catch((e) => e);
    expect(err.code).toBe('permission-denied');
  });
});

// ---------------------------------------------------------------------------
// Suite: obtenerBlobProtegido (proxy seguro -- fetch con el ID token real de Firebase)
// ---------------------------------------------------------------------------
describe('driveService.obtenerBlobProtegido', () => {
  it('pide la URL con el ID token de Firebase en el header Authorization y devuelve el blob', async () => {
    const blobFalso = new Blob(['contenido']);
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchFn = jest.fn().mockImplementation((url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(blobFalso) });
    });
    const obtenerIdToken = jest.fn().mockResolvedValue('id-token-de-firebase');

    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken });
    const resultado = await service.obtenerBlobProtegido('https://us-central1-tudojang.cloudfunctions.net/proxyDriveMedia?fileId=x');

    expect(capturedUrl).toBe('https://us-central1-tudojang.cloudfunctions.net/proxyDriveMedia?fileId=x');
    expect(capturedInit).toEqual({ headers: { Authorization: 'Bearer id-token-de-firebase' } });
    expect(resultado).toBe(blobFalso);
  });

  it('no manda header Authorization si no hay usuario logueado (idToken null)', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedInit = init;
      return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new Blob()) });
    });
    const obtenerIdToken = jest.fn().mockResolvedValue(null);

    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken });
    await service.obtenerBlobProtegido('https://proxy.test/x');

    expect(capturedInit).toEqual({ headers: {} });
  });

  it('lanza error con code not-found si el proxy responde 404', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken: jest.fn().mockResolvedValue('t') });

    const err = await service.obtenerBlobProtegido('https://proxy.test/x').catch((e) => e);
    expect(err.code).toBe('not-found');
  });

  it('lanza error con code permission-denied si el proxy responde 403', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken: jest.fn().mockResolvedValue('t') });

    const err = await service.obtenerBlobProtegido('https://proxy.test/x').catch((e) => e);
    expect(err.code).toBe('permission-denied');
  });

  it('lanza error con code unauthenticated si el proxy responde 401 (token vencido)', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken: jest.fn().mockResolvedValue('t') });

    const err = await service.obtenerBlobProtegido('https://proxy.test/x').catch((e) => e);
    expect(err.code).toBe('unauthenticated');
  });

  it('lanza error con code server-error (no permission-denied) si el proxy responde 500 -- no es un problema de permisos', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const service = crearDriveService({ fetchFn: fetchFn as any, obtenerIdToken: jest.fn().mockResolvedValue('t') });

    const err = await service.obtenerBlobProtegido('https://proxy.test/x').catch((e) => e);
    expect(err.code).toBe('server-error');
  });
});
