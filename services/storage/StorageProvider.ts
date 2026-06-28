// services/storage/StorageProvider.ts
// Interfaz abstracta para proveedores de almacenamiento (Storage Providers) en Tudojang.
// Define el contrato común para acceder a archivos institucionales externos.

export interface StorageFile {
  /** Identificador único del archivo en el proveedor externo. */
  id: string;
  
  /** Nombre del archivo o carpeta. */
  name: string;
  
  /** Tipo MIME del archivo (por ejemplo, 'application/pdf', 'video/mp4'). */
  mimeType: string;
  
  /** Tamaño del archivo en bytes (opcional, puede no estar disponible para carpetas o ciertos archivos). */
  size?: number;
  
  /** Enlace para visualizar el archivo directamente en la interfaz del proveedor (opcional). */
  webViewLink?: string;
  
  /** Identificadores de las carpetas padre (opcional). */
  parents?: string[];
  
  /** Fecha y hora de la última modificación en formato ISO 8601 (opcional). */
  modifiedTime?: string;
}

/**
 * Clase abstracta que define el contrato de almacenamiento para Tudojang.
 * Todos los proveedores de almacenamiento institucional (como Google Drive, OneDrive, etc.)
 * deben extender esta clase e implementar sus métodos.
 */
export abstract class StorageProvider {
  /**
   * Lista los archivos y subcarpetas contenidos en una carpeta específica.
   * Útil para explorar el árbol de directorios y seleccionar archivos para importar a la biblioteca académica.
   *
   * @param folderId El identificador de la carpeta a listar. Si no se especifica, se listará desde la carpeta raíz.
   * @returns Una promesa que resuelve con una lista de objetos StorageFile.
   * @throws Error si ocurre un fallo de conexión o si la carpeta no es accesible.
   */
  abstract listFiles(folderId?: string): Promise<StorageFile[]>;

  /**
   * Obtiene los metadatos detallados de un archivo específico por su identificador.
   * Útil para sincronizar cambios de metadatos (nombres, eliminaciones, movimientos) en la biblioteca académica.
   *
   * @param fileId El identificador único del archivo.
   * @returns Una promesa que resuelve con los metadatos del archivo.
   * @throws Error si el archivo no existe, fue eliminado o si no se tienen permisos de acceso.
   */
  abstract getFileMetadata(fileId: string): Promise<StorageFile>;

  /**
   * Genera una URL de acceso temporal y firmada para un archivo.
   * El frontend utilizará esta URL para renderizar o reproducir el recurso sin tener contacto directo
   * con los tokens de acceso del proveedor.
   *
   * @param fileId El identificador único del archivo.
   * @param expiresInSeconds Tiempo de vida de la URL temporal en segundos. Por defecto debe ser de 900 segundos (15 minutos).
   * @returns Una promesa que resuelve con la URL temporal firmada para acceder al recurso.
   * @throws Error si el archivo no existe o no se puede generar el enlace temporal.
   */
  abstract getTemporaryUrl(fileId: string, expiresInSeconds?: number): Promise<string>;
}
