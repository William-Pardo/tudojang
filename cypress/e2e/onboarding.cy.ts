// SDD pricing-cupo-real (Bloque 4b, tarea 4.14): el registro ya no selecciona un plan ni
// pasa por un checkout de Wompi -- registrarNuevaEscuela crea el tenant en
// estadoSuscripcion:'demo' de forma incondicional (7 días de gracia) y la pantalla de éxito
// se muestra DIRECTO tras aprovisionar el usuario (ver vistas/RegistroEscuela.tsx). Este
// spec reemplaza el flujo viejo (registro -> checkout Wompi -> retorno simulado -> éxito)
// por (registro -> éxito directo). Cypress sigue flagueado como no confiable en este entorno
// (design.md) -- best effort, no bloqueante.
describe('Flujo de Registro y Onboarding', () => {
    const testEmail = `test-${Date.now()}@tudojang.com`;
    const testClub = 'Club Onboarding Test';

    it('Debe completar el registro sin seleccionar plan y activar el trial de 7 días de inmediato', () => {
        // 1. Ir a la Landing -- ya no hay plan que seleccionar (la calculadora reemplazó el
        // grid de planes fijos, precio-publico-calculadora), el CTA lleva directo al registro.
        cy.visit('/');
        cy.contains('Iniciar prueba sin costo').click();

        // 2. Llenar formulario de registro
        cy.url().should('include', '/registro-escuela');
        cy.get('input[name="nombreClub"]').type(testClub);
        cy.get('input[name="email"]').type(testEmail);
        cy.get('input[name="telefono"]').type('3195653135');

        cy.get('button[type="submit"]').should('be.disabled');
        cy.get('#aceptaPrivacidad').check();
        cy.get('#aceptaTerminos').check();
        cy.get('button[type="submit"]').should('not.be.disabled');
        cy.get('button[type="submit"]').click();

        // 3. Validar progreso mediante el log de depuración
        cy.log('Esperando procesamiento del formulario...');

        // Verificar si hay errores de validación visibles
        cy.get('body').then($body => {
            if ($body.find('.text-red-500').length > 0) {
                cy.log('ERRORES DE VALIDACIÓN DETECTADOS: ' + $body.find('.text-red-500').text());
            }
        });

        // Esperar a que el log registre el inicio del envío
        cy.get('#debug-log-onboarding', { timeout: 20000 }).should('contain', 'Iniciando envío...');

        cy.get('#debug-log-onboarding').then($el => {
            const status = $el.text();
            cy.log('Estado actual Onboarding: ' + status);
            if (status.includes('ERROR')) {
                throw new Error('Falla en Onboarding: ' + status);
            }
        });

        // 4. Validar pantalla de éxito DIRECTA -- sin checkout de Wompi, sin retorno
        // simulado, sin localStorage de registro pendiente. El trial de 7 días activa solo.
        cy.log('Esperando pantalla de éxito...');
        cy.get('#debug-log-onboarding', { timeout: 15000 }).should('contain', '¡Éxito!');
        cy.contains('¡Dojang Activado!', { timeout: 15000 }).should('be.visible');

        // El botón de login debería estar habilitado después de copiar
        cy.contains('Copiar Contraseña').click();
        cy.contains('Iniciar Sesión Ahora', { timeout: 10000 }).should('not.be.disabled');

        // 5. VALIDACIÓN FINAL: navegar a Login con las nuevas credenciales
        cy.contains('Iniciar Sesión Ahora').click();
        cy.url().should('include', '/login');
    });
});
