// utils/academico/youtubeUrl.ts
// Parseo y validación de URLs de YouTube pegadas por staff al clasificar un recurso de
// video en la Biblioteca (vistas/admin/BibliotecaView.tsx). Reemplaza, SOLO para VIDEO,
// el flujo de servir el archivo desde Google Drive vía el proxy `proxyDriveMedia`
// (functions/academico/drive.js) -- ese proxy no tiene Cache-Control/ETag, así que cada
// reproducción redescarga el archivo entero. Guardamos el ID parseado (no la URL cruda)
// en `RecursoAcademico.youtubeVideoId` / `AsignacionAcademica.youtubeVideoId`.

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extrae el ID de 11 caracteres de un video de YouTube a partir de:
 *   - la URL completa: https://www.youtube.com/watch?v=ID (con o sin otros query params)
 *   - la URL corta: https://youtu.be/ID
 *   - la URL embed/shorts: https://www.youtube.com/embed/ID , https://www.youtube.com/shorts/ID
 *   - el ID pelado: ID (11 caracteres, sin protocolo ni barras)
 *
 * Acepta también variantes sin protocolo (ej. "youtu.be/ID" o "www.youtube.com/watch?v=ID").
 * Devuelve `null` si el texto no matchea ningún formato conocido o el ID resultante no
 * tiene el largo/alfabeto esperado ([a-zA-Z0-9_-]{11}).
 */
export function parsearYoutubeVideoId(input: string): string | null {
  const texto = (input ?? '').trim();
  if (!texto) return null;

  // Caso 1: ID pelado (sin protocolo ni barras) -- validar antes de intentar armar una URL.
  if (YOUTUBE_VIDEO_ID_REGEX.test(texto)) {
    return texto;
  }

  let url: URL;
  try {
    // Soporta que el usuario pegue sin protocolo (ej. "youtu.be/ID").
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0] ?? '';
    return YOUTUBE_VIDEO_ID_REGEX.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return YOUTUBE_VIDEO_ID_REGEX.test(id) ? id : null;
    }

    const embedMatch = url.pathname.match(/^\/(embed|shorts|v)\/([^/]+)/);
    if (embedMatch) {
      const id = embedMatch[2] ?? '';
      return YOUTUBE_VIDEO_ID_REGEX.test(id) ? id : null;
    }
  }

  return null;
}

/** `true` si el texto pegado parsea a un ID de video de YouTube válido. */
export function esUrlYoutubeValida(input: string): boolean {
  return parsearYoutubeVideoId(input) !== null;
}
