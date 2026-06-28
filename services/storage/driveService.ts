// services/storage/driveService.ts
// Servicio frontend para la integración con Google Drive académico de Tudojang.
// Orquesta el flujo OAuth desde el lado del cliente: iniciar conexión, procesar callback,
// seleccionar carpeta raíz y obtener URLs temporales de archivos.
// IMPORTANTE: Nunca maneja tokens de Drive directamente — todo pasa por Cloud Functions.

import { getFunctions, httpsCallable } from 'firebase/functions';

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

// ---------------------------------------------------------------------------
// Fábrica del servicio con inyección de dependencias
// ---------------------------------------------------------------------------

export interface DriveServiceDeps {
  /**
   * Callable httpsCallable de Firebase Functions (inyectable para tests).
   * Si no se provee, se usa `httpsCallable(getFunctions(), ...)` por defecto.
   */
  callFn?: <TReq, TRes>(name: string) => (data: TReq) => Promise<{ data: TRes }>;
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

  return {
    iniciarConexionOAuth,
    procesarCallbackOAuth,
    listarCarpetaDrive,
    obtenerUrlTemporal,
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
