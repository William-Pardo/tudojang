import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { inicializarAppCheck } from './appCheck';

jest.mock('firebase/app-check', () => ({
    initializeAppCheck: jest.fn(() => ({ appCheck: true })),
    ReCaptchaEnterpriseProvider: jest.fn(),
}));

describe('App Check', () => {
    const originalKey = process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    const originalLocation = window.location;

    afterEach(() => {
        process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = originalKey;
        window.localStorage.clear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation,
        });
        delete (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN;
        jest.clearAllMocks();
    });

    it('no inicializa sin site key pública', () => {
        delete process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
        expect(inicializarAppCheck({} as any)).toBeNull();
        expect(initializeAppCheck).not.toHaveBeenCalled();
    });

    it('usa Enterprise y refresca tokens automáticamente', () => {
        process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = 'public-site-key';
        inicializarAppCheck({} as any);
        expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('public-site-key');
        expect(initializeAppCheck).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
        );
    });

    it('permite activar debug token en localhost desde localStorage', () => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, hostname: 'localhost' },
        });
        process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = 'public-site-key';
        window.localStorage.setItem('tudojang:appcheck-debug-token', 'true');

        inicializarAppCheck({} as any);

        expect((self as any).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
        expect(initializeAppCheck).toHaveBeenCalled();
    });
});
