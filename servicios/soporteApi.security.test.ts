import { readFileSync } from 'node:fs';

describe('soporteApi secure boundary', () => {
    const source = readFileSync('servicios/soporteApi.ts', 'utf8');

    it('does not write support tickets directly from the browser', () => {
        expect(source).not.toMatch(/\baddDoc\b|\bupdateDoc\b/);
        expect(source).not.toMatch(/from ['"]firebase\/firestore['"][\s\S]*\baddDoc\b/);
    });

    it('uses backend callables for ticket creation and transitions', () => {
        expect(source).toMatch(/httpsCallable/);
        expect(source).toMatch(/crearTicketSoporteSeguro/);
        expect(source).toMatch(/actualizarTicketSoporteSeguro/);
    });

    it('does not transmit identity, email or full conversations when creating tickets', () => {
        expect(source).not.toMatch(/userEmail:\s*datos|userNombre:\s*datos/);
        expect(source).not.toMatch(/mensajesInternos|transcript|conversation/);
    });
});
