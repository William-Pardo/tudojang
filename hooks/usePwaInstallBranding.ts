
// hooks/usePwaInstallBranding.ts
import { useEffect, useRef } from 'react';
import type { ConfiguracionClub } from '../tipos';

const TAMANO_CANVAS = 512;
const TAMANOS_ICONO_MANIFEST = ['any', '192x192', '512x512'];

interface DefaultsInstalacion {
    touchIconHref: string;
    appleTitle: string;
    manifestHref: string;
}

/**
 * Sincroniza lo que iOS Safari ("Compartir > Agregar a inicio") y Chrome/Android/Desktop
 * ("Instalar app") usan como ícono y nombre con el branding del tenant activo.
 *
 * iOS lee `<link rel="apple-touch-icon">` y `<meta name="apple-mobile-web-app-title">` del
 * DOM EN VIVO en el momento exacto de instalar -- no depende de manifest.json. Chrome, en
 * cambio, instala en base al Web App Manifest, así que además reemplazamos el `href` de
 * `<link rel="manifest">` por una Blob URL con el JSON armado en el cliente (Chrome
 * re-evalúa el manifest cuando ese href cambia, siempre que ocurra antes de que el usuario
 * dispare la instalación).
 *
 * Si `tenant` no trae logoUrl/nombreClub, o es null (logout, landing genérica sin tenant),
 * no se toca nada: quedan los defaults ya presentes en index.html.
 */
export const usePwaInstallBranding = (tenant: ConfiguracionClub | null): void => {
    const manifestUrlRef = useRef<string | null>(null);
    const defaultsRef = useRef<DefaultsInstalacion | null>(null);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const touchIconEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        const appleTitleEl = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
        const manifestEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');

        // Guardamos los defaults originales de index.html una sola vez (antes de la primera
        // mutación) para poder revertir exactamente a ellos después, sin hardcodear "TuDojang"
        // ni ninguna otra ruta acá.
        if (!defaultsRef.current) {
            defaultsRef.current = {
                touchIconHref: touchIconEl?.getAttribute('href') ?? '',
                appleTitle: appleTitleEl?.getAttribute('content') ?? '',
                manifestHref: manifestEl?.getAttribute('href') ?? '',
            };
        }
        const defaults = defaultsRef.current;

        const revertirADefaults = () => {
            if (manifestUrlRef.current) {
                URL.revokeObjectURL(manifestUrlRef.current);
                manifestUrlRef.current = null;
            }
            if (defaults.touchIconHref) touchIconEl?.setAttribute('href', defaults.touchIconHref);
            if (defaults.appleTitle) appleTitleEl?.setAttribute('content', defaults.appleTitle);
            if (defaults.manifestHref) manifestEl?.setAttribute('href', defaults.manifestHref);
        };

        if (!tenant || (!tenant.logoUrl && !tenant.nombreClub)) {
            revertirADefaults();
            return;
        }

        let cancelado = false;

        const aplicarBrandingInstalacion = async () => {
            const nombre = tenant.nombreClub || defaults.appleTitle;
            let iconoInstalacion = tenant.logoUrl || defaults.touchIconHref;
            let iconoEsPngOpaco = false;

            if (tenant.logoUrl) {
                try {
                    iconoInstalacion = await aplanarLogoAPngOpaco(tenant.logoUrl);
                    iconoEsPngOpaco = true;
                } catch {
                    // Falla de carga/CORS (canvas "tainted") u otro error del aplanado --
                    // seguimos con el logo original del tenant sin aplanar. No rompe la app;
                    // en iOS un logo con transparencia puede verse con fondo negro/inconsistente,
                    // pero es preferible a no mostrar el branding del tenant en absoluto.
                    iconoInstalacion = tenant.logoUrl;
                }
            }

            if (cancelado) return;

            if (nombre) appleTitleEl?.setAttribute('content', nombre);
            if (iconoInstalacion) touchIconEl?.setAttribute('href', iconoInstalacion);

            if (manifestEl) {
                const blobPrevia = manifestUrlRef.current;
                const manifestJson = {
                    short_name: nombre,
                    name: nombre,
                    description: 'Módulo integral para la gestión de escuelas de Taekwondo.',
                    icons: TAMANOS_ICONO_MANIFEST.map((sizes) => ({
                        src: iconoInstalacion,
                        ...(iconoEsPngOpaco ? { type: 'image/png' } : {}),
                        sizes,
                    })),
                    start_url: '.',
                    display: 'standalone',
                    theme_color: '#1f3e90',
                    background_color: '#ffffff',
                };
                const blobUrl = URL.createObjectURL(
                    new Blob([JSON.stringify(manifestJson)], { type: 'application/manifest+json' })
                );
                manifestUrlRef.current = blobUrl;
                manifestEl.setAttribute('href', blobUrl);
                if (blobPrevia) URL.revokeObjectURL(blobPrevia);
            }
        };

        aplicarBrandingInstalacion();

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant?.logoUrl, tenant?.nombreClub]);

    // Al desmontar definitivamente el provider (ej. cierre completo de la SPA), liberamos
    // cualquier Blob URL viva para no dejar memory leaks.
    useEffect(() => {
        return () => {
            if (manifestUrlRef.current) {
                URL.revokeObjectURL(manifestUrlRef.current);
                manifestUrlRef.current = null;
            }
        };
    }, []);
};

/**
 * Dibuja `logoUrl` centrado sobre un fondo blanco opaco vía canvas y devuelve un data URL
 * PNG. iOS no soporta bien PNG con canal alfa para apple-touch-icon (puede verse negro o
 * inconsistente), por eso el aplanado.
 *
 * Requiere que la imagen sea cargable con crossOrigin="anonymous" y que el bucket de
 * origen (Firebase Storage) tenga CORS habilitado para lectura anónima cross-origin -- si
 * no lo tiene, el canvas queda "tainted" y toDataURL lanza SecurityError, que el caller
 * atrapa para usar el logo original sin aplanar como fallback.
 */
const aplanarLogoAPngOpaco = (logoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = TAMANO_CANVAS;
                canvas.height = TAMANO_CANVAS;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D no disponible'));
                    return;
                }

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, TAMANO_CANVAS, TAMANO_CANVAS);

                // Encaja el logo centrado, manteniendo proporción, sin recortarlo.
                const escala = Math.min(TAMANO_CANVAS / img.width, TAMANO_CANVAS / img.height);
                const w = img.width * escala;
                const h = img.height * escala;
                const x = (TAMANO_CANVAS - w) / 2;
                const y = (TAMANO_CANVAS - h) / 2;
                ctx.drawImage(img, x, y, w, h);

                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => reject(new Error('No se pudo cargar el logo del tenant'));
        img.src = logoUrl;
    });
};
