// services/storage/driveService.ts
// Servicio frontend para la integración con Google Drive académico de Tudojang.
// Orquesta el flujo OAuth desde el lado del cliente: iniciar conexión, procesar callback,
// seleccionar carpeta raíz y obtener URLs temporales de archivos.
// IMPORTANTE: Nunca maneja tokens de Drive directamente — todo pasa por Cloud Functions.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DriveConnectionResult {
  /** URL de consentimiento OAuth2 generada por la Cloud Function. */
  url: string;
}

export interface DriveOAuthCallbackResult {
  ok: boolean;
  connectionId: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
  modifiedTime?: string;
  size?: number;
}

export interface TemporaryFileUrlResult {
  ok: boolean;
  url: string;
  fileName: string;
  mimeType: string;
  /** ISO 8601 — cuándo vence la URL (≈ 15 min desde la generación). */
  expiresAt: string;
}

export interface DriveListFolderResult {
  files: DriveFile[];
}

export interface DriveDisconnectResult {
  ok: boolean;
  disconnectedCount: number;
}

export interface DriveConnectionInfo {
  connected: boolean;
  connectionId?: string;
  activeFolderId?: string;
  activeFolderName?: string;
  googleAccountEmail?: string;
  status?: string;
}

export interface DriveSetFolderResult {
  ok: boolean;
  connectionId: string;
  activeFolderId: string;
  activeFolderName?: string;
}

// ---------------------------------------------------------------------------
// Fábrica del servicio con inyección de dependencias
// ---------------------------------------------------------------------------

export interface DriveServiceDeps {
  /**
   * Callable httpsCallable de Firebase Functions (inyectable para tests).
   * Si no se provee, se usa `httpsCallable(getFunctions(), ...)` por defecto.
   */
  callFn?: <TReq, TRes>(name: string) => (data: TReq) => Promise<{ data: TRes }>;
  /**
   * Resuelve el ID token de Firebase del usuario actual (inyectable para tests).
   * Por defecto usa `getAuth().currentUser?.getIdToken()`.
   */
  obtenerIdToken?: () => Promise<string | null>;
  /** fetch inyectable para tests. Por defecto usa el `fetch` global del navegador. */
  fetchFn?: typeof fetch;
}

/**
 * Crea el servicio de Drive con dependencias inyectadas (facilita testing).
 */
