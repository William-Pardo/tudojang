describe('Modulo estudio - publicacion de asignacion', () => {
  it('simula asignacion publicada por maestro y la muestra disponible al estudiante', () => {
    cy.visit('/#/centro-estudios', {
      onBeforeLoad(win) {
        (win as any).__TUDOJANG_E2E_USER__ = {
          id: 'estudiante-publicacion-1',
          uid: 'estudiante-publicacion-1',
          email: 'estudiante.publicacion@tudojang.test',
          nombre: 'Estudiante Publicacion',
          nombreUsuario: 'Estudiante Publicacion',
          rol: 'Estudiante',
          tenantId: 'tenant-publicacion',
        };

        (win as any).__TUDOJANG_E2E_TENANT__ = {
          tenantId: 'tenant-publicacion',
          slug: 'tenant-publicacion',
          nombreClub: 'Tenant Publicacion',
          onboardingStep: 5,
          fechaVencimiento: '2099-12-31',
          estadoSuscripcion: 'activo',
          features: { centroEstudios: true },
        };

        (win as any).__CENTRO_ESTUDIOS_ASIGNACIONES__ = [
          {
            id: 'asignacion-publicada-1',
            tenantId: 'tenant-publicacion',
            recursoId: 'recurso-aprobado-1',
            titulo: 'Manual publicado desde biblioteca',
            descripcion: 'Recurso aprobado por administracion y publicado por el maestro para el grupo Infantil.',
            destinatario: { tipo: 'grupo', grupo: 'Infantil' },
            uso: 'estudio',
            momento: 'preparacion',
            obligatoria: true,
            fechaApertura: '2026-06-27T00:00:00.000Z',
            fechaCierre: '2026-07-04T00:00:00.000Z',
            estado: 'publicada',
            creadoPorUid: 'maestro-publicador-1',
            creadoEn: '2026-06-27T00:00:00.000Z',
            actualizadoEn: '2026-06-27T00:00:00.000Z',
            estadoProgreso: 'disponible',
            porcentajeProgreso: 0,
            urgencia: 'media',
          },
        ];
      },
    });

    cy.contains('h1', 'Centro de Estudios').should('be.visible');
    cy.contains('Asignaciones activas').should('be.visible');
    cy.contains('Manual publicado desde biblioteca').should('be.visible');
    cy.contains('Recurso aprobado por administracion y publicado por el maestro para el grupo Infantil.').should('be.visible');
    cy.contains('Disponible').should('be.visible');
    cy.contains('Abrir material').scrollIntoView().should('be.visible');
  });
});
