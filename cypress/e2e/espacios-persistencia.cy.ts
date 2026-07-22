describe('Espacios fisicos - persistencia real (cierre Centro de Estudios)', () => {
  it('crea un espacio con el tenant real del usuario y lo conserva tras recargar', () => {
    const e2eUser = {
      id: 'admin-espacios-1',
      uid: 'admin-espacios-1',
      email: 'admin.espacios@tudojang.test',
      nombre: 'Admin Espacios',
      nombreUsuario: 'Admin Espacios',
      rol: 'Admin',
      tenantId: 'tenant-espacios-verify',
      sedeId: 'sede-verify-1',
    };
    const e2eTenant = {
      tenantId: 'tenant-espacios-verify',
      slug: 'tenant-espacios-verify',
      nombreClub: 'Tenant Espacios Verify',
      onboardingStep: 5,
      fechaVencimiento: '2099-12-31',
      estadoSuscripcion: 'activo',
      features: { centroEstudios: true },
    };

    cy.visit('/#/espacios', {
      onBeforeLoad(win) {
        (win as any).__TUDOJANG_E2E_USER__ = e2eUser;
        (win as any).__TUDOJANG_E2E_TENANT__ = e2eTenant;
      },
    });

    cy.contains('h1', 'Espacios fisicos').should('be.visible');
    // Antes del fix, la lista arrancaba vacia y el nombre por defecto del input era
    // 'Tatami principal' con tenant-demo hardcodeado -- confirmamos que arranca vacia
    // (tenant real recien creado, sin espacios) y NO por un demo precargado.
    cy.contains('Sin espacios registrados.').should('be.visible');

    cy.get('#espacio-nombre').clear().type('Tatami E2E');
    cy.get('#espacio-capacidad').clear().type('22');
    cy.contains('button', 'Crear espacio').click();

    // Debe aparecer sin recargar (el guardado dispara un re-fetch real via
    // espacioRepository.listarEspaciosPorTenant, no un setState optimista de memoria).
    cy.contains('Tatami E2E').should('be.visible');
    cy.contains('Capacidad: 22').should('be.visible');

    // La prueba real de persistencia: recargar la pagina completa. Si solo fuera
    // setState en memoria (el bug original, DT-0007), esto lo haria desaparecer.
    cy.reload();
    cy.contains('h1', 'Espacios fisicos').should('be.visible');
    cy.contains('Tatami E2E').should('be.visible');
    cy.contains('Capacidad: 22').should('be.visible');
  });

  it('un usuario sin rol Admin no puede acceder a /espacios', () => {
    cy.visit('/#/espacios', {
      onBeforeLoad(win) {
        (win as any).__TUDOJANG_E2E_USER__ = {
          id: 'editor-espacios-1',
          uid: 'editor-espacios-1',
          email: 'editor.espacios@tudojang.test',
          nombre: 'Editor Espacios',
          nombreUsuario: 'Editor Espacios',
          rol: 'Editor',
          tenantId: 'tenant-espacios-verify',
        };
        (win as any).__TUDOJANG_E2E_TENANT__ = {
          tenantId: 'tenant-espacios-verify',
          slug: 'tenant-espacios-verify',
          nombreClub: 'Tenant Espacios Verify',
          onboardingStep: 5,
          fechaVencimiento: '2099-12-31',
          estadoSuscripcion: 'activo',
          features: { centroEstudios: true },
        };
      },
    });

    cy.contains('h1', 'Espacios fisicos').should('not.exist');
  });
});
