import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

const APP_CHECK_DEBUG_TOKEN_STORAGE_KEY = 'tudojang:appcheck-debug-token';

function configurarDebugTokenLocalhost() {
    if (typeof window === 'undefined') return;
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;

    const debugToken = window.localStorage.getItem(APP_CHECK_DEBUG_TOKEN_STORAGE_KEY);
    if (!debugToken) return;

    (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken === 'true' ? true : debugToken;
}

export function inicializarAppCheck(app: FirebaseApp) {
    const siteKey = process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (!siteKey || siteKey === 'undefined') return null;

    configurarDebugTokenLocalhost();

    return initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
    });
}
