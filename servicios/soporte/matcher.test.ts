import { CATALOGO_SOPORTE_V1 } from '../../shared/soporte/catalogo.v1';
import { prepararContextoSoporte } from './contexto';
import { resolverConsultaLocal } from './matcher';

describe('matcher local determinista', () => {
    it('devuelve el mismo intent, fuente y confianza para entradas idénticas', () => {
        const input = {
            question: '¿Cómo agrego un estudiante?',
            role: 'Admin' as const,
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        };

        expect(resolverConsultaLocal(input)).toEqual(resolverConsultaLocal(input));
        expect(resolverConsultaLocal(input)).toMatchObject({
            state: 'answer',
            source: 'local',
            intentId: 'students.manage',
            catalogVersion: CATALOGO_SOPORTE_V1.catalogVersion,
        });
    });

    it('filtra contenido no autorizado sin revelar el intent restringido', () => {
        const result = resolverConsultaLocal({
            question: '¿Cómo elimino un movimiento financiero?',
            role: 'Asistente',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result.state).not.toBe('answer');
        expect(result.candidates?.map(candidate => candidate.intentId)).not.toContain('finance.delete');
        expect(JSON.stringify(result)).not.toContain('Eliminar movimientos financieros');
    });

    it.each([
        ['Editor', 'Necesito deshacer el ultimo pago de un estudiante'],
        ['Editor', 'anular pago de estudiante'],
        ['Editor', 'anular pago estudiante'],
        ['Editor', 'deshacer pago de estudiante'],
        ['Editor', 'deshacer pago estudiante'],
        ['Asistente', 'Necesito deshacer el ultimo pago de un estudiante'],
        ['Asistente', 'anular pago de estudiante'],
        ['Asistente', 'anular pago estudiante'],
        ['Asistente', 'deshacer pago de estudiante'],
        ['Asistente', 'deshacer pago estudiante'],
    ] as const)(
        'el rol %s aclara o rechaza la acción restringida: %s',
        (role, question) => {
            const restricted = resolverConsultaLocal({
                question,
                role,
                context: prepararContextoSoporte([]),
                catalog: CATALOGO_SOPORTE_V1,
            });
            const allowed = resolverConsultaLocal({
                question: 'Como registro un pago de estudiante',
                role,
                context: prepararContextoSoporte([]),
                catalog: CATALOGO_SOPORTE_V1,
            });

            expect(restricted.intentId).not.toBe('finance.student-payment-undo');
            expect(restricted.state).not.toBe('answer');
            expect(restricted.candidates?.map(candidate => candidate.intentId))
                .not.toContain('finance.student-payment-undo');
            expect(JSON.stringify(restricted)).not.toContain('Deshacer o anular');
            expect(allowed).toMatchObject({
                state: 'answer',
                intentId: 'finance.student-payments',
            });
        },
    );

    it.each([
        'Necesito deshacer el ultimo pago de un estudiante',
        'anular pago de estudiante',
        'anular pago estudiante',
        'deshacer pago de estudiante',
        'deshacer pago estudiante',
    ])('resuelve para Admin la entrada exclusiva: %s', question => {
        const result = resolverConsultaLocal({
            question,
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result).toMatchObject({
            state: 'answer',
            intentId: 'finance.student-payment-undo',
        });
    });

    it('usa términos negativos para evitar una coincidencia temática incorrecta', () => {
        const result = resolverConsultaLocal({
            question: 'Necesito eliminar un movimiento financiero',
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result).toMatchObject({
            state: 'answer',
            intentId: 'finance.delete',
        });
    });

    it.each([
        'como activo pago anual de formulario',
        'activar cobro anual de matrícula',
        'donde marco cobro anual',
    ])('resuelve localmente la configuracion anual del formulario: %s', question => {
        const result = resolverConsultaLocal({
            question,
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result).toMatchObject({
            state: 'answer',
            source: 'local',
            intentId: 'config.annual-enrollment-fee',
            route: '/configuracion',
        });
        expect(result.answer).toContain('Configuración > Identidad & Pagos');
        expect(result.answer).toContain('Valor Matrícula / Formulario');
        expect(result.answer).toContain('¿Cobro Anual?');
        expect(result.answer).toContain('Guardar Cambios');
    });

    it.each([
        'como registro un pago en Tesorería',
        'registrar pago de estudiante en Tesorería',
    ])('mantiene los pagos operativos en Tesoreria: %s', question => {
        const result = resolverConsultaLocal({
            question,
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result).toMatchObject({
            state: 'answer',
            intentId: 'finance.student-payments',
        });
        expect(result.intentId).not.toBe('config.annual-enrollment-fee');
        expect(result.answer).toContain('Tesorería');
    });

    it('aclara resultados ambiguos entre 0.55 y 0.77 y deriva a fallback bajo 0.55', () => {
        const ambiguous = resolverConsultaLocal({
            question: 'Necesito ayuda con pagos',
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });
        const unknown = resolverConsultaLocal({
            question: '¿Cómo sincronizo el cinturón cuántico?',
            role: 'Admin',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(ambiguous.state).toBe('clarify');
        expect(ambiguous.confidence).toBeGreaterThanOrEqual(0.55);
        expect(ambiguous.confidence).toBeLessThan(0.78);
        expect(ambiguous.candidates!.length).toBeGreaterThan(1);
        expect(unknown).toMatchObject({ state: 'fallback', confidence: expect.any(Number) });
        expect(unknown.confidence).toBeLessThan(0.55);
    });

    it('usa contexto solo para continuidad y prioriza una pregunta actual explícita', () => {
        const studentContext = prepararContextoSoporte([
            { role: 'user', text: 'Quiero agregar un estudiante nuevo' },
            { role: 'assistant', text: 'Te ayudo con el módulo Estudiantes' },
        ]);
        const followUp = resolverConsultaLocal({
            question: '¿Cómo lo hago?',
            role: 'Admin',
            context: studentContext,
            catalog: CATALOGO_SOPORTE_V1,
        });
        const explicitCurrentQuestion = resolverConsultaLocal({
            question: '¿Cómo elimino un movimiento financiero?',
            role: 'Admin',
            context: studentContext,
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(followUp).toMatchObject({ state: 'answer', intentId: 'students.manage' });
        expect(explicitCurrentQuestion).toMatchObject({
            state: 'answer',
            intentId: 'finance.delete',
        });
    });

    it('impide resolver con un rol reservado aunque el alias sea exacto', () => {
        const result = resolverConsultaLocal({
            question: '¿Cómo agrego un estudiante?',
            role: 'Estudiante',
            context: prepararContextoSoporte([]),
            catalog: CATALOGO_SOPORTE_V1,
        });

        expect(result.state).toBe('fallback');
        expect(result.intentId).toBeUndefined();
    });
});
