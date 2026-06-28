import { httpsCallable } from 'firebase/functions';
import { consultarSoporte } from './cliente';

jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(() => ({ name: 'functions' })),
    httpsCallable: jest.fn(),
}));

describe('cliente híbrido de soporte', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => {
        delete (window as any).__ASSISTANT_FLAGS__;
    });

    it('devuelve respuestas locales sin invocar IA', async () => {
        const result = await consultarSoporte({
            question: 'Como agrego un estudiante',
            role: 'Admin',
            context: [],
        });

        expect(result).toMatchObject({ state: 'answer', source: 'local' });
        expect(result.answer).toContain('Agregar Estudiante');
        expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('devuelve aclaración local sin consumir IA', async () => {
        const result = await consultarSoporte({
            question: 'Necesito ayuda con pagos',
            role: 'Admin',
            context: [],
        });

        expect(result.state).toBe('clarify');
        expect(result.source).toBe('local');
        expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('ante fallback con IA apagada por defecto no invoca callable', async () => {
        const result = await consultarSoporte({
            question: 'Como sincronizo el cinturÃ³n cuÃ¡ntico',
            role: 'Admin',
            context: [],
        });

        expect(result).toMatchObject({
            state: 'unavailable',
            source: 'human',
            canEscalate: true,
        });
        expect(httpsCallable).not.toHaveBeenCalled();
    });

    it('usa el callable ante fallback cuando IA estÃ¡ explÃ­citamente habilitada y conserva fuente y cuota', async () => {
        (window as any).__ASSISTANT_FLAGS__ = { aiEnabled: true };
        (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({
            data: {
                answer: 'Respuesta verificada por IA.',
                source: 'ai',
                intentId: 'students.manage',
                catalogVersion: '1.0.0',
                confidence: 0.55,
                remaining: { user: 9, tenant: 99, global: 999 },
            },
        }));

        const result = await consultarSoporte({
            question: 'Como sincronizo el cinturón cuántico',
            role: 'Admin',
            context: [],
        });

        expect(result).toMatchObject({
            state: 'answer',
            source: 'ai',
            remaining: { user: 9, tenant: 99, global: 999 },
        });
    });

    it('degrada a cuota agotada y permite escalamiento', async () => {
        (window as any).__ASSISTANT_FLAGS__ = { aiEnabled: true };
        (httpsCallable as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue({
            code: 'functions/resource-exhausted',
        }));

        const result = await consultarSoporte({
            question: 'Como sincronizo el cinturón cuántico',
            role: 'Admin',
            context: [],
        });

        expect(result).toMatchObject({
            state: 'quota_exhausted',
            source: 'human',
            canEscalate: true,
        });
    });
});
