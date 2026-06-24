import { normalizarTextoSoporte, prepararContextoSoporte } from './contexto';

describe('contexto de soporte', () => {
    it('normaliza tildes, signos y espacios de forma estable', () => {
        expect(normalizarTextoSoporte('  ¿Cómo   REGISTRO un PÁGO? ')).toBe('como registro un pago');
        expect(normalizarTextoSoporte('Configuración—Sedes')).toBe('configuracion sedes');
    });

    it('conserva solo cuatro turnos y redacta email, teléfono y documento', () => {
        const contexto = prepararContextoSoporte([
            { role: 'user', text: 'turno descartado uno' },
            { role: 'assistant', text: 'turno descartado dos' },
            { role: 'user', text: 'Mi correo es ana@example.com' },
            { role: 'assistant', text: '¿Cuál es tu número?' },
            { role: 'user', text: 'Mi celular es 3001234567 y CC 123456789' },
            { role: 'assistant', text: 'Revisemos estudiantes' },
        ]);

        expect(contexto.turns).toHaveLength(4);
        expect(contexto.turns.map(turn => turn.text)).toEqual([
            'Mi correo es [EMAIL]',
            '¿Cuál es tu número?',
            'Mi celular es [TELEFONO] y CC [DOCUMENTO]',
            'Revisemos estudiantes',
        ]);
        expect(JSON.stringify(contexto)).not.toMatch(/ana@example|3001234567|123456789/);
    });

    it('acepta el historial legado y mantiene el orden más reciente', () => {
        const contexto = prepararContextoSoporte(
            'uno | dos | tres | cuatro | cinco',
        );

        expect(contexto.turns.map(turn => turn.text)).toEqual(['dos', 'tres', 'cuatro', 'cinco']);
    });
});
