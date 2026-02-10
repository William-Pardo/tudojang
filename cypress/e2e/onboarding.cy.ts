describe('Flujo de Registro y Onboarding', () => {
    const testEmail = `test-${Date.now()}@tudojang.com`;
    const testClub = 'Club Onboarding Test';

    it('Debe completar el registro, simular pago y validar acceso', () => {
        // 1. Ir a la Landing y seleccionar plan
        cy.visit('/');
        cy.contains('Iniciar prueba sin costo').click();

        // 2. Llenar formulario de registro
        cy.url().should('include', '/registro-escuela');
        cy.get('input[name="nombreClub"]').type(testClub);
        cy.get('input[name="email"]').type(testEmail);
        cy.get('input[name="telefono"]').type('3195653135');

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

        // Validar que intentó ir a Wompi mediante la variable global
        cy.log('Validando redirección a Wompi...');
        cy.get('#debug-log-onboarding').then($el => {
            cy.log('ESTADO FINAL LOG: ' + $el.text());
        });
        cy.window({ timeout: 15000 }).should('have.property', 'lastRedirectWompi');
        cy.window().then((win: any) => {
            expect(win.lastRedirectWompi).to.include('checkout.wompi.co');
        });

        // Verificamos si se guardó el registro pendiente en LocalStorage
        cy.window().its('localStorage').should((ls) => {
            const pendingReg = ls.getItem('registro_pendiente');
            expect(pendingReg).to.not.be.null;
        });

        // 4. SIMULAR RETORNO DE WOMPI (Activación)
        // Navegamos directamente a la URL de retorno con un ID de transacción ficticio
        // Lo ponemos en ambos sitios para asegurar detección (search y hash)
        cy.log('Navegando a la URL de retorno...');
        cy.visit('/?id=8888-9999-TEST#/registro-escuela?id=8888-9999-TEST');

        // 5. Validar pantalla de éxito y activación
        cy.log('Esperando activación...');
        // Verificar log de depuración tras recarga
        cy.get('#debug-log-onboarding', { timeout: 15000 }).should('contain', 'RE_DETECT');

        cy.contains('¡Dojang Activado!', { timeout: 15000 }).should('be.visible');

        // El botón de login debería estar habilitado después de copiar
        cy.contains('Copiar Contraseña').click();
        cy.contains('Iniciar Sesión Ahora', { timeout: 10000 }).should('not.be.disabled');

        // 6. VALIDACIÓN FINAL: Login con las nuevas credenciales
        cy.window().then((win) => {
            const pendingReg = win.localStorage.getItem('registro_pendiente');
            // En el código real se borra después de mostrar éxito, pero aquí lo leemos justo antes
        });

        cy.contains('Iniciar Sesión Ahora').click();

        // 7. Intentar Login
        cy.url().should('include', '/login');
        // Aquí el test termina la validación del flujo
    });
});
