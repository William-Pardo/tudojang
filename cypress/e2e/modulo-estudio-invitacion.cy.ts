export {};

declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const cy: any;

describe('Modulo estudio - invitacion y Centro de Estudios', () => {
  beforeEach(() => {
    cy.visit('/#/centro-estudios', {
      onBeforeLoad(win: any) {
        win.__TUDOJANG_E2E_USER__ = {
          id: 'est-1',
          email: 'estudiante@test.com',
          nombreUsuario: 'Estudiante Test',
          rol: 'Tutor',
          tenantId: 'tenant-1',
        };
        win.__TUDOJANG_E2E_TENANT__ = {
          tenantId: 'tenant-1',
          slug: 'tenant-1',
          nombreClub: 'Dojang E2E',
          estadoSuscripcion: 'activo',
          fechaVencimiento: '2099-12-31T00:00:00.000Z',
          onboardingStep: 5,
          features: {
            centroEstudios: true,
          },
        };
        win.__CENTRO_ESTUDIOS_ASIGNACIONES__ = [];
      },
    });
  });

  it('simula estudiante activado y muestra Centro de Estudios vacio', () => {
    cy.contains('h1', 'Centro de Estudios').should('exist');
    cy.contains('Centro de Estudios vacio').should('exist');
    cy.contains('Aun no tienes materiales asignados').should('exist');
    cy.contains('Asignaciones').parent().should('contain', '0');
  });
});
