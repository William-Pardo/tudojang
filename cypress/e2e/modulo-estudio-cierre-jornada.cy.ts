describe('Modulo estudio - cierre de jornada', () => {
  it('cierra jornada, avanza programa y publica refuerzo pendiente', () => {
    cy.visit('/#/jornadas', {
      onBeforeLoad(win) {
        (win as any).__TUDOJANG_E2E_USER__ = {
          id: 'maestro-cierre-1',
          uid: 'maestro-cierre-1',
          email: 'maestro.cierre@tudojang.test',
          nombre: 'Maestro Cierre',
          nombreUsuario: 'Maestro Cierre',
          rol: 'Admin',
          tenantId: 'tenant-cierre',
        };

        (win as any).__TUDOJANG_E2E_TENANT__ = {
          tenantId: 'tenant-cierre',
          slug: 'tenant-cierre',
          nombreClub: 'Tenant Cierre',
          onboardingStep: 5,
          fechaVencimiento: '2099-12-31',
          estadoSuscripcion: 'activo',
          features: { centroEstudios: true },
        };
      },
    });

    cy.contains('h1', 'Jornadas').should('be.visible');
    cy.contains('Estado: borrador').should('be.visible');

    cy.contains('Confirmar jornada').click();
    cy.contains('Estado: confirmada').should('be.visible');

    cy.contains('Iniciar jornada').click();
    cy.contains('Estado: en curso').should('be.visible');

    cy.contains('label', 'Asistencia registrada').click();
    cy.contains('label', 'Objetivo saludo impartido').click();
    cy.contains('Cerrar jornada').click();

    cy.contains('Estado: cerrada').should('be.visible');
    cy.contains('Programa avanzo a: Patada').should('be.visible');
    cy.contains('Refuerzos publicados: obj-patada').should('be.visible');
  });
});
