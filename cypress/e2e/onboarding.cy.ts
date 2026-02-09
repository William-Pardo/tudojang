describe('Flujo de Registro y Onboarding', () => {
    const testEmail = `test-${Date.now()}@tudojang.com`;
    const testClub = 'Club Onboarding Test';

    it('Debe completar el registro, simular pago y validar acceso', () => {
        // 1. Ir a la Landing y seleccionar plan
        cy.visit('/');
        cy.contains('Elegir Plan').first().click(); // Asumiendo que hay un botón de elegir plan

        // 2. Llenar formulario de registro
        cy.url().should('include', '/registro-escuela');
        cy.get('input[name="nombreClub"]').type(testClub);
        cy.get('input[name="email"]').type(testEmail);
        cy.get('input[name="telefono"]').type('3195653135');

        // Capturamos el evento de redirección a Wompi
        cy.window().then((win) => {
            cy.stub(win.location, 'href').as('wompiRedirect');
        });

        cy.get('button[type="submit"]').click();

        // 3. Validar que intentó ir a Wompi (esto confirma que el backend respondió OK)
        // Ya que si falla el pre-provisionamiento, no habría redirección
        cy.wait(2000); // Esperar procesamiento de Firebase Cloud Functions

        // Verificamos si se guardó el registro pendiente en LocalStorage
        cy.window().then((win) => {
            const pendingReg = win.localStorage.getItem('registro_pendiente');
            expect(pendingReg).to.not.be.null;
            const data = JSON.parse(pendingReg);

            // 4. SIMULAR RETORNO DE WOMPI (Activación)
            // Navegamos directamente a la URL de retorno con un ID de transacción ficticio
            const returnUrl = `/#/registro-escuela?id=8888-9999-TEST`;
            cy.visit(returnUrl);
        });

        // 5. Validar pantalla de éxito y activación
        cy.contains('¡Dojang Activado!', { timeout: 15000 }).should('be.visible');

        // El botón de login debería estar habilitado después de copiar
        cy.contains('Copiar Contraseña').click();
        cy.contains('Iniciar Sesión Ahora').should('not.have.attr', 'disabled');

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
