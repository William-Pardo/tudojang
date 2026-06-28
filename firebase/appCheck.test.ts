import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { inicializarAppCheck } from './appCheck';

jest.mock('firebase/app-check', () => ({
    initializeAppCheck: jest.fn(() => ({ appCheck: true })),
    ReCaptchaEnterpriseProvider: jest.fn(),
}));

describe('App Check', () => {
    const originalKey = process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

    afterEach(() => {
        process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY = originalKey;
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
});
