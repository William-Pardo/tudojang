
// cypress/e2e/estudiantes.cy.ts
// FIX: Added export {} to make the file a module and avoid block-scoped variable clashing.
export {};

// FIX: Declared test runner globals to resolve "cannot find name" errors when global type definitions are unavailable.
declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const cy: any;

describe('Student Management E2E', () => {
  // Use dynamic data to ensure tests are isolated
  const student = {
    name: 'Cypress',
    lastName: 'TestUser',
    id: `cy-${Date.now()}`,
    birthDate: '2015-05-10', // A date that makes the student a minor
    tutorName: 'Tutor',
    tutorLastName: 'Cypress',
    tutorId: `tutor-${Date.now()}`,
    tutorPhone: '3009876543',
    tutorEmail: 'tutor@cypress.io',
  };

  beforeEach(() => {
    // Log in as an admin before each test using the custom command
    cy.login('admin');
    cy.visit('/#/estudiantes');
    cy.contains('h1', 'Gestión de Estudiantes').should('be.visible');
  });

  it('should create a new student, verify it, and then delete it', () => {
    // --- 1. CREATE STUDENT ---
    cy.contains('button', 'Agregar Estudiante').click();

    // The form appears in a modal
    cy.contains('h2', 'Agregar Nuevo Estudiante').should('be.visible');

    // Fill in student data
    cy.get('input[name="nombres"]').type(student.name);
    cy.get('input[name="apellidos"]').type(student.lastName);
    cy.get('input[name="numeroIdentificacion"]').type(student.id);
    cy.get('input[name="fechaNacimiento"]').type(student.birthDate);

    // Because the student is a minor, the tutor section should be visible and required
    cy.contains('legend', 'Datos del Tutor (Obligatorio)').should('be.visible');

    // Fill in tutor data
    cy.get('input[name="tutor.nombres"]').type(student.tutorName);
    cy.get('input[name="tutor.apellidos"]').type(student.tutorLastName);
    cy.get('input[name="tutor.numeroIdentificacion"]').type(student.tutorId);
    cy.get('input[name="tutor.telefono"]').type(student.tutorPhone);
    cy.get('input[name="tutor.correo"]').type(student.tutorEmail);

    // Save the new student
    cy.contains('button', 'Guardar Estudiante').should('be.enabled').click();

    // --- 2. VERIFY CREATION ---
    // A success notification should appear
    cy.contains('Estudiante creado correctamente').should('be.visible');

    // Find the new student in the table
    cy.get('input[placeholder="Buscar por nombre..."]').type(`${student.name} ${student.lastName}`);
    cy.contains('td', `${student.name} ${student.lastName}`).should('be.visible');

    // --- 3. DELETE STUDENT ---
    // Find the row containing the new student and click its delete button
    cy.contains('tr', `${student.name} ${student.lastName}`)
      .find('button[title="Eliminar"]')
      .click();

    // A confirmation modal should appear
    cy.contains('h2', 'Confirmar Eliminación').should('be.visible');
    cy.contains(`¿Estás seguro de que quieres dar de baja a ${student.name} ${student.lastName}?`).should('be.visible');
    
    // Confirm the deletion
    cy.get('div[role="dialog"]').contains('button', 'Confirmar').click();

    // --- 4. VERIFY DELETION ---
    // A success notification for deletion should appear
    cy.contains('Estudiante dado de baja').should('be.visible');
    
    // Clear and re-type search to ensure the list is updated
    cy.get('input[placeholder="Buscar por nombre..."]').clear().type(`${student.name} ${student.lastName}`);
    
    // The student should no longer be in the table
    cy.contains('td', `${student.name} ${student.lastName}`).should('not.exist');
    cy.contains('Ningún estudiante coincide con los filtros actuales').should('be.visible');
  });
});
