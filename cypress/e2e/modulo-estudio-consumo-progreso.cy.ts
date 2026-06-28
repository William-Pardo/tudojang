describe('Modulo estudio - consumo y progreso', () => {
  it('abre PDF, registra paginas vistas y sincroniza avance', () => {
    cy.visit('/#/centro-estudios', {
      onBeforeLoad(win) {
        (win as any).__TUDOJANG_E2E_USER__ = {
          id: 'estudiante-progreso-1',
          uid: 'estudiante-progreso-1',
          email: 'estudiante.progreso@tudojang.test',
          nombre: 'Estudiante Progreso',
          nombreUsuario: 'Estudiante Progreso',
          rol: 'Estudiante',
          tenantId: 'tenant-progreso',
        };

        (win as any).__TUDOJANG_E2E_TENANT__ = {
          tenantId: 'tenant-progreso',
          slug: 'tenant-progreso',
          nombreClub: 'Tenant Progreso',
          onboardingStep: 5,
          fechaVencimiento: '2099-12-31',
          estadoSuscripcion: 'activo',
          features: { centroEstudios: true },
        };

        (win as any).__CENTRO_ESTUDIOS_SYNC_PAYLOADS__ = [];
        (win as any).__CENTRO_ESTUDIOS_ASIGNACIONES__ = [
          {
            id: 'asignacion-pdf-1',
            tenantId: 'tenant-progreso',
            recursoId: 'recurso-pdf-1',
            titulo: 'PDF tecnica basica',
            descripcion: 'Material PDF para registrar avance de lectura.',
            destinatario: { tipo: 'grupo', grupo: 'Infantil' },
            uso: 'estudio',
            momento: 'preparacion',
            obligatoria: true,
            fechaApertura: '2026-06-27T00:00:00.000Z',
            fechaCierre: '2026-07-04T00:00:00.000Z',
            estado: 'publicada',
            creadoPorUid: 'maestro-progreso-1',
            creadoEn: '2026-06-27T00:00:00.000Z',
            actualizadoEn: '2026-06-27T00:00:00.000Z',
            estadoProgreso: 'disponible',
            porcentajeProgreso: 0,
            urgencia: 'media',
          },
        ];
      },
    });

    cy.contains('PDF tecnica basica').should('be.visible');
    cy.contains('Abrir material').scrollIntoView().click();

    cy.contains('Visor PDF').should('be.visible');
    cy.contains('Paginas registradas: 0/3').should('be.visible');
    cy.contains('Marcar pagina 1 como vista').click();
    cy.contains('Marcar pagina 2 como vista').click();
    cy.contains('Paginas registradas: 2/3').should('be.visible');

    cy.contains('Sincronizar avance').click();

    cy.window().then((win) => {
      const clave = 'tudojang:centro-estudios:progress-sync:tenant-progreso:asignacion-pdf-1';
      expect(JSON.parse(win.localStorage.getItem(clave) || '{}')).to.deep.include({
        paginasVistas: [1, 2],
      });
      expect((win as any).__CENTRO_ESTUDIOS_SYNC_PAYLOADS__).to.have.length.greaterThan(0);
      expect((win as any).__CENTRO_ESTUDIOS_SYNC_PAYLOADS__.at(-1)).to.include({
        tenantId: 'tenant-progreso',
        asignacionId: 'asignacion-pdf-1',
        tipo: 'pdf',
      });
      expect((win as any).__CENTRO_ESTUDIOS_SYNC_PAYLOADS__.at(-1).paginasVistas).to.deep.equal([1, 2]);
    });
  });
});
