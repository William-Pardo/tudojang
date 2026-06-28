export {};

declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const cy: any;

const abrirYEnviar = (pregunta: string) => {
    cy.get('button[aria-label="Abrir chat"]').click();
    cy.get('input[placeholder="Describa su inquietud..."]').type(pregunta);
    cy.get('button[aria-label="Enviar mensaje"]').click();
};

describe('Asistente virtual híbrido', () => {
    beforeEach(() => {
        cy.visit('/#/login');
        cy.get('input[name="email"]').type('admin@test.com');
        cy.get('input[name="contrasena"]').type('admin123');
        cy.get('button[type="submit"]').click();
        cy.get('button[aria-label="Abrir chat"]').should('be.visible');
    });

    it('responde desde el catálogo local sin llamar IA', () => {
        cy.intercept('POST', '**/consultarAsistenteIa', cy.spy().as('ia'));
        abrirYEnviar('Como agrego un estudiante');
        cy.contains('Manual verificado').should('be.visible');
        cy.get('@ia').should('not.have.been.called');
    });

    it('solicita aclaración ante una consulta ambigua', () => {
        abrirYEnviar('Necesito ayuda con pagos');
        cy.contains(/Indica la pantalla y la acción exacta/i).should('be.visible');
        cy.contains('Manual verificado').should('be.visible');
    });

    it('identifica una respuesta generada por IA', () => {
        cy.intercept('POST', '**/consultarAsistenteIa', {
            statusCode: 200,
            body: { data: {
                answer: 'Respuesta verificada por IA.',
                source: 'ai',
                catalogVersion: '1.0.0',
                confidence: 0.55,
                remaining: { user: 9, tenant: 99, global: 999 },
            } },
        });
        abrirYEnviar('Como sincronizo el cinturón cuántico');
        cy.contains('Respuesta verificada por IA.').should('be.visible');
        cy.contains('Respuesta con IA').should('be.visible');
    });

    it('degrada cuando la cuota está agotada', () => {
        cy.intercept('POST', '**/consultarAsistenteIa', {
            statusCode: 429,
            body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } },
        });
        abrirYEnviar('Como sincronizo el cinturón cuántico');
        cy.contains(/cuota de IA está agotada/i).should('be.visible');
        cy.contains('button', 'Solicitar Asesor Master').should('be.visible');
    });

    it('crea un ticket interno sin consentimiento de WhatsApp', () => {
        cy.intercept('POST', '**/consultarAsistenteIa', {
            statusCode: 200,
            body: { data: {
                answer: 'Puedo escalar tu solicitud.',
                source: 'human',
                catalogVersion: '1.0.0',
                confidence: 0,
                remaining: { user: null, tenant: null, global: null },
            } },
        });
        cy.window().then((win: any) => {
            win.__ASSISTANT_TICKET_ADAPTER__ = (payload: any) => {
                expect(payload.whatsappConsent).to.equal(false);
                expect(payload.tenantId).to.equal(undefined);
                return Promise.resolve({ ticketId: 'ticket-1', source: 'human' });
            };
        });
        abrirYEnviar('Como sincronizo el cinturón cuántico');
        cy.contains('button', 'Solicitar Asesor Master').click();
        cy.contains(/canal de seguimiento prioritario/i).should('be.visible');
    });

    it('abre WhatsApp solo con consentimiento explícito y datos mínimos', () => {
        cy.intercept('POST', '**/consultarAsistenteIa', {
            statusCode: 200,
            body: { data: {
                answer: 'Puedo escalar tu solicitud.',
                source: 'human',
                catalogVersion: '1.0.0',
                confidence: 0,
                remaining: { user: null, tenant: null, global: null },
            } },
        });
        cy.window().then((win: any) => {
            win.__ASSISTANT_TICKET_ADAPTER__ = (payload: any) => {
                expect(payload.whatsappConsent).to.equal(true);
                expect(payload.userId).to.equal(undefined);
                return Promise.resolve({
                ticketId: 'ticket-2',
                source: 'human',
                whatsapp: { allowed: true, url: 'https://wa.me/573001234567?text=ticket-2' },
                });
            };
        });
        abrirYEnviar('Como sincronizo el cinturón cuántico');
        cy.contains('button', 'Continuar por WhatsApp').click();
        cy.contains('a', 'Abrir WhatsApp')
            .should('have.attr', 'href')
            .and('match', /^https:\/\/wa\.me\/573001234567\?text=ticket-2$/);
    });

    it('permite rollback de IA manteniendo el catálogo local', () => {
        cy.window().then((win: any) => {
            win.__ASSISTANT_FLAGS__ = { catalogEnabled: true, aiEnabled: false, escalationEnabled: false };
        });
        abrirYEnviar('Como agrego un estudiante');
        cy.contains('Manual verificado').should('be.visible');
    });
});
