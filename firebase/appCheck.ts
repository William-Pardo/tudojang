import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

export function inicializarAppCheck(app: FirebaseApp) {
    const siteKey = process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (!siteKey || siteKey === 'undefined') return null;

    return initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
    });
}