export const crearDriveService = (deps: DriveServiceDeps = {}) => {
  const call = deps.callFn
    ? deps.callFn
    : <TReq, TRes>(name: string) => {
        const fn = httpsCallable<TReq, TRes>(getFunctions(), name);
        return (data: TReq) => fn(data);
      };

  const obtenerIdToken = deps.obtenerIdToken
    ? deps.obtenerIdToken
    : async () => getAuth().currentUser?.getIdToken() ?? null;

  /**
   * Descarga el contenido real de un archivo protegido (video/pdf/imagen) vía nuestro proxy
   * (`proxyDriveMedia`), autenticando con el ID token REAL de Firebase del usuario actual --
   * NO con ningún token de Drive (ese nunca sale del servidor). Se usa para armar un
   * `blob:` local que `<video>`/`<img>`/react-pdf pueden reproducir sin volver a pedir nada
   * a través de la red por su cuenta.
   *
   * `fetch` se resuelve recién acá adentro (no al crear el servicio): el singleton del
   * módulo se instancia al importar, y en algunos entornos (tests bajo Jest/jsdom) `fetch`
   * global todavía no existe en ese momento.
   */
  const obtenerBlobProtegido = async (url: string): Promise<Blob> => {
    const fetchFn = deps.fetchFn ?? fetch;
    const idToken = await obtenerIdToken();
    const response = await fetchFn(url, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
    if (!response.ok) {
      const error = new Error(`No se pudo cargar el recurso protegido (status ${response.status})`);
      // El proxy re-valida rol/tenant/asignación-o-recurso y también re-verifica el archivo en
      // Drive -- distintos status reflejan causas bien distintas, no todas son "sin permiso".
      const codigoPorStatus: Record<number, string> = {
        401: 'unauthenticated',
        403: 'permission-denied',
        404: 'not-found',
      };
      (error as Error & { code?: string }).code = codigoPorStatus[response.status] ?? 'server-error';
      throw error;
    }
    return response.blob();
  };

  /**
   * Inicia el flujo OAuth de Google Drive.
   * Llama a la Cloud Function `connectDrive` y devuelve la URL de consentimiento
   * de Google para que el frontend abra una ventana de autorización.
   *
   * @param tenantId - Identificador del tenant que conecta Drive.
   * @param redirectUri - URI de redirección después del consentimiento (opcional).
   * @returns URL de consentimiento OAuth2 de Google.
   */
  const iniciarConexionOAuth = async (
    tenantId: string,
    redirectUri?: string
  ): Promise<string> => {
    const callConnectDrive = call<
      { tenantId: string; redirectUri?: string },
      DriveConnectionResult
    >('connectDrive');

    const result = await callConnectDrive({ tenantId, redirectUri });
    return result.data.url;
  };

  /**
   * Procesa el código OAuth recibido en el callback de Google.
   * Llama a la Cloud Function `driveOAuthCallback` para intercambiar el código
   * por tokens y almacenarlos de forma segura.
   *
   * @param tenantId - Identificador del tenant.
   * @param code - Código de autorización de Google OAuth.
   * @param redirectUri - URI de redirección usada en el inicio del flujo (debe coincidir).
   * @returns Resultado de la conexión con el connectionId generado.
   */
  const procesarCallbackOAuth = async (
    tenantId: string,
    code: string,
    redirectUri?: string
  ): Promise<DriveOAuthCallbackResult> => {
    const callCallback = call<
      { tenantId: string; code: string; redirectUri?: string },
      DriveOAuthCallbackResult
    >('driveOAuthCallback');

    const result = await callCallback({ tenantId, code, redirectUri });
    return result.data;
  };

  /**
   * Lista archivos y subcarpetas dentro de una carpeta de Google Drive.
   * Llama a la Cloud Function `listDriveFolder` para obtener el contenido sin
   * exponer el access_token al frontend.
   *
   * @param tenantId - Identificador del tenant.
   * @param folderId - ID de la carpeta de Drive a listar ('root' para la raíz).
   * @returns Lista de archivos y carpetas.
   */
  const listarCarpetaDrive = async (
    tenantId: string,
    folderId: string = 'root'
  ): Promise<DriveFile[]> => {
    const callListFolder = call<
      { tenantId: string; folderId: string },
      DriveListFolderResult
    >('listDriveFolder');

    const result = await callListFolder({ tenantId, folderId });
    return result.data.files;
  };

  /**
   * Desconecta Google Drive para un tenant.
   * La Cloud Function marca las conexiones activas como desconectadas y revoca el token cuando es posible.
   */
  const desconectarDrive = async (
    tenantId: string
  ): Promise<DriveDisconnectResult> => {
    const callDisconnect = call<
      { tenantId: string },
      DriveDisconnectResult
    >('disconnectDrive');

    const result = await callDisconnect({ tenantId });
    return result.data;
  };

  /**
   * Obtiene la conexion activa de Drive del tenant, incluyendo carpeta activa persistida en Firestore.
   */
  const obtenerConexionDrive = async (
    tenantId: string
  ): Promise<DriveConnectionInfo> => {
    const callGetConnection = call<
      { tenantId: string },
      DriveConnectionInfo
    >('getDriveConnection');

    const result = await callGetConnection({ tenantId });
    return result.data;
  };

  /**
   * Persiste la carpeta institucional activa para todos los admins del tenant.
   */
  const guardarCarpetaActiva = async (
    tenantId: string,
    folderId: string,
    folderName?: string
  ): Promise<DriveSetFolderResult> => {
    const callSetFolder = call<
      { tenantId: string; folderId: string; folderName?: string },
      DriveSetFolderResult
    >('setDriveFolder');

    const result = await callSetFolder({ tenantId, folderId, folderName });
    return result.data;
  };

  /**
   * Obtiene una URL temporal (15 min) para acceder a un archivo de Drive.
   * Valida que exista una asignación activa antes de generar la URL.
   * Si el archivo fue eliminado, la Cloud Function marca la asignación como bloqueada.
   *
   * @param tenantId - Identificador del tenant.
   * @param asignacionId - ID de la asignación académica que contiene el recurso.
   * @param fileId - ID del archivo en Google Drive.
   * @returns Objeto con la URL temporal, nombre, tipo MIME y fecha de expiración.
   * @throws Error si la asignación está vencida, bloqueada, o el archivo fue eliminado.
   */
  const obtenerUrlTemporal = async (
    tenantId: string,
    asignacionId: string,
    fileId: string
  ): Promise<TemporaryFileUrlResult> => {
    const callGetUrl = call<
      { tenantId: string; asignacionId: string; fileId: string },
      TemporaryFileUrlResult
    >('getTemporaryFileUrl');

    const result = await callGetUrl({ tenantId, asignacionId, fileId });
    return result.data;
  };

  /**
   * Vista previa de un recurso de la Biblioteca (Admin/Editor/Asistente/Maestro), pedida
   * explícitamente para poder confirmar el contenido real de un archivo antes/después de
   * asignarlo. A diferencia de `obtenerUrlTemporal`, NO depende de que exista una
   * asignación publicada -- valida directo contra el recurso.
   */
  const obtenerUrlTemporalRecurso = async (
    tenantId: string,
    recursoId: string
  ): Promise<TemporaryFileUrlResult> => {
    const callGetUrlRecurso = call<
      { tenantId: string; recursoId: string },
      TemporaryFileUrlResult
    >('getTemporaryFileUrlRecurso');

    const result = await callGetUrlRecurso({ tenantId, recursoId });
    return result.data;
  };

  return {
    iniciarConexionOAuth,
    procesarCallbackOAuth,
    listarCarpetaDrive,
    obtenerUrlTemporal,
    obtenerUrlTemporalRecurso,
    obtenerBlobProtegido,
    desconectarDrive,
    obtenerConexionDrive,
    guardarCarpetaActiva,
  };
};

// ---------------------------------------------------------------------------
// Instancia por defecto (singleton para uso en la app)
// ---------------------------------------------------------------------------

/**
 * Instancia por defecto del driveService.
 * En producción usa Firebase Functions directamente.
 * En tests, usar `crearDriveService({ callFn: mockFn })`.
 */
export const driveService = crearDriveService();
