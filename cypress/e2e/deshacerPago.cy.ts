describe('Funcionalidad Deshacer Pago en Efectivo', () => {
  beforeEach(() => {
    // Interceptar la configuración para que isFirebaseConfigured retorne false (modo simulación)
    cy.visit('/login');
    // Asumimos que hay un login simulado
    cy.get('input[name="email"]').type('testadmin@tudojang.com');
    cy.get('input[name="password"]').type('admin123');
    cy.contains('button', 'Entrar').click();
    
    // Navegar a estudiantes
    cy.contains('Estudiantes').click();
  });

  it('Debe mostrar el botón de deshacer pago para administradores, abrir el modal de confirmación y procesarlo', () => {
    // 1. Encontrar la fila del estudiante simulado
    // Nota: Cypress buscará el botón amarillo (text-yellow-600) que agregamos en FilaEstudiante
    cy.get('button[title="Deshacer Último Pago"]').first().should('be.visible').click();

    // 2. Validar que se abre el modal de doble confirmación
    cy.contains('Deshacer Último Pago').should('be.visible');
    cy.contains('¿Estás seguro de que deseas anular el ÚLTIMO pago registrado').should('be.visible');

    // 3. Confirmar la anulación
    cy.contains('button', 'Confirmar').click();

    // 4. Validar el mensaje de éxito de la notificación toast
    cy.contains('Último pago anulado correctamente').should('be.visible');
    
    // 5. El modal debería haberse cerrado
    cy.contains('Deshacer Último Pago').should('not.exist');
  });

  it('Debe poder cancelar la anulación sin que pase nada', () => {
    cy.get('button[title="Deshacer Último Pago"]').first().should('be.visible').click();
    
    cy.contains('Deshacer Último Pago').should('be.visible');
    
    // Clic en Cancelar
    cy.contains('button', 'Cancelar').click();
    
    // El modal se cierra sin notificación de éxito
    cy.contains('Deshacer Último Pago').should('not.exist');
    cy.contains('Último pago anulado correctamente').should('not.exist');
  });
});
